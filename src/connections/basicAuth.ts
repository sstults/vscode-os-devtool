/**
 * Basic Authentication handler for OpenSearch connections.
 */

import { BasicAuthCredentials } from './connectionTypes';

/**
 * Generate a Basic Auth header value
 * @param credentials - Username and password
 * @returns Base64 encoded authorization header value
 */
export function generateBasicAuthHeader(credentials: BasicAuthCredentials): string {
  const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Parse a Basic Auth header value
 * @param header - Authorization header value (e.g., "Basic dXNlcjpwYXNz")
 * @returns Decoded credentials or null if invalid
 */
export function parseBasicAuthHeader(header: string): BasicAuthCredentials | null {
  if (!header.startsWith('Basic ')) {
    return null;
  }

  try {
    const encoded = header.substring(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const colonIndex = decoded.indexOf(':');

    if (colonIndex < 0) {
      return null;
    }

    return {
      username: decoded.substring(0, colonIndex),
      password: decoded.substring(colonIndex + 1),
    };
  } catch {
    return null;
  }
}

/**
 * Validate Basic Auth credentials
 * @param credentials - Credentials to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateBasicAuthCredentials(credentials: Partial<BasicAuthCredentials>): string[] {
  const errors: string[] = [];

  if (!credentials.username?.trim()) {
    errors.push('Username is required');
  }

  if (!credentials.password) {
    errors.push('Password is required');
  }

  return errors;
}

/**
 * Create HTTP headers for Basic Auth request
 * @param credentials - Username and password
 * @returns Headers object with Authorization header
 */
export function createBasicAuthHeaders(credentials: BasicAuthCredentials): Record<string, string> {
  return {
    Authorization: generateBasicAuthHeader(credentials),
  };
}

/**
 * Mask a password for display (show first and last character)
 * @param password - Password to mask
 * @returns Masked password string
 */
export function maskPassword(password: string): string {
  if (password.length <= 2) {
    return '*'.repeat(password.length);
  }
  return `${password[0]}${'*'.repeat(password.length - 2)}${password[password.length - 1]}`;
}
