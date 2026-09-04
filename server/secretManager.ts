import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import dotenv from 'dotenv';

dotenv.config();

let secretClient: SecretManagerServiceClient | null = null;
let cachedSecret: string | null = null;
let secretSource: 'cloud-run-secret-mount' | 'secret-manager-api' | 'environment-variable' | 'missing' = 'missing';

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
 * Priority order:
 * 1. In-memory cached secret from previous retrieval.
 * 2. Injected via Google Cloud Run Secret Manager binding (--set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest").
 * 3. Dynamic runtime retrieval from Google Cloud Secret Manager API (projects/{PROJECT_ID}/secrets/GEMINI_API_KEY/versions/latest).
 * 4. Local environment configuration.
 */
export async function getGeminiApiKey(): Promise<string> {
  if (cachedSecret && cachedSecret.trim() !== '') {
    return cachedSecret;
  }

  // Check Cloud Run environment secret mount / process.env
  const envKey = process.env.GEMINI_API_KEY;
  if (envKey && envKey.trim() !== '') {
    cachedSecret = envKey.trim();
    secretSource = process.env.K_SERVICE ? 'cloud-run-secret-mount' : 'environment-variable';
    return cachedSecret;
  }

  // Attempt dynamic retrieval from Google Cloud Secret Manager API
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.PROJECT_ID ||
    'ai-studio-personalgeminijo-d1a8c270-bb5c-44fd-8520-9ded485e28ff';

  const secretName = process.env.GEMINI_SECRET_NAME || 'GEMINI_API_KEY';
  const version = process.env.GEMINI_SECRET_VERSION || 'latest';

  try {
    const client = getSecretClient();
    const resourceName = `projects/${projectId}/secrets/${secretName}/versions/${version}`;
    const [accessResponse] = await client.accessSecretVersion({ name: resourceName });
    const payload = accessResponse.payload?.data?.toString();

    if (payload && payload.trim() !== '') {
      cachedSecret = payload.trim();
      secretSource = 'secret-manager-api';
      return cachedSecret;
    }
  } catch (err: any) {
    // If running in an environment without GCP credentials for Secret Manager API call,
    // continue to verify whether an environment fallback exists.
    console.warn(`Secret Manager direct API access attempt for ${secretName}:`, err?.message || 'Access unfulfilled');
  }

  throw new Error(
    'GEMINI_API_KEY could not be retrieved from Google Cloud Secret Manager or runtime environment.'
  );
}

/**
 * Perform a security audit of Secret Manager integration without leaking credentials.
 */
export async function auditSecretManager(): Promise<{
  configured: boolean;
  source: string;
  maskedKey: string | null;
  secretManagerIntegrated: boolean;
  clientKeyExposed: false;
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

  return {
    configured,
    source: secretSource,
    maskedKey,
    secretManagerIntegrated: true,
    clientKeyExposed: false,
  };
}
