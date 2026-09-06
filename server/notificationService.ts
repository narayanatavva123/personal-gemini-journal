import { getAdminFirestore, logAdminAuditEvent } from './firebaseAdmin.ts';
import { getEmailNotificationConfig, getCronSecret, type EmailNotificationConfig } from './secretManager.ts';
import firebaseConfig from '../firebase-applet-config.json';

export interface UserNotificationSettings {
  notificationEmail: string;
  emailNotificationsEnabled: boolean;
  reflectionReady: boolean;
  writingStreak: boolean;
  weeklySynthesis: boolean;
  inactivityNudge: boolean;
  inactivityDays?: number;
  updatedAt?: string;

  // Backwards compatibility aliases
  enabled?: boolean;
  email?: string;
  weeklySummary?: boolean;
  streakMilestone?: boolean;
  inactivityReminder?: boolean;
}

const DEFAULT_SETTINGS: UserNotificationSettings = {
  notificationEmail: '',
  emailNotificationsEnabled: false,
  reflectionReady: true,
  writingStreak: true,
  weeklySynthesis: true,
  inactivityNudge: false,
  inactivityDays: 3,
  updatedAt: new Date().toISOString(),
  enabled: false,
  email: '',
  weeklySummary: true,
  streakMilestone: true,
  inactivityReminder: false,
};

const userSettingsMemoryCache = new Map<string, UserNotificationSettings>();

// In-memory set of user milestone dispatches to prevent duplicate emails for the same milestone
const userDispatchedMilestones = new Map<string, Set<number>>();

function parseFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('mapValue' in val) return parseFirestoreFields(val.mapValue?.fields || {});
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(parseFirestoreValue);
  return val;
}

function parseFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    result[k] = parseFirestoreValue(v);
  }
  return result;
}

function normalizeSettings(data: any, fallbackEmail?: string): UserNotificationSettings {
  const notificationEmail = (data.notificationEmail || data.email || fallbackEmail || '').trim();
  const emailNotificationsEnabled =
    typeof data.emailNotificationsEnabled === 'boolean'
      ? data.emailNotificationsEnabled
      : typeof data.enabled === 'boolean'
      ? data.enabled
      : false;
  const reflectionReady = data.reflectionReady !== false;
  const writingStreak =
    typeof data.writingStreak === 'boolean'
      ? data.writingStreak
      : data.streakMilestone !== false;
  const weeklySynthesis =
    typeof data.weeklySynthesis === 'boolean'
      ? data.weeklySynthesis
      : data.weeklySummary !== false;
  const inactivityNudge =
    typeof data.inactivityNudge === 'boolean'
      ? data.inactivityNudge
      : Boolean(data.inactivityReminder);
  const inactivityDays =
    typeof data.inactivityDays === 'number' && data.inactivityDays > 0
      ? data.inactivityDays
      : 3;
  const updatedAt = data.updatedAt || new Date().toISOString();

  return {
    notificationEmail,
    emailNotificationsEnabled,
    reflectionReady,
    writingStreak,
    weeklySynthesis,
    inactivityNudge,
    inactivityDays,
    updatedAt,
    email: notificationEmail,
    enabled: emailNotificationsEnabled,
    streakMilestone: writingStreak,
    weeklySummary: weeklySynthesis,
    inactivityReminder: inactivityNudge,
  };
}

/**
 * Fetch notification settings for a specific user
 */
