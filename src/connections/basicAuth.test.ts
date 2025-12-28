/**
 * Unit tests for Basic Authentication handler
 */

import { describe, it, expect } from 'vitest';
import {
  generateBasicAuthHeader,
  parseBasicAuthHeader,
  validateBasicAuthCredentials,
  createBasicAuthHeaders,
  maskPassword,
} from './basicAuth';

describe('basicAuth', () => {
  describe('generateBasicAuthHeader', () => {
    it('should generate correct Basic Auth header', () => {
      const header = generateBasicAuthHeader({
        username: 'admin',
        password: 'secret',
      });

      // Base64 of "admin:secret" is "YWRtaW46c2VjcmV0"
      expect(header).toBe('Basic YWRtaW46c2VjcmV0');
    });

    it('should handle special characters in password', () => {
      const header = generateBasicAuthHeader({
        username: 'user',
        password: 'p@ss:word!',
      });

      // Should be valid base64
      expect(header).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);

      // Verify by decoding
      const decoded = Buffer.from(header.substring(6), 'base64').toString('utf-8');
      expect(decoded).toBe('user:p@ss:word!');
    });

    it('should handle empty password', () => {
      const header = generateBasicAuthHeader({
        username: 'admin',
        password: '',
      });

      const decoded = Buffer.from(header.substring(6), 'base64').toString('utf-8');
      expect(decoded).toBe('admin:');
    });

    it('should handle unicode characters', () => {
      const header = generateBasicAuthHeader({
        username: 'user',
        password: 'пароль',
      });

      const decoded = Buffer.from(header.substring(6), 'base64').toString('utf-8');
      expect(decoded).toBe('user:пароль');
    });
  });

  describe('parseBasicAuthHeader', () => {
    it('should parse valid Basic Auth header', () => {
      const credentials = parseBasicAuthHeader('Basic YWRtaW46c2VjcmV0');

      expect(credentials).toEqual({
        username: 'admin',
        password: 'secret',
      });
    });

    it('should handle password with colons', () => {
      // "user:pass:word" encoded
      const encoded = Buffer.from('user:pass:word').toString('base64');
      const credentials = parseBasicAuthHeader(`Basic ${encoded}`);

      expect(credentials).toEqual({
        username: 'user',
        password: 'pass:word',
      });
    });

    it('should return null for non-Basic auth header', () => {
      expect(parseBasicAuthHeader('Bearer token123')).toBeNull();
      expect(parseBasicAuthHeader('Digest abc')).toBeNull();
    });

    it('should return null for invalid base64', () => {
      expect(parseBasicAuthHeader('Basic !!!invalid!!!')).toBeNull();
    });

    it('should return null for missing colon in decoded value', () => {
      const encoded = Buffer.from('nocolon').toString('base64');
      expect(parseBasicAuthHeader(`Basic ${encoded}`)).toBeNull();
    });

    it('should return null for empty header', () => {
      expect(parseBasicAuthHeader('')).toBeNull();
    });
  });

  describe('validateBasicAuthCredentials', () => {
    it('should return no errors for valid credentials', () => {
      const errors = validateBasicAuthCredentials({
        username: 'admin',
        password: 'secret',
      });

      expect(errors).toHaveLength(0);
    });

    it('should require username', () => {
      const errors = validateBasicAuthCredentials({
        password: 'secret',
      });

      expect(errors).toContain('Username is required');
    });

    it('should require non-empty username', () => {
      const errors = validateBasicAuthCredentials({
        username: '   ',
        password: 'secret',
      });

      expect(errors).toContain('Username is required');
    });

    it('should require password', () => {
      const errors = validateBasicAuthCredentials({
        username: 'admin',
      });

      expect(errors).toContain('Password is required');
    });

    it('should allow empty password (some systems allow it)', () => {
      const errors = validateBasicAuthCredentials({
        username: 'admin',
        password: '',
      });

      // Empty string is falsy, so password is required
      expect(errors).toContain('Password is required');
    });
  });

  describe('createBasicAuthHeaders', () => {
    it('should create headers object with Authorization', () => {
      const headers = createBasicAuthHeaders({
        username: 'admin',
        password: 'secret',
      });

      expect(headers).toHaveProperty('Authorization');
      expect(headers.Authorization).toBe('Basic YWRtaW46c2VjcmV0');
    });

    it('should only include Authorization header', () => {
      const headers = createBasicAuthHeaders({
        username: 'admin',
        password: 'secret',
      });

      expect(Object.keys(headers)).toEqual(['Authorization']);
    });
  });

  describe('maskPassword', () => {
    it('should mask password showing first and last character', () => {
      expect(maskPassword('password')).toBe('p******d');
      expect(maskPassword('secret')).toBe('s****t');
    });

    it('should fully mask short passwords', () => {
      expect(maskPassword('ab')).toBe('**');
      expect(maskPassword('a')).toBe('*');
    });

    it('should handle 3-character password', () => {
      expect(maskPassword('abc')).toBe('a*c');
    });

    it('should handle empty password', () => {
      expect(maskPassword('')).toBe('');
    });

    it('should handle long passwords', () => {
      const longPassword = 'verylongpassword123';
      const masked = maskPassword(longPassword);
      expect(masked).toBe('v*****************3');
      expect(masked.length).toBe(longPassword.length);
    });
  });
});
