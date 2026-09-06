import { auth } from './firebase.ts';
import type {
  AdminAggregateStats,
  UserNotificationSettings,
  UserAuthProfile,
  ConversationMessage,
  ReflectionConversation,
} from '../types.ts';

/**
 * Get current user's Firebase Auth ID Token for Bearer authorization
 */
export async function getAuthHeader(): Promise<Record<string, string>> {
  if (!auth.currentUser) return {};
  try {
    const token = await auth.currentUser.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  } catch (err) {
    console.error('Failed to get Firebase ID token:', err);
    return { 'Content-Type': 'application/json' };
  }
}

/**
 * Verify user identity and role with the server
 */
export async function checkUserRole(): Promise<UserAuthProfile | null> {
  if (!auth.currentUser) return null;
  try {
    const headers = await getAuthHeader();
    const res = await fetch('/api/auth/me', { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Role verification request failed:', err);
    return null;
  }
}

/**
 * Fetch strictly aggregate metrics for Admin Dashboard
 * Protected endpoint: Returns 403 Forbidden if not authorized admin
 */
export async function fetchAdminStats(): Promise<AdminAggregateStats> {
  const headers = await getAuthHeader();
  const res = await fetch('/api/admin/stats', { headers });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    const error: any = new Error(errData.error || `Server responded with ${res.status}`);
    error.status = res.status;
    throw error;
  }

  return await res.json();
}

/**
 * Fetch owner-bound notification settings
 */
export async function fetchNotificationSettings(): Promise<UserNotificationSettings> {
  const headers = await getAuthHeader();
  const res = await fetch('/api/notifications/settings', { headers });

  if (!res.ok) {
    throw new Error('Failed to load notification settings.');
  }

  return await res.json();
}

/**
 * Save notification settings
 */
export async function saveNotificationSettings(
  settings: Partial<UserNotificationSettings>
): Promise<UserNotificationSettings> {
  const headers = await getAuthHeader();
  const res = await fetch('/api/notifications/settings', {
    method: 'POST',
    headers,
    body: JSON.stringify(settings),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errData.error || 'Failed to save notification settings.');
  }

  return await res.json();
}

/**
 * Send a test notification to verify provider credentials and deliverability
 */
export async function sendTestNotification(recipientEmail?: string): Promise<{
  success: boolean;
  configured: boolean;
  provider: string;
  recipient?: string;
  error?: string;
  errorType?: string;
  message?: string;
}> {
  const headers = await getAuthHeader();
  const res = await fetch('/api/notifications/test', {
    method: 'POST',
    headers,
    body: recipientEmail ? JSON.stringify({ email: recipientEmail }) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      configured: typeof data.configured === 'boolean' ? data.configured : false,
      provider: data.provider || 'unknown',
      error: data.error || `Dispatch failed with status ${res.status}`,
      errorType: data.errorType,
      message: data.message,
    };
  }

  return data;
}

/**
 * Fetch provider configuration status safely without exposing secrets
 */
export async function fetchNotificationStatus(): Promise<{
  configured: boolean;
  provider: string;
  source: string;
  senderAddress?: string;
  secretManagerStatus?: {
    attempted: boolean;
    permissionDenied: boolean;
    errorDetails?: string;
  };
}> {
  const headers = await getAuthHeader();
  const res = await fetch('/api/notifications/status', {
    method: 'GET',
    headers,
  });
  if (!res.ok) {
    throw new Error('Failed to fetch notification status');
  }
  return await res.json();
}

/**
 * Notify the server of an event trigger (e.g. reflection generated or milestone reached)
 */
export async function triggerNotificationEvent(
  eventType: 'reflection_ready' | 'streak_milestone',
  metadata?: { streak?: number; clientSettings?: any }
): Promise<{ dispatched: boolean; reason?: string; recipient?: string; provider?: string; message?: string; error?: string }> {
  try {
    const headers = await getAuthHeader();
    const res = await fetch('/api/notifications/dispatch', {
      method: 'POST',
      headers,
      body: JSON.stringify({ eventType, ...metadata }),
    });

    const data = await res.json().catch(() => ({}));
    console.log(`[Notification Trigger] /api/notifications/dispatch result for '${eventType}':`, data);
    return data;
  } catch (err: any) {
    console.warn(`[Notification Trigger] Error triggering '${eventType}' notification:`, err?.message || err);
    return { dispatched: false, reason: err?.message || 'Network error' };
  }
}

/**
 * Send a multi-turn follow-up question or reflection prompt to Gemini
 */
export async function sendReflectionChatMessage(params: {
  entryId: string;
  entryTitle?: string;
  entryText: string;
  initialReflection?: string;
  messages?: ConversationMessage[];
  history?: Array<{ role: 'user' | 'model'; content: string }>;
  message: string;
  mode?: string;
  conversationId?: string;
  conversationCreatedAt?: string;
}): Promise<{
  reply: string;
  timestamp: string;
  conversation: ReflectionConversation;
}> {
  const headers = await getAuthHeader();
  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Server responded with ${res.status}`);
  }

  return data;
}

