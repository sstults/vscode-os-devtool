/**
 * Unit tests for connection types and validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateConnection,
  createDefaultConnection,
  toStoredConnection,
  getPasswordKey,
  getAwsAccessKeyKey,
  getAwsSecretKeyKey,
  SECRET_KEYS,
  OpenSearchConnection,
} from './connectionTypes';

describe('connectionTypes', () => {
  describe('validateConnection', () => {
    it('should return no errors for valid basic auth connection', () => {
      const connection = {
        name: 'Test Connection',
        url: 'https://localhost:9200',
        authType: 'basic' as const,
        username: 'admin',
        sslVerify: true,
      };

      const errors = validateConnection(connection);
      expect(errors).toHaveLength(0);
    });

    it('should return no errors for valid AWS IAM connection', () => {
      const connection = {
        name: 'AWS Connection',
        url: 'https://search-domain.us-east-1.es.amazonaws.com',
        authType: 'aws-iam' as const,
        awsRegion: 'us-east-1',
        sslVerify: true,
      };

      const errors = validateConnection(connection);
      expect(errors).toHaveLength(0);
    });

    it('should require connection name', () => {
      const connection = {
        url: 'https://localhost:9200',
        authType: 'basic' as const,
        username: 'admin',
        sslVerify: true,
      };

      const errors = validateConnection(connection);
      expect(errors).toContain('Connection name is required');
    });

    it('should require URL', () => {
      const connection = {
        name: 'Test',
        authType: 'basic' as const,
        username: 'admin',
        sslVerify: true,
      };

      const errors = validateConnection(connection);
      expect(errors).toContain('URL is required');
    });

    it('should validate URL format', () => {
      const connection = {
        name: 'Test',
        url: 'not-a-valid-url',
        authType: 'basic' as const,
        username: 'admin',
        sslVerify: true,
      };

      const errors = validateConnection(connection);
      expect(errors).toContain('Invalid URL format');
    });

    it('should require http or https protocol', () => {
      const connection = {
        name: 'Test',
        url: 'ftp://localhost:9200',
        authType: 'basic' as const,
        username: 'admin',
        sslVerify: true,
      };

      const errors = validateConnection(connection);
      expect(errors).toContain('URL must use http or https protocol');
    });

    it('should require auth type', () => {
      const connection = {
        name: 'Test',
        url: 'https://localhost:9200',
        sslVerify: true,
      };

      const errors = validateConnection(connection);
      expect(errors).toContain('Authentication type is required');
    });

    it('should require username for basic auth', () => {
      const connection = {
        name: 'Test',
        url: 'https://localhost:9200',
        authType: 'basic' as const,
        sslVerify: true,
      };

      const errors = validateConnection(connection);
      expect(errors).toContain('Username is required for Basic Auth');
    });

    it('should require AWS region for IAM auth', () => {
      const connection = {
        name: 'Test',
        url: 'https://localhost:9200',
        authType: 'aws-iam' as const,
        sslVerify: true,
      };

      const errors = validateConnection(connection);
      expect(errors).toContain('AWS region is required for IAM Auth');
    });

    it('should validate CA certificate path extension', () => {
      const connection = {
        name: 'Test',
        url: 'https://localhost:9200',
        authType: 'basic' as const,
        username: 'admin',
        sslVerify: true,
        caCertPath: '/path/to/cert.txt',
      };

      const errors = validateConnection(connection);
      expect(errors).toContain('CA certificate path should end with .pem or .crt');
    });

    it('should accept valid CA certificate paths', () => {
      const connectionPem = {
        name: 'Test',
        url: 'https://localhost:9200',
        authType: 'basic' as const,
        username: 'admin',
        sslVerify: true,
        caCertPath: '/path/to/cert.pem',
      };

      const connectionCrt = {
        name: 'Test',
        url: 'https://localhost:9200',
        authType: 'basic' as const,
        username: 'admin',
        sslVerify: true,
        caCertPath: '/path/to/cert.crt',
      };

      expect(validateConnection(connectionPem)).toHaveLength(0);
      expect(validateConnection(connectionCrt)).toHaveLength(0);
    });
  });

  describe('createDefaultConnection', () => {
    it('should create a default connection with expected values', () => {
      const connection = createDefaultConnection();

      expect(connection.name).toBe('');
      expect(connection.url).toBe('https://localhost:9200');
      expect(connection.authType).toBe('basic');
      expect(connection.sslVerify).toBe(true);
    });
  });

  describe('toStoredConnection', () => {
    it('should convert full connection to stored connection', () => {
      const fullConnection: OpenSearchConnection = {
        id: 'test-id',
        name: 'Test Connection',
        url: 'https://localhost:9200',
        authType: 'basic',
        username: 'admin',
        sslVerify: true,
        caCertPath: '/path/to/cert.pem',
      };

      const stored = toStoredConnection(fullConnection);

      expect(stored.id).toBe('test-id');
      expect(stored.name).toBe('Test Connection');
      expect(stored.url).toBe('https://localhost:9200');
      expect(stored.authType).toBe('basic');
      expect(stored.username).toBe('admin');
      expect(stored.sslVerify).toBe(true);
      expect(stored.caCertPath).toBe('/path/to/cert.pem');
    });

    it('should include AWS fields for IAM connections', () => {
      const fullConnection: OpenSearchConnection = {
        id: 'aws-id',
        name: 'AWS Connection',
        url: 'https://search.amazonaws.com',
        authType: 'aws-iam',
        awsRegion: 'us-east-1',
        awsProfile: 'my-profile',
        sslVerify: true,
      };

      const stored = toStoredConnection(fullConnection);

      expect(stored.awsRegion).toBe('us-east-1');
      expect(stored.awsProfile).toBe('my-profile');
    });
  });

  describe('secret key helpers', () => {
    it('should generate correct password key', () => {
      const key = getPasswordKey('conn-123');
      expect(key).toBe(`${SECRET_KEYS.PASSWORD}conn-123`);
    });

    it('should generate correct AWS access key key', () => {
      const key = getAwsAccessKeyKey('conn-123');
      expect(key).toBe(`${SECRET_KEYS.AWS_ACCESS_KEY}conn-123`);
    });

    it('should generate correct AWS secret key key', () => {
      const key = getAwsSecretKeyKey('conn-123');
      expect(key).toBe(`${SECRET_KEYS.AWS_SECRET_KEY}conn-123`);
    });
  });

  describe('SECRET_KEYS', () => {
    it('should have expected key prefixes', () => {
      expect(SECRET_KEYS.PASSWORD).toBe('osdev.password.');
      expect(SECRET_KEYS.AWS_ACCESS_KEY).toBe('osdev.awsAccessKey.');
      expect(SECRET_KEYS.AWS_SECRET_KEY).toBe('osdev.awsSecretKey.');
    });
  });
});