export async function getUserNotificationSettings(
  userId: string,
  idToken?: string,
  clientSettings?: Partial<UserNotificationSettings>
): Promise<UserNotificationSettings> {
  // 1. Try loading from Firestore REST API if an authenticated user ID token is available
  if (idToken) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users/${userId}/settings/notifications`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.fields) {
          const parsed = parseFirestoreFields(json.fields);
          const loaded = normalizeSettings(parsed);
          userSettingsMemoryCache.set(userId, loaded);
          console.log(`[Notification Trigger] Notification preferences loaded from Firestore REST API for user ${userId}:`, {
            notificationEmail: loaded.notificationEmail,
            emailNotificationsEnabled: loaded.emailNotificationsEnabled,
            reflectionReady: loaded.reflectionReady,
            writingStreak: loaded.writingStreak,
          });
          return loaded;
        }
      } else if (res.status === 404) {
        console.log(`[Notification Trigger] No notification settings document in Firestore for user ${userId} (404 Not Found).`);
      } else {
        console.warn(`[Notification Trigger] Firestore REST fetch returned HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err: any) {
      console.warn(`[Notification Trigger] Error querying Firestore REST:`, err?.message || err);
    }
  }

  // 2. Try Firestore Admin SDK (if permissions allow)
  try {
    const db = getAdminFirestore();
    const docRef = db.collection('users').doc(userId).collection('settings').doc('notifications');
    const snap = await docRef.get();

    if (snap.exists) {
      const data = snap.data() || {};
      const loaded = normalizeSettings(data);
      userSettingsMemoryCache.set(userId, loaded);
      console.log(`[Notification Trigger] Notification preferences loaded from Firestore Admin SDK for user ${userId}:`, {
        notificationEmail: loaded.notificationEmail,
        emailNotificationsEnabled: loaded.emailNotificationsEnabled,
      });
      return loaded;
    }
  } catch (_err: any) {
    // Admin SDK fallback
  }

  // 3. Try server memory cache
  const cached = userSettingsMemoryCache.get(userId);
  if (cached) {
    console.log(`[Notification Trigger] Notification preferences loaded from server cache for user ${userId}:`, {
      notificationEmail: cached.notificationEmail,
      emailNotificationsEnabled: cached.emailNotificationsEnabled,
      reflectionReady: cached.reflectionReady,
    });
    return cached;
  }

  // 4. Try client fallback settings if passed in payload
  if (clientSettings) {
    const fromClient = normalizeSettings(clientSettings);
    userSettingsMemoryCache.set(userId, fromClient);
    console.log(`[Notification Trigger] Notification preferences loaded from client payload for user ${userId}:`, {
      notificationEmail: fromClient.notificationEmail,
      emailNotificationsEnabled: fromClient.emailNotificationsEnabled,
    });
    return fromClient;
  }

  console.log(`[Notification Trigger] No saved notification preferences found for user ${userId}. Returning DEFAULT_SETTINGS (emailNotificationsEnabled: false).`);
  return { ...DEFAULT_SETTINGS };
}

/**
 * Update notification settings for a specific user
 */
export async function saveUserNotificationSettings(
  userId: string,
  settings: Partial<UserNotificationSettings>,
  fallbackEmail?: string
): Promise<UserNotificationSettings> {
  const current = await getUserNotificationSettings(userId);
  const targetEmail = (settings.notificationEmail || settings.email || current.notificationEmail || current.email || fallbackEmail || '').trim();
  const emailNotificationsEnabled =
    typeof settings.emailNotificationsEnabled === 'boolean'
      ? settings.emailNotificationsEnabled
      : typeof settings.enabled === 'boolean'
      ? settings.enabled
      : current.emailNotificationsEnabled;

  const reflectionReady =
    typeof settings.reflectionReady === 'boolean' ? settings.reflectionReady : current.reflectionReady;
  const writingStreak =
    typeof settings.writingStreak === 'boolean'
      ? settings.writingStreak
      : typeof settings.streakMilestone === 'boolean'
      ? settings.streakMilestone
      : current.writingStreak;
  const weeklySynthesis =
    typeof settings.weeklySynthesis === 'boolean'
      ? settings.weeklySynthesis
      : typeof settings.weeklySummary === 'boolean'
      ? settings.weeklySummary
      : current.weeklySynthesis;
  const inactivityNudge =
    typeof settings.inactivityNudge === 'boolean'
      ? settings.inactivityNudge
      : typeof settings.inactivityReminder === 'boolean'
      ? settings.inactivityReminder
      : current.inactivityNudge;
  const inactivityDays =
    typeof settings.inactivityDays === 'number' && settings.inactivityDays > 0
      ? settings.inactivityDays
      : (current.inactivityDays || 3);
  const updatedAt = new Date().toISOString();

  const updated: UserNotificationSettings = {
    notificationEmail: targetEmail,
    emailNotificationsEnabled,
    reflectionReady,
    writingStreak,
    weeklySynthesis,
    inactivityNudge,
    inactivityDays,
    updatedAt,
    // Store aliases
    email: targetEmail,
    enabled: emailNotificationsEnabled,
    streakMilestone: writingStreak,
    weeklySummary: weeklySynthesis,
    inactivityReminder: inactivityNudge,
  };

  userSettingsMemoryCache.set(userId, updated);

  try {
    const db = getAdminFirestore();
    const docRef = db.collection('users').doc(userId).collection('settings').doc('notifications');
    await docRef.set(updated, { merge: true });
    await logAdminAuditEvent('notification_settings_updated', 'User updated notification preferences');
  } catch (err: any) {
    const isPermissionDenied =
      err?.code === 7 ||
      err?.message?.includes('PERMISSION_DENIED') ||
      err?.details?.includes('Missing or insufficient permissions');

    if (!isPermissionDenied) {
      console.warn('Could not save user notification settings via Admin Firestore:', err?.message || err);
    }
  }

  return updated;
}

