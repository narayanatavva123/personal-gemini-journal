import type { IncomingMessage, ServerResponse } from 'http';
import {
  generateReflection,
  generatePrompts,
  synthesizeEntries,
  continueReflectionDialogue,
} from './geminiService.ts';
import { auditSecretManager, getEmailNotificationConfig } from './secretManager.ts';
import { reverseGeocode } from './locationService.ts';
import { verifyAuthToken, verifyAdminUser, getAdminFirestore } from './firebaseAdmin.ts';
import { getAdminAggregateStats } from './adminService.ts';

// In-memory rate limiting map for multi-turn chat: uid -> timestamp
const recentChatRequests = new Map<string, number>();
import {
  getUserNotificationSettings,
  saveUserNotificationSettings,
  sendTestNotification,
  dispatchEventNotification,
  handleScheduledCron,
} from './notificationService.ts';

// Helper to parse JSON body from incoming request
async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Protect against gigantic payloads (10MB max)
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  const method = req.method || 'GET';

  // Health check endpoint
  if (url === '/api/health' || url.startsWith('/api/health?')) {
    const audit = await auditSecretManager();
    sendJson(res, 200, {
      status: 'ok',
      hasApiKey: audit.configured,
      secretSource: audit.source,
      timestamp: new Date().toISOString(),
      security: {
        serverSideGemini: true,
        clientKeyExposed: false,
        secretManagerIntegrated: true,
        aesStorageSupport: true,
      },
    });
    return true;
  }

  // Reflect on entry
  if (url === '/api/gemini/reflect' && method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.entryText || typeof body.entryText !== 'string') {
        sendJson(res, 400, { error: 'entryText is required' });
        return true;
      }
      const result = await generateReflection(body);
      sendJson(res, 200, result);
    } catch (err: any) {
      console.error('Error in /api/gemini/reflect:', err);
      sendJson(res, 500, {
        error: err.message || 'Failed to generate reflection with Gemini',
      });
    }
    return true;
  }

  // Multi-Turn Gemini Reflection Chat
  // Requirements: Authenticated user, server-side token verification, input validation, rate-limiting, owner-bound persistence
  if (url === '/api/gemini/chat' && method === 'POST') {
    try {
      // 1. Authenticate user
      const user = await verifyAuthToken(req);
      if (!user) {
        sendJson(res, 401, {
          error: 'Authentication required: Please sign in with Firebase to continue your reflection dialogue.',
        });
        return true;
      }

      // 2. Parse and validate body
      const body = await parseBody(req);
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) {
        sendJson(res, 400, { error: 'A non-empty question or message is required.' });
        return true;
      }
      if (message.length > 5000) {
        sendJson(res, 400, { error: 'Message exceeds the 5,000 character limit.' });
        return true;
      }

      const entryText = typeof body.entryText === 'string' ? body.entryText.trim() : '';
      if (!entryText) {
        sendJson(res, 400, { error: 'Journal entry context is required for reflection dialogue.' });
        return true;
      }

      // 3. Rate limiting & duplicate prevention (minimum 800ms between submissions per user)
      const now = Date.now();
      const lastRequest = recentChatRequests.get(user.uid) || 0;
      if (now - lastRequest < 800) {
        sendJson(res, 429, {
          error: 'Please allow Gemini a moment to finish processing before sending another message.',
        });
        return true;
      }
      recentChatRequests.set(user.uid, now);

      // 4. Multi-turn dialogue with Gemini SDK
      const dialogueResult = await continueReflectionDialogue({
        entryId: body.entryId || `entry-${Date.now()}`,
        entryTitle: body.entryTitle,
        entryText,
        initialReflection: body.initialReflection,
        history: Array.isArray(body.history) ? body.history : [],
        message,
        mode: body.mode,
      });

      // 5. Structure conversation record and persist owner-bound under users/{uid}/...
      const entryId = body.entryId || `entry-${Date.now()}`;
      const conversationId = body.conversationId || `conv-${entryId}`;

      // Assemble full message turns
      const prevMessages = Array.isArray(body.messages)
        ? body.messages
        : Array.isArray(body.history)
        ? body.history.map((h: any, i: number) => ({
            id: `msg-hist-${i}`,
            role: h.role,
            content: h.content,
            timestamp: new Date().toISOString(),
          }))
        : [];

      const userTurn = {
        id: `msg-${Date.now()}-user`,
        role: 'user' as const,
        content: message,
        timestamp: new Date().toISOString(),
      };

      const modelTurn = {
        id: `msg-${Date.now() + 1}-model`,
        role: 'model' as const,
        content: dialogueResult.reply,
        timestamp: dialogueResult.timestamp,
      };

      const updatedMessages = [...prevMessages, userTurn, modelTurn];
      const conversationData = {
        id: conversationId,
        userId: user.uid,
        entryId,
        messages: updatedMessages,
        createdAt: body.conversationCreatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Server-side persistence via Admin Firestore (silent fallback to memory/client)
      try {
        const db = getAdminFirestore();

        // 1. Conceptual subcollection: users/{uid}/entries/{entryId}/reflectionConversation/{conversationId}
        await db
          .collection('users')
          .doc(user.uid)
          .collection('entries')
          .doc(entryId)
          .collection('reflectionConversation')
          .doc(conversationId)
          .set(conversationData, { merge: true })
          .catch(() => {});

        // 2. Production subcollection: users/{uid}/interactions/{entryId}/reflectionConversation/{conversationId}
        await db
          .collection('users')
          .doc(user.uid)
          .collection('interactions')
          .doc(entryId)
          .collection('reflectionConversation')
          .doc(conversationId)
          .set(conversationData, { merge: true })
          .catch(() => {});
      } catch (saveErr) {
        console.warn('Admin Firestore conversation write skipped:', saveErr);
      }

      sendJson(res, 200, {
        reply: dialogueResult.reply,
        timestamp: dialogueResult.timestamp,
        conversation: conversationData,
      });
    } catch (err: any) {
      console.error('Error in /api/gemini/chat:', err);
      sendJson(res, 500, {
        error: err.message || 'Failed to generate conversational reflection response',
      });
    }
    return true;
  }

  // Generate prompts
  if (url === '/api/gemini/prompt' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await generatePrompts(body);
      sendJson(res, 200, { prompts: result });
    } catch (err: any) {
      console.error('Error in /api/gemini/prompt:', err);
      sendJson(res, 500, {
        error: err.message || 'Failed to generate prompts with Gemini',
      });
    }
    return true;
  }

  // Synthesize entries
  if (url === '/api/gemini/synthesize' && method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!Array.isArray(body.entries) || body.entries.length === 0) {
        sendJson(res, 400, { error: 'entries array is required' });
        return true;
      }
      const result = await synthesizeEntries(body);
      sendJson(res, 200, result);
    } catch (err: any) {
      console.error('Error in /api/gemini/synthesize:', err);
      sendJson(res, 500, {
        error: err.message || 'Failed to synthesize entries with Gemini',
      });
    }
    return true;
  }

  // Reverse Geocode location via secure server-side proxy
  if (url === '/api/location/reverse-geocode' && method === 'POST') {
    try {
      const body = await parseBody(req);
      const lat = typeof body.latitude === 'number' ? body.latitude : parseFloat(body.latitude);
      const lng = typeof body.longitude === 'number' ? body.longitude : parseFloat(body.longitude);
      const accuracy = typeof body.accuracy === 'number' ? body.accuracy : undefined;

      if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        sendJson(res, 400, {
          error: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required.',
        });
        return true;
      }

      const result = await reverseGeocode(lat, lng, accuracy);
      sendJson(res, 200, result);
    } catch (err: any) {
      console.error('Error in /api/location/reverse-geocode:', err);
      sendJson(res, 500, {
        error: err.message || 'Failed to reverse-geocode coordinates',
      });
    }
    return true;
  }

  // Identity & Role Verification
  if (url === '/api/auth/me' && method === 'GET') {
    try {
      const user = await verifyAuthToken(req);
      if (!user) {
        sendJson(res, 401, { authenticated: false, error: 'Unauthorized: Missing or invalid token' });
        return true;
      }
      sendJson(res, 200, {
        authenticated: true,
        uid: user.uid,
        email: user.email,
        isAdmin: user.isAdmin,
        role: user.role,
      });
    } catch (err: any) {
      sendJson(res, 500, { error: err.message || 'Authentication check failed' });
    }
    return true;
  }

  // Admin Verification check
  if (url === '/api/admin/verify' && (method === 'GET' || method === 'POST')) {
    try {
      const adminUser = await verifyAdminUser(req);
      sendJson(res, 200, {
        isAdmin: true,
        role: adminUser.role,
        uid: adminUser.uid,
      });
    } catch (err: any) {
      sendJson(res, err.statusCode || 403, {
        isAdmin: false,
        error: err.message || 'Access Denied: Administrator role required',
      });
    }
    return true;
  }

  // Secret Manager Security Audit endpoint
  if (url === '/api/admin/audit/secret-manager' && method === 'GET') {
    try {
      const audit = await auditSecretManager();
      sendJson(res, 200, audit);
    } catch (err: any) {
      sendJson(res, 500, { error: err.message || 'Audit check failed' });
    }
    return true;
  }

  // Admin Dashboard Aggregate Stats (Strictly Privacy-Safe, Zero PII/Zero Journal Texts)
  if (url === '/api/admin/stats' && method === 'GET') {
    try {
      const adminUser = await verifyAdminUser(req);
      const stats = await getAdminAggregateStats(adminUser);
      sendJson(res, 200, stats);
    } catch (err: any) {
      console.warn('Admin stats authorization failure:', err?.message);
      sendJson(res, err.statusCode || 403, {
        error: err.message || 'Access Denied: Administrator role required to view dashboard',
      });
    }
    return true;
  }

  // Notification Settings (Owner-bound)
  if (url === '/api/notifications/settings') {
    const user = await verifyAuthToken(req);
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required' });
      return true;
    }

    if (method === 'GET') {
      try {
        const settings = await getUserNotificationSettings(user.uid);
        sendJson(res, 200, settings);
      } catch (err: any) {
        sendJson(res, 500, { error: err.message || 'Could not fetch notification settings' });
      }
      return true;
    }

    if (method === 'POST') {
      try {
        const body = await parseBody(req);
        const updated = await saveUserNotificationSettings(user.uid, body, user.email);
        sendJson(res, 200, updated);
      } catch (err: any) {
        sendJson(res, 500, { error: err.message || 'Could not update notification settings' });
      }
      return true;
    }
  }

  // Notification Provider Configuration Status (Strictly Zero-Secret Exposure)
  if (url === '/api/notifications/status' && method === 'GET') {
    try {
      const user = await verifyAuthToken(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required' });
        return true;
      }

      const config = await getEmailNotificationConfig();
      sendJson(res, 200, {
        configured: config.configured,
        provider: config.provider,
        source: config.source,
        senderAddress: config.senderAddress,
        secretManagerStatus: config.secretManagerStatus,
      });
    } catch (err: any) {
      sendJson(res, 500, { error: err.message || 'Failed to retrieve notification status' });
    }
    return true;
  }

  // Test Notification Dispatch
  if (url === '/api/notifications/test' && method === 'POST') {
    try {
      const user = await verifyAuthToken(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required' });
        return true;
      }

      let targetEmail = user.email;
      try {
        const body = await parseBody(req);
        if (body && typeof body.email === 'string' && body.email.trim()) {
          targetEmail = body.email.trim();
        }
      } catch {
        // Optional payload
      }

      const result = await sendTestNotification(user.uid, targetEmail);
      if (!result.configured) {
        sendJson(res, 503, result);
        return true;
      }

      if (!result.success) {
        sendJson(res, 502, result);
        return true;
      }

      sendJson(res, 200, result);
    } catch (err: any) {
      const isPermissionDenied =
        err.code === 7 ||
        err.message?.includes('PERMISSION_DENIED') ||
        err.message?.includes('Missing or insufficient permissions');
      sendJson(res, 500, {
        success: false,
        configured: false,
        provider: 'unknown',
        error: err.message || 'Failed to process test notification',
        errorType: isPermissionDenied ? 'permission_denied' : 'server_error',
      });
    }
    return true;
  }

  // Event Notification Trigger
  if (url === '/api/notifications/dispatch' && method === 'POST') {
    try {
      const user = await verifyAuthToken(req);
      if (!user) {
        sendJson(res, 401, { error: 'Authentication required' });
        return true;
      }

      const body = await parseBody(req);
      const eventType = body.eventType;
      if (!eventType || (eventType !== 'reflection_ready' && eventType !== 'streak_milestone')) {
        sendJson(res, 400, { error: 'Invalid or missing eventType' });
        return true;
      }

      const result = await dispatchEventNotification(
        user.uid,
        user.email || '',
        eventType,
        {
          streak: body.streak,
          clientSettings: body.clientSettings,
        },
        user.idToken
      );

      sendJson(res, 200, result);
    } catch (err: any) {
      console.error('[Notification Trigger] Unhandled error in /api/notifications/dispatch:', err);
      sendJson(res, 500, { error: err.message || 'Failed to dispatch notification' });
    }
    return true;
  }

  // Scheduled Cron endpoint (Protected via CRON_SECRET or Google Cloud Scheduler header)
  if (url === '/api/notifications/scheduled-cron' && (method === 'POST' || method === 'GET')) {
    try {
      const authHeader = req.headers.authorization;
      const cloudSchedulerHeader = req.headers['x-cloudscheduler'] as string | undefined;
      const result = await handleScheduledCron(authHeader, cloudSchedulerHeader);
      sendJson(res, 200, result);
    } catch (err: any) {
      sendJson(res, err.statusCode || 401, {
        error: err.message || 'Scheduled cron invocation unauthorized',
      });
    }
    return true;
  }

  return false;
}
