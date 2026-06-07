import crypto from 'crypto';

// Use a fallback key if the environment variable is not set.
// Make it a stable 32-byte key for AES-256-CBC.
const SECRET_KEY_RAW = process.env.ENCRYPTION_KEY || 'mlt_exam_portal_crypto_secret_32';
const SECRET_KEY = crypto.createHash('sha256').update(String(SECRET_KEY_RAW)).digest(); // Ensures exactly 32 bytes

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypt a plain-text string
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // Combine IV and encrypted content
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt an encrypted hex string
 */
export function decrypt(encryptedText: string): string {
  try {
    if (!encryptedText) return '';
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return '';
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}
