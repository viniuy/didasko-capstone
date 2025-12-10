/**
 * Server-side encryption utilities using AES-256
 * DO NOT IMPORT THIS IN CLIENT COMPONENTS
 *
 * Environment Variables:
 * - ENCRYPTION_KEY: Secret key for AES encryption (min 32 characters recommended)
 * - DISABLE_ENCRYPTION: Set to "true" to disable encryption for testing/debugging
 */

import CryptoJS from "crypto-js";

// Server-only encryption key (no NEXT_PUBLIC prefix)
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  "default-didasko-secret-key-change-in-production";

// Feature flag to disable encryption for testing
const DISABLE_ENCRYPTION = process.env.DISABLE_ENCRYPTION === "true";

/**
 * Encrypts data using AES-256 encryption
 * @param data - Any JSON-serializable data to encrypt
 * @returns Base64-encoded encrypted string
 */
export function encryptResponse(data: any): string {
  // If encryption is disabled, return plain JSON as base64
  if (DISABLE_ENCRYPTION) {
    const plainText = JSON.stringify(data);
    return Buffer.from(plainText).toString("base64");
  }

  try {
    const jsonString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(
      jsonString,
      ENCRYPTION_KEY
    ).toString();
    return encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt response");
  }
}

/**
 * Decrypts AES-256 encrypted data
 * @param encryptedData - Base64-encoded encrypted string
 * @returns Decrypted and parsed JSON data
 */
export function decryptResponse(encryptedData: string): any {
  // If encryption is disabled, decode plain base64
  if (DISABLE_ENCRYPTION) {
    console.log("Decryption: DISABLE_ENCRYPTION is true, using base64 decode");
    try {
      const plainText = Buffer.from(encryptedData, "base64").toString("utf8");
      return JSON.parse(plainText);
    } catch (error) {
      console.error("Base64 decode error:", error);
      throw new Error("Failed to decode base64 data");
    }
  }

  try {
    console.log("Decryption: Using AES-256 decryption");
    const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8);

    if (!jsonString) {
      console.error(
        "Decryption produced empty string - wrong key or corrupted data"
      );
      throw new Error("Decryption failed - invalid key or corrupted data");
    }

    console.log("Decryption: Successfully decrypted, parsing JSON");
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Decryption error:", error);
    console.error("ENCRYPTION_KEY length:", ENCRYPTION_KEY.length);
    console.error("DISABLE_ENCRYPTION:", DISABLE_ENCRYPTION);
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
