/**
 * AWS IAM (SigV4) Authentication handler for OpenSearch connections.
 */

import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { AwsCredentials } from './connectionTypes';

/**
 * AWS credentials provider type
 */
export type CredentialsProvider = () => Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}>;

/**
 * Options for signing a request
 */
export interface SignRequestOptions {
  /** AWS region */
  region: string;
  /** AWS credentials (if not using profile) */
  credentials?: AwsCredentials;
  /** AWS profile name (if using profile) */
  profile?: string;
  /** Service name (default: 'es' for OpenSearch) */
  service?: string;
}

/**
 * Parsed URL components for signing
 */
export interface ParsedUrl {
  protocol: string;
  hostname: string;
  port?: number;
  path: string;
  query?: Record<string, string>;
}

/**
 * Parse a URL into components for signing
 */
export function parseUrl(urlString: string): ParsedUrl {
  const url = new URL(urlString);
  const query: Record<string, string> = {};

  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port ? parseInt(url.port, 10) : undefined,
    path: url.pathname,
    query: Object.keys(query).length > 0 ? query : undefined,
  };
}

/**
 * Get AWS credentials provider based on options
 */
export function getCredentialsProvider(options: SignRequestOptions): CredentialsProvider {
  if (options.credentials) {
    // Use explicit credentials
    return () =>
      Promise.resolve({
        accessKeyId: options.credentials!.accessKeyId,
        secretAccessKey: options.credentials!.secretAccessKey,
        sessionToken: options.credentials!.sessionToken,
      });
  }

  if (options.profile) {
    // Use named profile from ~/.aws/credentials
    return fromIni({ profile: options.profile });
  }

  // Use default credential chain
  return defaultProvider();
}

/**
 * Create a SignatureV4 signer
 */
export function createSigner(options: SignRequestOptions): SignatureV4 {
  return new SignatureV4({
    credentials: getCredentialsProvider(options),
    region: options.region,
    service: options.service || 'es',
    sha256: Sha256,
  });
}

/**
 * Sign an HTTP request with AWS SigV4
 */
export async function signRequest(
  method: string,
  url: string,
  options: SignRequestOptions,
  body?: string,
  headers?: Record<string, string>
): Promise<Record<string, string>> {
  const parsedUrl = parseUrl(url);
  const signer = createSigner(options);

  const request = new HttpRequest({
    method: method.toUpperCase(),
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.path,
    query: parsedUrl.query,
    headers: {
      host: parsedUrl.hostname,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body,
  });

  const signedRequest = await signer.sign(request);

  // Extract signed headers
  const signedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(signedRequest.headers)) {
    if (typeof value === 'string') {
      signedHeaders[key] = value;
    }
  }

  return signedHeaders;
}

/**
 * Validate AWS credentials
 */
export function validateAwsCredentials(credentials: Partial<AwsCredentials>): string[] {
  const errors: string[] = [];

  if (!credentials.accessKeyId?.trim()) {
    errors.push('AWS Access Key ID is required');
  } else if (!/^[A-Z0-9]{16,128}$/i.test(credentials.accessKeyId)) {
    errors.push('Invalid AWS Access Key ID format');
  }

  if (!credentials.secretAccessKey?.trim()) {
    errors.push('AWS Secret Access Key is required');
  } else if (credentials.secretAccessKey.length < 16) {
    errors.push('AWS Secret Access Key appears too short');
  }

  return errors;
}

/**
 * Validate AWS region
 */
export function validateAwsRegion(region: string): boolean {
  // AWS region format: xx-xxxx-N (e.g., us-east-1, eu-west-2)
  return /^[a-z]{2}-[a-z]+-\d+$/.test(region);
}

/**
 * Common AWS regions for OpenSearch
 */
export const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-south-1',
  'sa-east-1',
  'ca-central-1',
  'me-south-1',
  'af-south-1',
] as const;

/**
 * Mask an AWS access key for display
 */
export function maskAwsAccessKey(accessKeyId: string): string {
  if (accessKeyId.length <= 8) {
    return '*'.repeat(accessKeyId.length);
  }
  return `${accessKeyId.substring(0, 4)}${'*'.repeat(accessKeyId.length - 8)}${accessKeyId.substring(accessKeyId.length - 4)}`;
}

/**
 * Mask an AWS secret key for display
 */
export function maskAwsSecretKey(secretKey: string): string {
  if (secretKey.length <= 4) {
    return '*'.repeat(secretKey.length);
  }
  return `${secretKey.substring(0, 2)}${'*'.repeat(secretKey.length - 4)}${secretKey.substring(secretKey.length - 2)}`;
}
