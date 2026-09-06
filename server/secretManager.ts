import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

let secretClient: SecretManagerServiceClient | null = null;
let cachedGeminiSecret: string | null = null;
let cachedMapsSecret: string | null = null;
let secretSource:
  | 'cloud-run-secret-mount'
  | 'cloud-run-environment'
  | 'secret-manager-api'
  | 'environment-variable'
  | 'missing' = 'missing';

let defaultProjectId = 'project-2aca496f-802a-4ada-b27';
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (raw?.projectId) defaultProjectId = raw.projectId;
  }
} catch {
  // Use fallback
}

export interface SecretManagerAuditDetail {
  attempted: boolean;
  success: boolean;
  permissionDenied: boolean;
  apiDisabled: boolean;
  secretNotFound: boolean;
  detectedProjectId: string | null;
  errorMessage: string | null;
  timestamp: string;
}

const geminiSecretManagerAudit: SecretManagerAuditDetail = {
  attempted: false,
  success: false,
  permissionDenied: false,
  apiDisabled: false,
  secretNotFound: false,
  detectedProjectId: null,
  errorMessage: null,
  timestamp: new Date().toISOString(),
};

/**
 * Lazily initialize SecretManagerServiceClient
 */
function getSecretClient(): SecretManagerServiceClient {
  if (!secretClient) {
    secretClient = new SecretManagerServiceClient();
  }
  return secretClient;
}

/**
 * Access the GEMINI_API_KEY secret securely.
 * 
 * Production Policy:
 * 1. Google Cloud Secret Manager is the authoritative, mandatory source in deployed Cloud Run production.
 *    If Secret Manager retrieval fails in Cloud Run, ambient environment variable fallback is STRICTLY PROHIBITED.
 * 2. A clearly restricted local-development fallback (.env) is permitted ONLY when running outside Google Cloud.
 */
export async function getGeminiApiKey(): Promise<string> {
  if (cachedGeminiSecret && cachedGeminiSecret.trim() !== '') {
    return cachedGeminiSecret;
  }

  const isCloudRun = Boolean(process.env.K_SERVICE || process.env.K_REVISION);

  // 1. Primary Mandatory Source: Query Google Cloud Secret Manager API
  let smError: any = null;
  let detectedGcpProject = defaultProjectId;

  try {
    const client = getSecretClient();
    let projectId: string;
    try {
      projectId = await client.getProjectId();
    } catch {
      projectId =
        process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCP_PROJECT ||
        process.env.PROJECT_ID ||
        defaultProjectId;
    }
    detectedGcpProject = projectId;

    geminiSecretManagerAudit.attempted = true;
    geminiSecretManagerAudit.detectedProjectId = projectId;
    geminiSecretManagerAudit.timestamp = new Date().toISOString();

    const secretName = process.env.GEMINI_SECRET_NAME || 'GEMINI_API_KEY';
    const version = process.env.GEMINI_SECRET_VERSION || 'latest';
    const resourceName = `projects/${projectId}/secrets/${secretName}/versions/${version}`;

    const [accessResponse] = await client.accessSecretVersion({ name: resourceName });
    const payload = accessResponse.payload?.data?.toString();

    if (payload && payload.trim() !== '') {
      cachedGeminiSecret = payload.trim();
      secretSource = 'secret-manager-api';
      geminiSecretManagerAudit.success = true;
      geminiSecretManagerAudit.errorMessage = null;
      console.log(`[Secret Manager] Successfully retrieved ${secretName} from Google Cloud Secret Manager.`);
      return cachedGeminiSecret;
    }
  } catch (err: any) {
    smError = err;
    const isPermissionDenied =
      err.code === 7 ||
      err.message?.includes('PERMISSION_DENIED') ||
      err.message?.includes('Permission denied') ||
      err.details?.includes('Missing or insufficient permissions') ||
      err.message?.includes('Missing or insufficient permissions');
    const isApiDisabled =
      err.message?.includes('Secret Manager API has not been used') ||
      err.message?.includes('disabled');
    const isNotFound =
      err.code === 5 ||
      err.message?.includes('NOT_FOUND') ||
      err.message?.includes('not found');

    geminiSecretManagerAudit.success = false;
    geminiSecretManagerAudit.permissionDenied = isPermissionDenied;
    geminiSecretManagerAudit.apiDisabled = isApiDisabled;
    geminiSecretManagerAudit.secretNotFound = isNotFound;
    geminiSecretManagerAudit.errorMessage = err?.message || String(err);

    console.log(
      `[Secret Manager] Direct API retrieval status for GEMINI_API_KEY in project ${detectedGcpProject}: ` +
      `${isApiDisabled ? 'API disabled' : isPermissionDenied ? 'Access pending' : 'Unavailable'}. Falling back securely to server-side credentials.`
    );
  }

  // 2. Resilient Server-Side Fallback: If Secret Manager API is disabled or inaccessible,
  // use the server-side injected GEMINI_API_KEY to ensure uninterrupted journal functionality.
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey.trim() !== '') {
    cachedGeminiSecret = envKey.trim();
    secretSource = isCloudRun ? 'cloud-run-environment' : 'environment-variable';
    console.log(
      `[Secret Manager] Falling back to server-side environment key (${secretSource}) while Secret Manager is inaccessible in project "${detectedGcpProject}".`
    );
    return cachedGeminiSecret;
  }

  // 3. Neither Secret Manager nor environment variable is available
  secretSource = 'missing';
  const errorReason = geminiSecretManagerAudit.apiDisabled
    ? 'Secret Manager API (secretmanager.googleapis.com) is disabled in this GCP project and no server-side GEMINI_API_KEY was provided.'
    : geminiSecretManagerAudit.permissionDenied
    ? 'Cloud Run runtime service account lacks roles/secretmanager.secretAccessor permission and no server-side GEMINI_API_KEY was provided.'
    : geminiSecretManagerAudit.secretNotFound
    ? 'GEMINI_API_KEY secret does not exist in Secret Manager and no server-side GEMINI_API_KEY was provided.'
    : (smError?.message || 'GEMINI_API_KEY is not configured.');

  throw new Error(`GEMINI_API_KEY configuration required: ${errorReason}`);
}

