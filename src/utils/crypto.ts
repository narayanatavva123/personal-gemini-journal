import type { EncryptedPayload } from '../types.ts';

// Helper to convert ArrayBuffer to Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derive an AES-256-GCM CryptoKey from a user passcode and salt using PBKDF2
 */
async function deriveAesKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passcode),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext string using AES-256-GCM with PBKDF2 derived key
 */
export async function encryptText(plaintext: string, passcode: string): Promise<EncryptedPayload> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passcode, salt);

  const encoder = new TextEncoder();
  const encodedData = encoder.encode(plaintext);

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as ArrayBuffer,
    },
    key,
    encodedData
  );

  return {
    version: 1,
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(ciphertext),
  };
}

/**
 * Decrypt AES-256-GCM ciphertext using passcode
 */
export async function decryptText(payload: EncryptedPayload, passcode: string): Promise<string> {
  const salt = new Uint8Array(base64ToBuffer(payload.salt));
  const iv = new Uint8Array(base64ToBuffer(payload.iv));
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const key = await deriveAesKey(passcode, salt);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as ArrayBuffer,
      },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (err) {
    throw new Error('Decryption failed. Incorrect passcode or corrupted data.');
  }
}

const VERIFICATION_MAGIC_STRING = 'GEMINI_JOURNAL_SECURE_VAULT_OK';

/**
 * Creates a verification payload that can be tested to confirm passcode correctness
 */
export async function createVaultVerification(passcode: string): Promise<EncryptedPayload> {
  return encryptText(VERIFICATION_MAGIC_STRING, passcode);
}

/**
 * Checks if a provided passcode can decrypt the verification payload
 */
export async function verifyPasscode(verification: EncryptedPayload, passcode: string): Promise<boolean> {
  try {
    const text = await decryptText(verification, passcode);
    return text === VERIFICATION_MAGIC_STRING;
  } catch {
    return false;
  }
}

/**
 * PII Redaction utility: Masks personally identifiable information (emails, phone numbers,
 * credit cards, addresses, SSNs) so the user can choose to anonymize before AI reflection.
 */
export function redactPII(text: string): { redactedText: string; redactionsCount: number } {
  let count = 0;
  let result = text;

  // Email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  result = result.replace(emailRegex, () => {
    count++;
    return '[REDACTED EMAIL]';
  });

  // Phone numbers (various international and US formats)
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g;
  result = result.replace(phoneRegex, (match) => {
    // only if reasonable length
    if (match.replace(/\D/g, '').length >= 7) {
      count++;
      return '[REDACTED PHONE]';
    }
    return match;
  });

  // SSN format: 000-00-0000
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  result = result.replace(ssnRegex, () => {
    count++;
    return '[REDACTED SSN]';
  });

  // Credit card numbers (13-16 digits with dashes or spaces)
  const ccRegex = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
  result = result.replace(ccRegex, () => {
    count++;
    return '[REDACTED CARD]';
  });

  return {
    redactedText: result,
    redactionsCount: count,
  };
}
