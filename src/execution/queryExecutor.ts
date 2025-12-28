/**
 * Query executor for sending requests to OpenSearch.
 */

import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import { URL } from 'url';
import { ParsedRequest } from '../language/parser';
import { StoredConnection } from '../connections/connectionTypes';
import { createBasicAuthHeaders } from '../connections/basicAuth';
import { signRequest } from '../connections/awsAuth';

/**
 * Result of executing a query
 */
export interface QueryResult {
  /** Whether the request was successful (2xx status) */
  success: boolean;
  /** HTTP status code */
  statusCode: number;
  /** HTTP status message */
  statusMessage: string;
  /** Response body */
  body: string;
  /** Parsed JSON body (if applicable) */
  json?: unknown;
  /** Response headers */
  headers: Record<string, string | string[] | undefined>;
  /** Request duration in milliseconds */
  durationMs: number;
  /** Error message if request failed */
  error?: string;
}

/**
 * Options for executing a query
 */
export interface ExecuteOptions {
  /** Connection configuration */
  connection: StoredConnection;
  /** Password for Basic Auth */
  password?: string;
  /** AWS credentials for IAM Auth */
  awsCredentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Default request timeout (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Create an HTTPS agent with custom SSL settings
 */
export function createHttpsAgent(connection: StoredConnection): https.Agent {
  const options: https.AgentOptions = {
    rejectUnauthorized: connection.sslVerify,
  };

  if (connection.caCertPath) {
    try {
      options.ca = fs.readFileSync(connection.caCertPath);
    } catch (error) {
      throw new Error(
        `Failed to read CA certificate: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return new https.Agent(options);
}

/**
 * Build the full URL for a request
 */
export function buildRequestUrl(baseUrl: string, path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Remove trailing slash from base URL
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  return `${normalizedBase}${normalizedPath}`;
}

/**
 * Get authentication headers for a request
 */
export async function getAuthHeaders(
  method: string,
  url: string,
  body: string | undefined,
  options: ExecuteOptions
): Promise<Record<string, string>> {
  const { connection, password, awsCredentials } = options;

  if (connection.authType === 'basic') {
    if (!connection.username || !password) {
      throw new Error('Username and password required for Basic Auth');
    }
    return createBasicAuthHeaders({
      username: connection.username,
      password: password,
    });
  }

  if (connection.authType === 'aws-iam') {
    if (!connection.awsRegion) {
      throw new Error('AWS region required for IAM Auth');
    }

    return signRequest(method, url, {
      region: connection.awsRegion,
      profile: connection.awsProfile,
      credentials:
        awsCredentials?.accessKeyId && awsCredentials?.secretAccessKey
          ? {
              accessKeyId: awsCredentials.accessKeyId,
              secretAccessKey: awsCredentials.secretAccessKey,
            }
          : undefined,
    });
  }

  return {};
}

/**
 * Execute a single request
 */
export async function executeRequest(
  request: ParsedRequest,
  options: ExecuteOptions
): Promise<QueryResult> {
  const startTime = Date.now();
  const { connection, timeout = DEFAULT_TIMEOUT } = options;

  try {
    const url = buildRequestUrl(connection.url, request.path);
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';

    // Get auth headers
    const authHeaders = await getAuthHeaders(request.method, url, request.body, options);

    // Build request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...authHeaders,
    };

    // Build request options
    const requestOptions: http.RequestOptions = {
      method: request.method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers,
      timeout,
    };

    // Add HTTPS agent if needed
    if (isHttps) {
      requestOptions.agent = createHttpsAgent(connection);
    }

    // Execute request
    return await new Promise<QueryResult>((resolve) => {
      const httpModule = isHttps ? https : http;
      const req = httpModule.request(requestOptions, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const durationMs = Date.now() - startTime;
          const body = Buffer.concat(chunks).toString('utf-8');
          const statusCode = res.statusCode || 0;
          const success = statusCode >= 200 && statusCode < 300;

          // Try to parse JSON
          let json: unknown;
          try {
            json = JSON.parse(body);
          } catch {
            // Not JSON, that's okay
          }

          // Convert headers to record
          const responseHeaders: Record<string, string | string[] | undefined> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            responseHeaders[key] = value;
          }

          resolve({
            success,
            statusCode,
            statusMessage: res.statusMessage || '',
            body,
            json,
            headers: responseHeaders,
            durationMs,
          });
        });
      });

      req.on('error', (error) => {
        const durationMs = Date.now() - startTime;
        resolve({
          success: false,
          statusCode: 0,
          statusMessage: '',
          body: '',
          headers: {},
          durationMs,
          error: error.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const durationMs = Date.now() - startTime;
        resolve({
          success: false,
          statusCode: 0,
          statusMessage: '',
          body: '',
          headers: {},
          durationMs,
          error: `Request timed out after ${timeout}ms`,
        });
      });

      // Send body if present
      if (request.body) {
        req.write(request.body);
      }

      req.end();
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      statusCode: 0,
      statusMessage: '',
      body: '',
      headers: {},
      durationMs,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute multiple requests sequentially
 */
export async function executeRequests(
  requests: ParsedRequest[],
  options: ExecuteOptions
): Promise<QueryResult[]> {
  const results: QueryResult[] = [];

  for (const request of requests) {
    const result = await executeRequest(request, options);
    results.push(result);
  }

  return results;
}

/**
 * Format a query result for display
 */
export function formatQueryResult(
  request: ParsedRequest,
  result: QueryResult,
  prettyPrint: boolean = true
): string {
  const lines: string[] = [];

  // Request info
  lines.push(`# ${request.method} ${request.path}`);
  lines.push('');

  // Status line
  if (result.error) {
    lines.push(`# ERROR: ${result.error}`);
  } else {
    const statusEmoji = result.success ? '✓' : '✗';
    lines.push(
      `# ${statusEmoji} ${result.statusCode} ${result.statusMessage} (${result.durationMs}ms)`
    );
  }
  lines.push('');

  // Response body
  if (result.json && prettyPrint) {
    lines.push(JSON.stringify(result.json, null, 2));
  } else if (result.body) {
    lines.push(result.body);
  }

  return lines.join('\n');
}

/**
 * Test a connection by sending a simple request
 */
export async function testConnection(
  options: ExecuteOptions
): Promise<{ success: boolean; message: string; clusterName?: string; version?: string }> {
  const testRequest: ParsedRequest = {
    method: 'GET',
    path: '/',
    startLine: 0,
    endLine: 0,
  };

  const result = await executeRequest(testRequest, options);

  if (!result.success) {
    return {
      success: false,
      message: result.error || `HTTP ${result.statusCode}: ${result.statusMessage}`,
    };
  }

  // Parse cluster info
  if (result.json && typeof result.json === 'object') {
    const info = result.json as Record<string, unknown>;
    const version = info.version as Record<string, unknown> | undefined;

    return {
      success: true,
      message: `Connected successfully in ${result.durationMs}ms`,
      clusterName: info.cluster_name as string | undefined,
      version: version?.number as string | undefined,
    };
  }

  return {
    success: true,
    message: `Connected successfully in ${result.durationMs}ms`,
  };
}