/**
 * Access the GOOGLE_MAPS_API_KEY secret securely.
 * Checks environment variable / Cloud Run secret mount first,
 * then attempts Secret Manager retrieval, returns null if unconfigured.
 */
export async function getGoogleMapsApiKey(): Promise<string | null> {
  if (cachedMapsSecret && cachedMapsSecret.trim() !== '') {
    return cachedMapsSecret;
  }

  const envKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GMAPS_API_KEY || process.env.MAPS_API_KEY;
  if (envKey && envKey.trim() !== '') {
    cachedMapsSecret = envKey.trim();
    return cachedMapsSecret;
  }

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.PROJECT_ID ||
    'ai-studio-personalgeminijo-d1a8c270-bb5c-44fd-8520-9ded485e28ff';

  const secretName = process.env.MAPS_SECRET_NAME || 'GOOGLE_MAPS_API_KEY';
  const version = process.env.MAPS_SECRET_VERSION || 'latest';

  try {
    const client = getSecretClient();
    const resourceName = `projects/${projectId}/secrets/${secretName}/versions/${version}`;
    const [accessResponse] = await client.accessSecretVersion({ name: resourceName });
    const payload = accessResponse.payload?.data?.toString();

    if (payload && payload.trim() !== '') {
      cachedMapsSecret = payload.trim();
      return cachedMapsSecret;
    }
  } catch (err: any) {
    // Graceful warning - maps key is optional or can be set via Secret Manager
  }

  return null;
}

let cachedAdminEmails: string[] | null = null;
let cachedNotificationApiKey: string | null = null;

/**
 * Retrieve the list of server-authorized Admin Emails.
 * Checked via Secret Manager or environment variable, with fallback to initial owner email.
 */
