/**
 * Parser for .osdev file format.
 * Parses OpenSearch DevTools console format into structured request objects.
 */

/**
 * HTTP methods supported by OpenSearch
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'PATCH';

/**
 * Represents a parsed OpenSearch request
 */
export interface ParsedRequest {
  /** HTTP method */
  method: HttpMethod;
  /** Request path (e.g., /_search, /my-index/_doc/1) */
  path: string;
  /** Optional JSON body */
  body?: string;
  /** Line number where the request starts (0-indexed) */
  startLine: number;
  /** Line number where the request ends (0-indexed) */
  endLine: number;
}

/**
 * Result of parsing a .osdev file
 */
export interface ParseResult {
  /** Successfully parsed requests */
  requests: ParsedRequest[];
  /** Parse errors encountered */
  errors: ParseError[];
}

/**
 * Represents a parse error
 */
export interface ParseError {
  /** Error message */
  message: string;
  /** Line number where the error occurred (0-indexed) */
  line: number;
}

/**
 * Valid HTTP methods for OpenSearch requests
 */
const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];

/**
 * Regex pattern to match the start of a request (HTTP method followed by path)
 */
const REQUEST_LINE_PATTERN = /^(GET|POST|PUT|DELETE|HEAD|PATCH)\s+(\S+)\s*$/i;

/**
 * Check if a string is a valid HTTP method
 */
export function isHttpMethod(value: string): value is HttpMethod {
  return HTTP_METHODS.includes(value.toUpperCase() as HttpMethod);
}

/**
 * Check if a line starts a new request
 */
export function isRequestLine(line: string): boolean {
  return REQUEST_LINE_PATTERN.test(line.trim());
}

/**
 * Check if a line is a comment
 */
export function isComment(line: string): boolean {
  return line.trim().startsWith('#');
}

/**
 * Check if a line is blank (empty or whitespace only)
 */
export function isBlankLine(line: string): boolean {
  return line.trim() === '';
}

/**
 * Parse a request line to extract method and path
 */
export function parseRequestLine(line: string): { method: HttpMethod; path: string } | null {
  const match = line.trim().match(REQUEST_LINE_PATTERN);
  if (!match) {
    return null;
  }
  return {
    method: match[1].toUpperCase() as HttpMethod,
    path: match[2],
  };
}

/**
 * Validate JSON body string
 */
export function validateJsonBody(body: string): { valid: boolean; error?: string } {
  if (!body.trim()) {
    return { valid: true };
  }
  try {
    JSON.parse(body);
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Invalid JSON',
    };
  }
}

/**
 * Parse a .osdev file content into structured requests
 */
export function parseOsdevFile(content: string): ParseResult {
  const lines = content.split('\n');
  const requests: ParsedRequest[] = [];
  const errors: ParseError[] = [];

  let currentRequest: { method: HttpMethod; path: string; startLine: number } | null = null;
  let bodyLines: string[] = [];

  const finalizeRequest = (endLine: number) => {
    if (currentRequest) {
      const body = bodyLines.join('\n').trim();
      const request: ParsedRequest = {
        method: currentRequest.method,
        path: currentRequest.path,
        startLine: currentRequest.startLine,
        endLine: endLine,
      };

      if (body) {
        const validation = validateJsonBody(body);
        if (validation.valid) {
          request.body = body;
        } else {
          errors.push({
            message: `Invalid JSON body: ${validation.error}`,
            line: currentRequest.startLine + 1,
          });
          // Still include the request with the invalid body for error reporting
          request.body = body;
        }
      }

      requests.push(request);
    }
    currentRequest = null;
    bodyLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Skip comments
    if (isComment(line)) {
      continue;
    }

    // Check if this line starts a new request
    if (isRequestLine(line)) {
      // Finalize any previous request
      if (currentRequest) {
        finalizeRequest(i - 1);
      }

      const parsed = parseRequestLine(line);
      if (parsed) {
        currentRequest = {
          method: parsed.method,
          path: parsed.path,
          startLine: i,
        };
      }
      continue;
    }

    // If we're in a request, collect body lines
    if (currentRequest) {
      // Skip blank lines at the start of body
      if (bodyLines.length === 0 && isBlankLine(line)) {
        continue;
      }
      bodyLines.push(line);
    }
  }

  // Finalize the last request
  if (currentRequest) {
    finalizeRequest(lines.length - 1);
  }

  return { requests, errors };
}

/**
 * Find the request at a specific line number
 */
export function findRequestAtLine(requests: ParsedRequest[], line: number): ParsedRequest | null {
  for (const request of requests) {
    if (line >= request.startLine && line <= request.endLine) {
      return request;
    }
  }
  return null;
}

/**
 * Extract the path without query parameters
 */
export function getPathWithoutQuery(path: string): string {
  const queryIndex = path.indexOf('?');
  return queryIndex >= 0 ? path.substring(0, queryIndex) : path;
}

/**
 * Extract query parameters from a path
 */
export function getQueryParams(path: string): Map<string, string> {
  const params = new Map<string, string>();
  const queryIndex = path.indexOf('?');
  if (queryIndex < 0) {
    return params;
  }

  const queryString = path.substring(queryIndex + 1);
  const pairs = queryString.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params.set(decodeURIComponent(key), value ? decodeURIComponent(value) : '');
    }
  }

  return params;
}