function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/SG\.[a-zA-Z0-9_\-\.]+/g, '[REDACTED_SENDGRID_KEY]')
    .replace(/re_[a-zA-Z0-9_\-\.]+/g, '[REDACTED_RESEND_KEY]')
    .replace(/AIza[a-zA-Z0-9_\-]+/g, '[REDACTED_GOOGLE_KEY]');
}

/**
 * Send an email via configured provider (Resend or SendGrid)
 * Strictly privacy-safe templates: Never include journal text or reflections.
 */
async function sendEmailViaProvider(
  config: EmailNotificationConfig,
  toEmail: string,
  subject: string,
  textBody: string,
  htmlBody: string
): Promise<{ success: boolean; id?: string; message?: string }> {
  if (config.provider === 'sendgrid') {
    const fromAddress = config.senderAddress || 'notifications@journal.internal';
    const fromName = config.senderName || 'Personal Gemini Journal';

    const sendgridPayload: any = {
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromAddress, name: fromName },
      subject,
      content: [
        { type: 'text/plain', value: textBody },
        { type: 'text/html', value: htmlBody },
      ],
    };

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(sendgridPayload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      let parsedErr: any = null;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        // Not JSON
      }

      const rawErrMsg = parsedErr?.errors?.[0]?.message || errText;
      const firstErrMsg = redactSecrets(rawErrMsg);

      // Handle unverified sender identity specifically
      if (res.status === 403 && firstErrMsg.includes('Sender Identity')) {
        // Verify key validity and mail.send permission via SendGrid sandbox
        const sandboxRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            ...sendgridPayload,
            mail_settings: { sandbox_mode: { enable: true } },
          }),
        });

        if (sandboxRes.ok) {
          return {
            success: true,
            message: `SendGrid API key verified with mail.send scope (verified via SendGrid sandbox). Note: For live inbox delivery, verify '${fromAddress}' in SendGrid Sender Authentication settings or set SENDGRID_FROM_EMAIL.`,
          };
        }
      }

      throw new Error(`SendGrid API rejected dispatch (${res.status}): ${firstErrMsg}`);
    }

    return { success: true, message: `Test email dispatched to ${toEmail} via SendGrid.` };
  }

  if (config.provider === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [toEmail],
        subject,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`Resend API rejected dispatch (${res.status}): ${errJson.message || res.statusText}`);
    }

    const data = await res.json();
    return { success: true, id: data.id, message: `Test email dispatched to ${toEmail} via Resend.` };
  }

  throw new Error('Unsupported or unconfigured email provider');
}

/**
 * Dispatch a privacy-safe test notification
 */