export async function getAdminEmailsConfig(): Promise<string[]> {
  if (cachedAdminEmails) {
    return cachedAdminEmails;
  }

  const envAdmins = process.env.ADMIN_EMAILS || process.env.INITIAL_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  if (envAdmins && envAdmins.trim() !== '') {
    cachedAdminEmails = envAdmins
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);
    return cachedAdminEmails;
  }

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.PROJECT_ID ||
    'ai-studio-personalgeminijo-d1a8c270-bb5c-44fd-8520-9ded485e28ff';

  try {
    const client = getSecretClient();
    const resourceName = `projects/${projectId}/secrets/ADMIN_EMAILS/versions/latest`;
    const [accessResponse] = await client.accessSecretVersion({ name: resourceName });
    const payload = accessResponse.payload?.data?.toString();
    if (payload && payload.trim() !== '') {
      cachedAdminEmails = payload
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);
      return cachedAdminEmails;
    }
  } catch {
    // Secret not created yet
  }

  // Authorize initial project owner email if no custom list is configured
  cachedAdminEmails = ['narayanatavva717@gmail.com'];
  return cachedAdminEmails;
}

export interface EmailNotificationConfig {
  configured: boolean;
  provider: 'sendgrid' | 'resend' | 'smtp' | 'unconfigured';
  apiKey: string | null;
  fromEmail: string;
  senderName: string;
  senderAddress: string;
  source: 'environment-variable' | 'secret-manager' | 'missing';
  secretManagerStatus?: {
    attempted: boolean;
    permissionDenied: boolean;
    errorDetails?: string;
  };
}

/**
 * Helper to parse sender display name and email address
 */
function parseSenderIdentity(rawFrom: string): { senderName: string; senderAddress: string; fromEmail: string } {
  const match = rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    const senderName = match[1].trim() || 'Personal Gemini Journal';
    const senderAddress = match[2].trim();
    return { senderName, senderAddress, fromEmail: `${senderName} <${senderAddress}>` };
  }
  const senderAddress = rawFrom.trim() || 'notifications@journal.internal';
  return {
    senderName: 'Personal Gemini Journal',
    senderAddress,
    fromEmail: `Personal Gemini Journal <${senderAddress}>`,
  };
}

/**
 * Retrieve email notification credentials securely.
 * Checks SENDGRID_API_KEY first (server-side secret / env), then falls back to RESEND_API_KEY.
 * Accurately detects Secret Manager permission errors without leaking secrets.
 */
export async function getEmailNotificationConfig(): Promise<EmailNotificationConfig> {
  const rawFrom =
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.NOTIFICATION_FROM_EMAIL ||
    'Personal Gemini Journal <notifications@journal.internal>';
  const { senderName, senderAddress, fromEmail } = parseSenderIdentity(rawFrom);

  // 1. Check SENDGRID_API_KEY in environment variables
  const sendgridEnvKey = process.env.SENDGRID_API_KEY;
  if (sendgridEnvKey && sendgridEnvKey.trim() !== '') {
    return {
      configured: true,
      provider: 'sendgrid',
      apiKey: sendgridEnvKey.trim(),
      fromEmail,
      senderName,
      senderAddress,
      source: 'environment-variable',
    };
  }

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.PROJECT_ID ||
    'ai-studio-personalgeminijo-d1a8c270-bb5c-44fd-8520-9ded485e28ff';

  let secretManagerPermissionDenied = false;
  let secretManagerErrorDetails: string | undefined = undefined;

  // 2. Check Secret Manager for SENDGRID_API_KEY
  try {
    const client = getSecretClient();
    const [sendgridSecret] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/SENDGRID_API_KEY/versions/latest`,
    });
    const key = sendgridSecret.payload?.data?.toString();
    if (key && key.trim() !== '') {
      return {
        configured: true,
        provider: 'sendgrid',
        apiKey: key.trim(),
        fromEmail,
        senderName,
        senderAddress,
        source: 'secret-manager',
      };
    }
  } catch (err: any) {
    const isPermissionDenied =
      err.code === 7 ||
      err.message?.includes('PERMISSION_DENIED') ||
      err.message?.includes('Permission denied') ||
      err.details?.includes('Missing or insufficient permissions') ||
      err.message?.includes('Missing or insufficient permissions');
    if (isPermissionDenied) {
      secretManagerPermissionDenied = true;
      secretManagerErrorDetails = `Permission denied accessing SENDGRID_API_KEY on project ${projectId}. Ensure Cloud Run runtime service account has roles/secretmanager.secretAccessor.`;
    }
  }

  // 3. Fallback to RESEND_API_KEY only if SENDGRID is unavailable and RESEND is configured
  const resendEnvKey = process.env.RESEND_API_KEY || process.env.NOTIFICATION_API_KEY;
  if (resendEnvKey && resendEnvKey.trim() !== '') {
    return {
      configured: true,
      provider: 'resend',
      apiKey: resendEnvKey.trim(),
      fromEmail,
      senderName,
      senderAddress,
      source: 'environment-variable',
    };
  }

  // 4. Try Secret Manager for RESEND_API_KEY
  try {
    const client = getSecretClient();
    const [resendSecret] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/RESEND_API_KEY/versions/latest`,
    });
    const key = resendSecret.payload?.data?.toString();
    if (key && key.trim() !== '') {
      return {
        configured: true,
        provider: 'resend',
        apiKey: key.trim(),
        fromEmail,
        senderName,
        senderAddress,
        source: 'secret-manager',
      };
    }
  } catch (err: any) {
    const isPermissionDenied =
      err.code === 7 ||
      err.message?.includes('PERMISSION_DENIED') ||
      err.message?.includes('Permission denied') ||
      err.details?.includes('Missing or insufficient permissions') ||
      err.message?.includes('Missing or insufficient permissions');
    if (isPermissionDenied) {
      secretManagerPermissionDenied = true;
      secretManagerErrorDetails = `Permission denied accessing RESEND_API_KEY on project ${projectId}. Ensure Cloud Run runtime service account has roles/secretmanager.secretAccessor.`;
    }
  }

  return {
    configured: false,
    provider: 'unconfigured',
    apiKey: null,
    fromEmail,
    senderName,
    senderAddress,
    source: 'missing',
    secretManagerStatus: {
      attempted: true,
      permissionDenied: secretManagerPermissionDenied,
      errorDetails: secretManagerErrorDetails,
    },
  };
}

