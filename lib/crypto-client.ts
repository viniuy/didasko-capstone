/**
 * Client-side decryption utilities
 * This file is safe to import in client components
 *
 * Note: This uses NEXT_PUBLIC_ prefix which means the key is exposed in the client bundle.
 * This provides obfuscation, not true security. Real security comes from:
 * - Authentication (server-side session validation)
 * - Authorization (permission checks)
 * - HTTPS (network encryption)
 * - Rate limiting
 */

import CryptoJS from "crypto-js";

// Client-accessible encryption key (exposed in browser bundle)
const SECRET_KEY =
  process.env.NEXT_PUBLIC_ENCRYPTION_KEY ||
  "didasko-secure-encryption-key-2025-change-in-production";

// Check if encryption is disabled
const DISABLE_ENCRYPTION =
  process.env.NEXT_PUBLIC_DISABLE_ENCRYPTION === "true";

/**
 * Decrypts AES-256 encrypted data on the client side
 * @param encryptedData - Encrypted string from server
 * @returns Decrypted and parsed JSON data
 */
export function decryptResponse(encryptedData: string): any {
  // If encryption is disabled, decode plain base64
  if (DISABLE_ENCRYPTION) {
    try {
      const plainText = atob(encryptedData);
      return JSON.parse(plainText);
    } catch (error) {
      console.error("Base64 decode error:", error);
      throw new Error("Failed to decode base64 data");
    }
  }

  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedStr) {
      console.error(
        "Decryption produced empty string - wrong key or corrupted data"
      );
      throw new Error("Decryption failed - invalid key or corrupted data");
    }

    return JSON.parse(decryptedStr);
  } catch (error) {
    console.error("Client-side decryption error:", error);
    throw new Error("Failed to decrypt response");
  }
}

/**
 * Check if encryption is currently enabled
 * @returns true if encryption is enabled
 */
export function isEncryptionEnabled(): boolean {
  return !DISABLE_ENCRYPTION;
}
