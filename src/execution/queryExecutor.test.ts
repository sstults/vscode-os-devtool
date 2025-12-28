/**
 * Unit tests for the query executor
 */

import { describe, it, expect } from 'vitest';
import {
  buildRequestUrl,
  formatQueryResult,
  QueryResult,
} from './queryExecutor';
import { ParsedRequest } from '../language/parser';

describe('queryExecutor', () => {
  describe('buildRequestUrl', () => {
    it('should combine base URL and path', () => {
      const url = buildRequestUrl('https://localhost:9200', '/_search');
      expect(url).toBe('https://localhost:9200/_search');
    });

    it('should handle base URL with trailing slash', () => {
      const url = buildRequestUrl('https://localhost:9200/', '/_search');
      expect(url).toBe('https://localhost:9200/_search');
    });

    it('should handle path without leading slash', () => {
      const url = buildRequestUrl('https://localhost:9200', '_search');
      expect(url).toBe('https://localhost:9200/_search');
    });

    it('should handle both trailing and missing leading slash', () => {
      const url = buildRequestUrl('https://localhost:9200/', '_search');
      expect(url).toBe('https://localhost:9200/_search');
    });

    it('should preserve query parameters in path', () => {
      const url = buildRequestUrl('https://localhost:9200', '/_cat/indices?v=true');
      expect(url).toBe('https://localhost:9200/_cat/indices?v=true');
    });

    it('should handle complex paths', () => {
      const url = buildRequestUrl('https://localhost:9200', '/my-index/_doc/1');
      expect(url).toBe('https://localhost:9200/my-index/_doc/1');
    });
  });

  describe('formatQueryResult', () => {
    const baseRequest: ParsedRequest = {
      method: 'GET',
      path: '/_search',
      startLine: 0,
      endLine: 0,
    };

    it('should format successful result', () => {
      const result: QueryResult = {
        success: true,
        statusCode: 200,
        statusMessage: 'OK',
        body: '{"hits":{"total":10}}',
        json: { hits: { total: 10 } },
        headers: {},
        durationMs: 50,
      };

      const formatted = formatQueryResult(baseRequest, result);

      expect(formatted).toContain('# GET /_search');
      expect(formatted).toContain('✓ 200 OK');
      expect(formatted).toContain('50ms');
      expect(formatted).toContain('"hits"');
    });

    it('should format failed result', () => {
      const result: QueryResult = {
        success: false,
        statusCode: 404,
        statusMessage: 'Not Found',
        body: '{"error":"index not found"}',
        json: { error: 'index not found' },
        headers: {},
        durationMs: 25,
      };

      const formatted = formatQueryResult(baseRequest, result);

      expect(formatted).toContain('✗ 404 Not Found');
    });

    it('should format error result', () => {
      const result: QueryResult = {
        success: false,
        statusCode: 0,
        statusMessage: '',
        body: '',
        headers: {},
        durationMs: 100,
        error: 'Connection refused',
      };

      const formatted = formatQueryResult(baseRequest, result);

      expect(formatted).toContain('ERROR: Connection refused');
    });

    it('should pretty print JSON when enabled', () => {
      const result: QueryResult = {
        success: true,
        statusCode: 200,
        statusMessage: 'OK',
        body: '{"a":1}',
        json: { a: 1 },
        headers: {},
        durationMs: 10,
      };

      const formatted = formatQueryResult(baseRequest, result, true);

      // Pretty printed JSON has newlines
      expect(formatted).toContain('{\n');
      expect(formatted).toContain('"a": 1');
    });

    it('should show raw body when pretty print disabled', () => {
      const result: QueryResult = {
        success: true,
        statusCode: 200,
        statusMessage: 'OK',
        body: '{"a":1}',
        json: { a: 1 },
        headers: {},
        durationMs: 10,
      };

      const formatted = formatQueryResult(baseRequest, result, false);

      expect(formatted).toContain('{"a":1}');
    });

    it('should handle non-JSON response', () => {
      const result: QueryResult = {
        success: true,
        statusCode: 200,
        statusMessage: 'OK',
        body: 'index1 green 5 1\nindex2 yellow 3 0',
        headers: {},
        durationMs: 15,
      };

      const formatted = formatQueryResult(baseRequest, result);

      expect(formatted).toContain('index1 green 5 1');
    });

    it('should include request method and path', () => {
      const postRequest: ParsedRequest = {
        method: 'POST',
        path: '/my-index/_doc',
        startLine: 0,
        endLine: 5,
        body: '{"title":"test"}',
      };

      const result: QueryResult = {
        success: true,
        statusCode: 201,
        statusMessage: 'Created',
        body: '{"_id":"1"}',
        json: { _id: '1' },
        headers: {},
        durationMs: 30,
      };

      const formatted = formatQueryResult(postRequest, result);

      expect(formatted).toContain('# POST /my-index/_doc');
    });
  });

  describe('QueryResult interface', () => {
    it('should allow all required fields', () => {
      const result: QueryResult = {
        success: true,
        statusCode: 200,
        statusMessage: 'OK',
        body: '',
        headers: {},
        durationMs: 0,
      };

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('should allow optional fields', () => {
      const result: QueryResult = {
        success: true,
        statusCode: 200,
        statusMessage: 'OK',
        body: '{}',
        json: {},
        headers: { 'content-type': 'application/json' },
        durationMs: 10,
        error: undefined,
      };

      expect(result.json).toEqual({});
      expect(result.headers['content-type']).toBe('application/json');
    });
  });
});