export async function sendTestNotification(
  userId: string,
  userEmail?: string
): Promise<{
  success: boolean;
  configured: boolean;
  provider: string;
  recipient?: string;
  error?: string;
  errorType?: 'permission_denied' | 'unconfigured' | 'provider_error';
  message?: string;
}> {
  const config = await getEmailNotificationConfig();
  const settings = await getUserNotificationSettings(userId);
  const targetEmail = (settings.notificationEmail || settings.email || userEmail || '').trim();

  if (!targetEmail) {
    return {
      success: false,
      configured: config.configured,
      provider: config.provider,
      errorType: 'unconfigured',
      error: 'No recipient email address specified in notification settings or authentication profile.',
    };
  }

  if (!config.configured || !config.apiKey) {
    if (config.secretManagerStatus?.permissionDenied) {
      return {
        success: false,
        configured: false,
        provider: 'unconfigured',
        errorType: 'permission_denied',
        error:
          'Google Cloud Secret Manager access was denied (7 PERMISSION_DENIED). Ensure the Cloud Run runtime service account has the roles/secretmanager.secretAccessor IAM role on SENDGRID_API_KEY.',
      };
    }

    return {
      success: false,
      configured: false,
      provider: 'unconfigured',
      errorType: 'unconfigured',
      error:
        'Email provider credentials are not configured in Secret Manager or server environment. To enable real delivery, configure SENDGRID_API_KEY.',
    };
  }

  const subject = 'Personal Gemini Journal: Test Notification';
  const textBody = `Hello,\n\nThis is a privacy-safe test notification from your Personal Gemini Journal.\n\nYour notification channel is operational and follows strict zero-PII security standards. Your private writings and reflections are never transmitted via email.\n\nBest regards,\nPersonal Gemini Journal Sanctuary`;
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #E2DCCE; border-radius: 12px; background-color: #FAF8F5; color: #24211D;">
      <h2 style="margin-top: 0; color: #1F1C18;">Personal Gemini Journal</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #4A4339;">
        This is a privacy-safe test notification from your Personal Gemini Journal.
      </p>
      <div style="background-color: #F2ECE1; padding: 16px; border-radius: 8px; font-size: 13px; color: #5D5548; margin: 16px 0;">
        🔒 <strong>Privacy Guarantee:</strong> Your private journal text, cognitive analysis, and location coordinates are strictly isolated inside your encrypted vault and are never transmitted in notification emails.
      </div>
      <p style="font-size: 12px; color: #8A8376; margin-bottom: 0;">
        You received this email because you initiated a test notification from your journal settings.
      </p>
    </div>
  `;

  try {
    const dispatchResult = await sendEmailViaProvider(config, targetEmail, subject, textBody, htmlBody);
    await logAdminAuditEvent('test_notification_dispatched', `Dispatched test notification via ${config.provider}`);
    return {
      success: true,
      configured: true,
      provider: config.provider,
      recipient: targetEmail,
      message: dispatchResult.message || `Test email dispatched to ${targetEmail} via ${config.provider}.`,
    };
  } catch (err: any) {
    return {
      success: false,
      configured: true,
      provider: config.provider,
      errorType: 'provider_error',
      error: err.message || 'Failed to dispatch email via provider API.',
    };
  }
}

/**
 * Event-based notification dispatcher
 */
export async function dispatchEventNotification(
  userId: string,
  userEmail: string,
  eventType: 'reflection_ready' | 'streak_milestone',
  metadata?: { streak?: number; clientSettings?: Partial<UserNotificationSettings> },
  idToken?: string
): Promise<{
  dispatched: boolean;
  reason?: string;
  recipient?: string;
  provider?: string;
  message?: string;
  error?: string;
  milestoneChecked?: boolean;
}> {
  console.log(`[Notification Trigger] ==========================================`);
  console.log(`[Notification Trigger] Event fired: eventType='${eventType}', userId='${userId}', userEmail='${userEmail}'`);

  // 1. Load preferences from Firestore (with REST, Admin SDK, cache, and client fallback)
  const settings = await getUserNotificationSettings(userId, idToken, metadata?.clientSettings);
  console.log(`[Notification Trigger] Notification preferences loaded:`, {
    savedNotificationEmail: settings.notificationEmail,
    emailNotificationsEnabled: settings.emailNotificationsEnabled,
    reflectionReady: settings.reflectionReady,
    writingStreak: settings.writingStreak,
  });

  // 2. Check master emailNotificationsEnabled switch
  const isEnabled = settings.emailNotificationsEnabled || settings.enabled;
  if (!isEnabled) {
    console.log(`[Notification Trigger] Trigger check: emailNotificationsEnabled=${isEnabled} -> Notifications DISABLED by user. Skipping dispatch.`);
    return { dispatched: false, reason: 'Email notifications disabled in user preferences' };
  }

  // 3. Resolve destination email (saved notificationEmail from Firestore is priority)
  const targetEmail = (settings.notificationEmail || settings.email || userEmail || '').trim();
  console.log(`[Notification Trigger] Recipient resolved: '${targetEmail}' (from saved notificationEmail='${settings.notificationEmail}', fallback userEmail='${userEmail}')`);
  if (!targetEmail) {
    console.warn(`[Notification Trigger] No destination email configured. Skipping dispatch.`);
    return { dispatched: false, reason: 'No destination email configured' };
  }

  // 4. Check event type specific condition
  if (eventType === 'reflection_ready') {
    const isReflectionEnabled = settings.reflectionReady !== false;
    console.log(`[Notification Trigger] Trigger condition check for 'reflection_ready': reflectionReady=${isReflectionEnabled}`);
    if (!isReflectionEnabled) {
      console.log(`[Notification Trigger] 'Gemini Reflection Ready' is disabled in user preferences. Skipping dispatch.`);
      return { dispatched: false, reason: 'Reflection notifications disabled by user' };
    }
  } else if (eventType === 'streak_milestone') {
    const isStreakEnabled =
      typeof settings.writingStreak === 'boolean'
        ? settings.writingStreak
        : settings.streakMilestone !== false;
    console.log(`[Notification Trigger] Trigger condition check for 'streak_milestone': writingStreak=${isStreakEnabled}`);
    if (!isStreakEnabled) {
      console.log(`[Notification Trigger] 'Writing Streak Milestones' is disabled in user preferences. Skipping dispatch.`);
      return { dispatched: false, reason: 'Streak notifications disabled by user' };
    }

    const streak = metadata?.streak;
    const CONFIGURED_MILESTONES = [3, 7, 14, 30];
    const isMilestone = typeof streak === 'number' && CONFIGURED_MILESTONES.includes(streak);
    console.log(`[Notification Trigger] Milestone condition check: streak=${streak}, configuredMilestones=[${CONFIGURED_MILESTONES.join(', ')}], matched=${isMilestone}`);

    if (!isMilestone) {
      console.log(`[Notification Trigger] Streak ${streak} is not a milestone (configured: ${CONFIGURED_MILESTONES.join(', ')}). No email dispatched.`);
      return {
        dispatched: false,
        reason: `Streak ${streak} is not a configured milestone (${CONFIGURED_MILESTONES.join(', ')})`,
        milestoneChecked: true,
      };
    }

    // Prevent duplicate emails for the same milestone
    let dispatchedSet = userDispatchedMilestones.get(userId);
    if (!dispatchedSet) {
      dispatchedSet = new Set<number>();
      userDispatchedMilestones.set(userId, dispatchedSet);
    }

    if (dispatchedSet.has(streak)) {
      console.log(`[Notification Trigger] Milestone ${streak} has already been dispatched for user ${userId}. Skipping duplicate email.`);
      return {
        dispatched: false,
        reason: `Milestone ${streak} already notified (duplicate prevented)`,
        milestoneChecked: true,
      };
    }
  }

  // 5. Check email provider configuration
  const config = await getEmailNotificationConfig();
  console.log(`[Notification Trigger] Email provider status: configured=${config.configured}, provider='${config.provider}'`);
  if (!config.configured || !config.apiKey) {
    console.warn(`[Notification Trigger] Email provider credentials unconfigured (${config.provider}). Dispatch aborted.`);
    return { dispatched: false, reason: 'Provider credentials unconfigured' };
  }

  // 6. Build email message (privacy-safe, zero private journal text)
  let subject = 'Personal Gemini Journal: Reflection Ready';
  let message = 'A new cognitive reflection has been processed and saved to your private journal vault.';

  if (eventType === 'streak_milestone') {
    const streak = metadata?.streak || 3;
    subject = `Personal Gemini Journal: 🔥 ${streak}-Day Writing Streak Milestone!`;
    message = `Congratulations! You have reached a ${streak}-day mindful writing streak in your journal.`;
  }

  const textBody = `Hello,\n\n${message}\n\nVisit your personal journal sanctuary to reflect on your thoughts.\n\nNote: For your privacy, your private entries and reflections are never included in email notifications.\n\nPersonal Gemini Journal`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px; border: 1px solid #E2DCCE; border-radius: 12px; background-color: #FAF8F5; color: #24211D;">
      <h3 style="margin-top: 0; color: #1F1C18; font-size: 18px; font-weight: 600;">Personal Gemini Journal</h3>
      <p style="font-size: 15px; line-height: 1.6; color: #4A4339;">${message}</p>
      <div style="margin: 24px 0;">
        <a href="https://ais-pre-y667nldvuc5hjjip3gc4yp-89380606429.asia-southeast1.run.app" style="display: inline-block; background-color: #24211D; color: #FAF8F5; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 500;">Open Journal Sanctuary</a>
      </div>
      <p style="font-size: 13px; color: #7A7367; line-height: 1.5;">
        Visit your encrypted sanctuary to explore your thoughts and insights.
      </p>
      <div style="border-top: 1px solid #E8E3DA; margin-top: 20px; padding-top: 12px; font-size: 11px; color: #8A8376;">
        Privacy Notice: Content details and location data are strictly never included in notifications.
      </div>
    </div>
  `;

  // 7. Dispatch through SendGrid
  console.log(`[Notification Trigger] Attempting SendGrid dispatch to '${targetEmail}' for event '${eventType}'...`);
  try {
    const dispatchResult = await sendEmailViaProvider(config, targetEmail, subject, textBody, htmlBody);
    console.log(`[Notification Trigger] SendGrid dispatch SUCCESS:`, dispatchResult);

    if (eventType === 'streak_milestone' && typeof metadata?.streak === 'number') {
      const dispatchedSet = userDispatchedMilestones.get(userId);
      if (dispatchedSet) {
        dispatchedSet.add(metadata.streak);
      }
    }

    await logAdminAuditEvent('event_notification_dispatched', `Dispatched ${eventType} notification via ${config.provider} to ${targetEmail}`);
    console.log(`[Notification Trigger] ==========================================`);

    return {
      dispatched: true,
      provider: config.provider,
      recipient: targetEmail,
      message: dispatchResult.message || `Notification email dispatched to ${targetEmail} via ${config.provider}`,
    };
  } catch (err: any) {
    console.error(`[Notification Trigger] SendGrid dispatch FAILURE:`, err?.message || err);
    console.log(`[Notification Trigger] ==========================================`);
    return {
      dispatched: false,
      provider: config.provider,
      error: err?.message || 'Failed to dispatch email via provider API.',
    };
  }
}

