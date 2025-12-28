/**
 * Unit tests for the .osdev file parser
 */

import { describe, it, expect } from 'vitest';
import {
  isHttpMethod,
  isRequestLine,
  isComment,
  isBlankLine,
  parseRequestLine,
  validateJsonBody,
  parseOsdevFile,
  findRequestAtLine,
  getPathWithoutQuery,
  getQueryParams,
  HttpMethod,
} from './parser';

describe('parser', () => {
  describe('isHttpMethod', () => {
    it('should return true for valid HTTP methods', () => {
      const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];
      for (const method of validMethods) {
        expect(isHttpMethod(method)).toBe(true);
      }
    });

    it('should return true for lowercase HTTP methods', () => {
      expect(isHttpMethod('get')).toBe(true);
      expect(isHttpMethod('post')).toBe(true);
    });

    it('should return false for invalid methods', () => {
      expect(isHttpMethod('INVALID')).toBe(false);
      expect(isHttpMethod('OPTIONS')).toBe(false);
      expect(isHttpMethod('')).toBe(false);
    });
  });

  describe('isRequestLine', () => {
    it('should return true for valid request lines', () => {
      expect(isRequestLine('GET /_search')).toBe(true);
      expect(isRequestLine('POST /my-index/_doc')).toBe(true);
      expect(isRequestLine('PUT /my-index')).toBe(true);
      expect(isRequestLine('DELETE /my-index/_doc/1')).toBe(true);
      expect(isRequestLine('HEAD /my-index')).toBe(true);
      expect(isRequestLine('PATCH /my-index/_settings')).toBe(true);
    });

    it('should return true for request lines with query params', () => {
      expect(isRequestLine('GET /_cat/indices?v')).toBe(true);
      expect(isRequestLine('GET /_search?pretty=true&size=10')).toBe(true);
    });

    it('should return true for lines with leading/trailing whitespace', () => {
      expect(isRequestLine('  GET /_search  ')).toBe(true);
    });

    it('should return false for non-request lines', () => {
      expect(isRequestLine('# comment')).toBe(false);
      expect(isRequestLine('{ "query": {} }')).toBe(false);
      expect(isRequestLine('')).toBe(false);
      expect(isRequestLine('GET')).toBe(false);
    });
  });

  describe('isComment', () => {
    it('should return true for comment lines', () => {
      expect(isComment('# This is a comment')).toBe(true);
      expect(isComment('#comment')).toBe(true);
      expect(isComment('  # indented comment')).toBe(true);
    });

    it('should return false for non-comment lines', () => {
      expect(isComment('GET /_search')).toBe(false);
      expect(isComment('{ "query": {} }')).toBe(false);
      expect(isComment('')).toBe(false);
    });
  });

  describe('isBlankLine', () => {
    it('should return true for blank lines', () => {
      expect(isBlankLine('')).toBe(true);
      expect(isBlankLine('   ')).toBe(true);
      expect(isBlankLine('\t')).toBe(true);
      expect(isBlankLine('  \t  ')).toBe(true);
    });

    it('should return false for non-blank lines', () => {
      expect(isBlankLine('GET /_search')).toBe(false);
      expect(isBlankLine('# comment')).toBe(false);
      expect(isBlankLine('{')).toBe(false);
    });
  });

  describe('parseRequestLine', () => {
    it('should parse valid request lines', () => {
      expect(parseRequestLine('GET /_search')).toEqual({
        method: 'GET',
        path: '/_search',
      });

      expect(parseRequestLine('POST /my-index/_doc')).toEqual({
        method: 'POST',
        path: '/my-index/_doc',
      });

      expect(parseRequestLine('get /_cat/indices?v')).toEqual({
        method: 'GET',
        path: '/_cat/indices?v',
      });
    });

    it('should return null for invalid lines', () => {
      expect(parseRequestLine('# comment')).toBeNull();
      expect(parseRequestLine('{ "query": {} }')).toBeNull();
      expect(parseRequestLine('')).toBeNull();
      expect(parseRequestLine('GET')).toBeNull();
    });
  });

  describe('validateJsonBody', () => {
    it('should return valid for valid JSON', () => {
      expect(validateJsonBody('{"query": {}}')).toEqual({ valid: true });
      expect(validateJsonBody('{"match": {"title": "test"}}')).toEqual({ valid: true });
      expect(validateJsonBody('[]')).toEqual({ valid: true });
      expect(validateJsonBody('null')).toEqual({ valid: true });
    });

    it('should return valid for empty/whitespace body', () => {
      expect(validateJsonBody('')).toEqual({ valid: true });
      expect(validateJsonBody('   ')).toEqual({ valid: true });
    });

    it('should return invalid for invalid JSON', () => {
      const result = validateJsonBody('{invalid}');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return invalid for incomplete JSON', () => {
      const result = validateJsonBody('{"query":');
      expect(result.valid).toBe(false);
    });
  });

  describe('parseOsdevFile', () => {
    it('should parse a simple GET request', () => {
      const content = 'GET /_search';
      const result = parseOsdevFile(content);

      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]).toEqual({
        method: 'GET',
        path: '/_search',
        startLine: 0,
        endLine: 0,
      });
      expect(result.errors).toHaveLength(0);
    });

    it('should parse a POST request with body', () => {
      const content = `POST /my-index/_search
{
  "query": {
    "match_all": {}
  }
}`;
      const result = parseOsdevFile(content);

      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]?.method).toBe('POST');
      expect(result.requests[0]?.path).toBe('/my-index/_search');
      expect(result.requests[0]?.body).toBe(`{
  "query": {
    "match_all": {}
  }
}`);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse multiple requests', () => {
      const content = `GET /_cat/indices?v

POST /my-index/_search
{
  "query": { "match_all": {} }
}

DELETE /my-index`;
      const result = parseOsdevFile(content);

      expect(result.requests).toHaveLength(3);
      expect(result.requests[0]?.method).toBe('GET');
      expect(result.requests[1]?.method).toBe('POST');
      expect(result.requests[2]?.method).toBe('DELETE');
    });

    it('should skip comments', () => {
      const content = `# This is a comment
GET /_search
# Another comment`;
      const result = parseOsdevFile(content);

      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]?.method).toBe('GET');
    });

    it('should handle empty content', () => {
      const result = parseOsdevFile('');
      expect(result.requests).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle content with only comments', () => {
      const content = `# Comment 1
# Comment 2`;
      const result = parseOsdevFile(content);
      expect(result.requests).toHaveLength(0);
    });

    it('should report errors for invalid JSON body', () => {
      const content = `POST /my-index/_search
{invalid json}`;
      const result = parseOsdevFile(content);

      expect(result.requests).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('Invalid JSON');
    });

    it('should handle requests with query parameters', () => {
      const content = 'GET /_cat/indices?v&s=index';
      const result = parseOsdevFile(content);

      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]?.path).toBe('/_cat/indices?v&s=index');
    });
  });

  describe('findRequestAtLine', () => {
    it('should find request at specific line', () => {
      const requests = [
        { method: 'GET' as HttpMethod, path: '/_search', startLine: 0, endLine: 0 },
        { method: 'POST' as HttpMethod, path: '/index/_doc', startLine: 2, endLine: 5 },
        { method: 'DELETE' as HttpMethod, path: '/index', startLine: 7, endLine: 7 },
      ];

      expect(findRequestAtLine(requests, 0)?.method).toBe('GET');
      expect(findRequestAtLine(requests, 2)?.method).toBe('POST');
      expect(findRequestAtLine(requests, 4)?.method).toBe('POST');
      expect(findRequestAtLine(requests, 7)?.method).toBe('DELETE');
    });

    it('should return null for lines outside requests', () => {
      const requests = [
        { method: 'GET' as HttpMethod, path: '/_search', startLine: 0, endLine: 0 },
        { method: 'POST' as HttpMethod, path: '/index/_doc', startLine: 2, endLine: 5 },
      ];

      expect(findRequestAtLine(requests, 1)).toBeNull();
      expect(findRequestAtLine(requests, 6)).toBeNull();
    });

    it('should return null for empty requests array', () => {
      expect(findRequestAtLine([], 0)).toBeNull();
    });
  });

  describe('getPathWithoutQuery', () => {
    it('should return path without query parameters', () => {
      expect(getPathWithoutQuery('/_search?pretty')).toBe('/_search');
      expect(getPathWithoutQuery('/_cat/indices?v&s=index')).toBe('/_cat/indices');
    });

    it('should return path unchanged if no query params', () => {
      expect(getPathWithoutQuery('/_search')).toBe('/_search');
      expect(getPathWithoutQuery('/my-index/_doc/1')).toBe('/my-index/_doc/1');
    });
  });

  describe('getQueryParams', () => {
    it('should extract query parameters', () => {
      const params = getQueryParams('/_search?pretty=true&size=10');
      expect(params.get('pretty')).toBe('true');
      expect(params.get('size')).toBe('10');
    });

    it('should handle parameters without values', () => {
      const params = getQueryParams('/_cat/indices?v');
      expect(params.get('v')).toBe('');
    });

    it('should return empty map for paths without query params', () => {
      const params = getQueryParams('/_search');
      expect(params.size).toBe(0);
    });

    it('should decode URL-encoded parameters', () => {
      const params = getQueryParams('/_search?q=title%3Atest');
      expect(params.get('q')).toBe('title:test');
    });
  });
});
