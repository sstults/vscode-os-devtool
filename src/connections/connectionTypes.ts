/**
 * TypeScript interfaces for OpenSearch connection management.
 */

/**
 * Authentication types supported by the extension
 */
export type AuthType = 'basic' | 'aws-iam';

/**
 * Represents an OpenSearch connection configuration.
 * Sensitive data (passwords, AWS keys) are stored separately in SecretStorage.
 */
export interface OpenSearchConnection {
  /** Unique identifier (UUID) */
  id: string;
  /** Display name for the connection */
  name: string;
  /** Base URL (e.g., https://localhost:9200) */
  url: string;
  /** Authentication type */
  authType: AuthType;

  // Basic Auth fields (password stored in SecretStorage)
  /** Username for Basic Auth */
  username?: string;

  // AWS IAM fields (access keys stored in SecretStorage if provided)
  /** AWS region for IAM auth */
  awsRegion?: string;
  /** AWS profile name from ~/.aws/credentials */
  awsProfile?: string;

  // SSL/TLS configuration
  /** Whether to verify SSL certificates (default: true) */
  sslVerify: boolean;
  /** Path to custom CA certificate file */
  caCertPath?: string;
}

/**
 * Connection data stored in VS Code settings (non-sensitive)
 */
export interface StoredConnection {
  id: string;
  name: string;
  url: string;
  authType: AuthType;
  username?: string;
  awsRegion?: string;
  awsProfile?: string;
  sslVerify: boolean;
  caCertPath?: string;
}

/**
 * Credentials for Basic Auth
 */
export interface BasicAuthCredentials {
  username: string;
  password: string;
}

/**
 * Credentials for AWS IAM Auth
 */
export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

/**
 * Result of a connection test
 */
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  clusterName?: string;
  version?: string;
  responseTimeMs?: number;
}

/**
 * OpenSearch cluster info response
 */
export interface ClusterInfo {
  name: string;
  cluster_name: string;
  cluster_uuid: string;
  version: {
    distribution: string;
    number: string;
    build_type: string;
    build_hash: string;
    build_date: string;
    build_snapshot: boolean;
    lucene_version: string;
    minimum_wire_compatibility_version: string;
    minimum_index_compatibility_version: string;
  };
  tagline: string;
}

/**
 * Validate a connection configuration
 */
export function validateConnection(connection: Partial<OpenSearchConnection>): string[] {
  const errors: string[] = [];

  if (!connection.name?.trim()) {
    errors.push('Connection name is required');
  }

  if (!connection.url?.trim()) {
    errors.push('URL is required');
  } else {
    try {
      const url = new URL(connection.url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('URL must use http or https protocol');
      }
    } catch {
      errors.push('Invalid URL format');
    }
  }

  if (!connection.authType) {
    errors.push('Authentication type is required');
  } else if (!['basic', 'aws-iam'].includes(connection.authType)) {
    errors.push('Invalid authentication type');
  }

  if (connection.authType === 'basic' && !connection.username?.trim()) {
    errors.push('Username is required for Basic Auth');
  }

  if (connection.authType === 'aws-iam' && !connection.awsRegion?.trim()) {
    errors.push('AWS region is required for IAM Auth');
  }

  if (connection.caCertPath?.trim()) {
    // Basic path validation - actual file existence checked at runtime
    if (!connection.caCertPath.endsWith('.pem') && !connection.caCertPath.endsWith('.crt')) {
      errors.push('CA certificate path should end with .pem or .crt');
    }
  }

  return errors;
}

/**
 * Create a default connection configuration
 */
export function createDefaultConnection(): Partial<OpenSearchConnection> {
  return {
    name: '',
    url: 'https://localhost:9200',
    authType: 'basic',
    sslVerify: true,
  };
}

/**
 * Convert a full connection to stored connection (remove sensitive data)
 */
export function toStoredConnection(connection: OpenSearchConnection): StoredConnection {
  return {
    id: connection.id,
    name: connection.name,
    url: connection.url,
    authType: connection.authType,
    username: connection.username,
    awsRegion: connection.awsRegion,
    awsProfile: connection.awsProfile,
    sslVerify: connection.sslVerify,
    caCertPath: connection.caCertPath,
  };
}

/**
 * Secret storage key prefixes
 */
export const SECRET_KEYS = {
  PASSWORD: 'osdev.password.',
  AWS_ACCESS_KEY: 'osdev.awsAccessKey.',
  AWS_SECRET_KEY: 'osdev.awsSecretKey.',
} as const;

/**
 * Get the secret storage key for a connection's password
 */
export function getPasswordKey(connectionId: string): string {
  return `${SECRET_KEYS.PASSWORD}${connectionId}`;
}

/**
 * Get the secret storage key for a connection's AWS access key
 */
export function getAwsAccessKeyKey(connectionId: string): string {
  return `${SECRET_KEYS.AWS_ACCESS_KEY}${connectionId}`;
}

/**
 * Get the secret storage key for a connection's AWS secret key
 */
export function getAwsSecretKeyKey(connectionId: string): string {
  return `${SECRET_KEYS.AWS_SECRET_KEY}${connectionId}`;
}