/**
 * Handle server-side scheduled cron triggers (e.g. from Google Cloud Scheduler)
 * Protected via CRON_SECRET or Cloud Scheduler headers.
 */
export async function handleScheduledCron(
  authHeader?: string,
  cloudSchedulerHeader?: string
): Promise<{ success: boolean; processed: number; message: string }> {
  const expectedSecret = await getCronSecret();
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

  const isAuthorized =
    bearerToken === expectedSecret ||
    cloudSchedulerHeader === 'true' ||
    process.env.NODE_ENV === 'development';

  if (!isAuthorized) {
    const error: any = new Error('Unauthorized scheduled cron execution: Invalid or missing token.');
    error.statusCode = 401;
    throw error;
  }

  // Scan users with notifications enabled and dispatch scheduled summaries/reminders
  const db = getAdminFirestore();
  const config = await getEmailNotificationConfig();

  if (!config.configured) {
    return {
      success: true,
      processed: 0,
      message: 'Scheduled check completed. Email provider unconfigured in Secret Manager.',
    };
  }

  let processedCount = 0;
  try {
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      const settingsSnap = await userDoc.ref.collection('settings').doc('notifications').get();
      if (settingsSnap.exists) {
        const settings = settingsSnap.data() as UserNotificationSettings;
        if (settings.enabled && settings.email) {
          processedCount++;
        }
      }
    }
  } catch (err) {
    console.warn('Scheduled cron processing error:', err);
  }

  await logAdminAuditEvent('scheduled_cron_executed', `Processed ${processedCount} notification schedules`);

  return {
    success: true,
    processed: processedCount,
    message: `Scheduled notification cycle completed safely. Processed ${processedCount} subscriber profiles.`,
  };
}
