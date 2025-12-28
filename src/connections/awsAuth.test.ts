/**
 * Unit tests for AWS IAM (SigV4) Authentication handler
 */

import { describe, it, expect } from 'vitest';
import {
  parseUrl,
  validateAwsCredentials,
  validateAwsRegion,
  AWS_REGIONS,
  maskAwsAccessKey,
  maskAwsSecretKey,
  getCredentialsProvider,
} from './awsAuth';

describe('awsAuth', () => {
  describe('parseUrl', () => {
    it('should parse simple URL', () => {
      const result = parseUrl('https://localhost:9200');

      expect(result.protocol).toBe('https:');
      expect(result.hostname).toBe('localhost');
      expect(result.port).toBe(9200);
      expect(result.path).toBe('/');
      expect(result.query).toBeUndefined();
    });

    it('should parse URL with path', () => {
      const result = parseUrl('https://search.amazonaws.com/_search');

      expect(result.hostname).toBe('search.amazonaws.com');
      expect(result.path).toBe('/_search');
      expect(result.port).toBeUndefined();
    });

    it('should parse URL with query parameters', () => {
      const result = parseUrl('https://localhost:9200/_cat/indices?v=true&format=json');

      expect(result.path).toBe('/_cat/indices');
      expect(result.query).toEqual({
        v: 'true',
        format: 'json',
      });
    });

    it('should handle URL without port', () => {
      const result = parseUrl('https://search.amazonaws.com/');

      expect(result.port).toBeUndefined();
    });

    it('should handle http protocol', () => {
      const result = parseUrl('http://localhost:9200');

      expect(result.protocol).toBe('http:');
    });
  });

  describe('validateAwsCredentials', () => {
    it('should return no errors for valid credentials', () => {
      const errors = validateAwsCredentials({
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(errors).toHaveLength(0);
    });

    it('should require access key ID', () => {
      const errors = validateAwsCredentials({
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(errors).toContain('AWS Access Key ID is required');
    });

    it('should require non-empty access key ID', () => {
      const errors = validateAwsCredentials({
        accessKeyId: '   ',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(errors).toContain('AWS Access Key ID is required');
    });

    it('should validate access key ID format', () => {
      const errors = validateAwsCredentials({
        accessKeyId: 'invalid!key',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      });

      expect(errors).toContain('Invalid AWS Access Key ID format');
    });

    it('should require secret access key', () => {
      const errors = validateAwsCredentials({
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      });

      expect(errors).toContain('AWS Secret Access Key is required');
    });

    it('should validate secret access key length', () => {
      const errors = validateAwsCredentials({
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'short',
      });

      expect(errors).toContain('AWS Secret Access Key appears too short');
    });
  });

  describe('validateAwsRegion', () => {
    it('should return true for valid regions', () => {
      expect(validateAwsRegion('us-east-1')).toBe(true);
      expect(validateAwsRegion('eu-west-2')).toBe(true);
      expect(validateAwsRegion('ap-southeast-1')).toBe(true);
    });

    it('should return false for invalid regions', () => {
      expect(validateAwsRegion('invalid')).toBe(false);
      expect(validateAwsRegion('us-east')).toBe(false);
      expect(validateAwsRegion('US-EAST-1')).toBe(false);
      expect(validateAwsRegion('')).toBe(false);
    });
  });

  describe('AWS_REGIONS', () => {
    it('should contain common AWS regions', () => {
      expect(AWS_REGIONS).toContain('us-east-1');
      expect(AWS_REGIONS).toContain('us-west-2');
      expect(AWS_REGIONS).toContain('eu-west-1');
      expect(AWS_REGIONS).toContain('ap-northeast-1');
    });

    it('should have valid region format for all entries', () => {
      for (const region of AWS_REGIONS) {
        expect(validateAwsRegion(region)).toBe(true);
      }
    });
  });

  describe('maskAwsAccessKey', () => {
    it('should mask access key showing first and last 4 characters', () => {
      const masked = maskAwsAccessKey('AKIAIOSFODNN7EXAMPLE');
      expect(masked).toBe('AKIA************MPLE');
    });

    it('should fully mask short keys', () => {
      expect(maskAwsAccessKey('AKIASHRT')).toBe('********');
      expect(maskAwsAccessKey('SHORT')).toBe('*****');
    });

    it('should handle empty key', () => {
      expect(maskAwsAccessKey('')).toBe('');
    });
  });

  describe('maskAwsSecretKey', () => {
    it('should mask secret key showing first and last 2 characters', () => {
      const masked = maskAwsSecretKey('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      expect(masked).toBe('wJ************************************EY');
    });

    it('should fully mask short keys', () => {
      expect(maskAwsSecretKey('abcd')).toBe('****');
      expect(maskAwsSecretKey('abc')).toBe('***');
    });

    it('should handle empty key', () => {
      expect(maskAwsSecretKey('')).toBe('');
    });
  });

  describe('getCredentialsProvider', () => {
    it('should return provider for explicit credentials', async () => {
      const provider = getCredentialsProvider({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        },
      });

      const creds = await provider();
      expect(creds.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(creds.secretAccessKey).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    });

    it('should include session token if provided', async () => {
      const provider = getCredentialsProvider({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          sessionToken: 'session-token-123',
        },
      });

      const creds = await provider();
      expect(creds.sessionToken).toBe('session-token-123');
    });

    it('should return a function for profile-based credentials', () => {
      const provider = getCredentialsProvider({
        region: 'us-east-1',
        profile: 'my-profile',
      });

      expect(typeof provider).toBe('function');
    });

    it('should return a function for default credentials', () => {
      const provider = getCredentialsProvider({
        region: 'us-east-1',
      });

      expect(typeof provider).toBe('function');
    });
  });
});