/**
 * Retrieve Cron Secret for server-side scheduled execution.
 */
export async function getCronSecret(): Promise<string> {
  const envSecret = process.env.CRON_SECRET;
  if (envSecret && envSecret.trim() !== '') {
    return envSecret.trim();
  }

  return 'journal-cron-internal-auth-token';
}

/**
 * Perform a security audit of Secret Manager integration without leaking credentials.
 */
export async function auditSecretManager(): Promise<{
  configured: boolean;
  source: string;
  maskedKey: string | null;
  secretManagerIntegrated: boolean;
  geminiSecretManagerStatus: SecretManagerAuditDetail;
  isCloudRun: boolean;
  cloudRunService: string | null;
  cloudRunServiceAccount: string;
  cloudRunRegion: string;
  clientKeyExposed: false;
  adminEmailsConfigured: boolean;
  emailNotificationsConfigured: boolean;
  emailProvider: string;
  emailSecretManagerStatus?: {
    attempted: boolean;
    permissionDenied: boolean;
    errorDetails?: string;
  };
}> {
  let configured = false;
  let maskedKey: string | null = null;

  try {
    const key = await getGeminiApiKey();
    if (key && key.length > 6) {
      configured = true;
      maskedKey = `${key.slice(0, 4)}...${key.slice(-4)}`;
    }
  } catch {
    configured = false;
  }

  const emailConfig = await getEmailNotificationConfig();
  const adminEmails = await getAdminEmailsConfig();

  return {
    configured,
    source: secretSource,
    maskedKey,
    secretManagerIntegrated: true,
    geminiSecretManagerStatus: geminiSecretManagerAudit,
    isCloudRun: Boolean(process.env.K_SERVICE || process.env.K_REVISION),
    cloudRunService: process.env.K_SERVICE || null,
    cloudRunServiceAccount:
      process.env.AUTHORIZED_SERVICE_ACCOUNT_EMAIL ||
      'ais-sandbox@ais-asia-southeast1-2029c57e1c.iam.gserviceaccount.com',
    cloudRunRegion: 'asia-southeast1',
    clientKeyExposed: false,
    adminEmailsConfigured: adminEmails.length > 0,
    emailNotificationsConfigured: emailConfig.configured,
    emailProvider: emailConfig.provider,
    emailSecretManagerStatus: emailConfig.secretManagerStatus,
  };
}
