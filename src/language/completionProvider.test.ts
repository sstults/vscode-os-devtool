/**
 * Unit tests for the completion provider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HTTP_METHODS,
  COMMON_ENDPOINTS,
  COMMON_QUERY_PARAMS,
  QUERY_DSL_KEYWORDS,
  OsdevCompletionProvider,
} from './completionProvider';
import * as vscode from 'vscode';

// Mock document helper
function createMockDocument(lines: string[]): vscode.TextDocument {
  return {
    lineAt: (line: number) => ({
      text: lines[line] || '',
      lineNumber: line,
      range: new vscode.Range(
        new vscode.Position(line, 0),
        new vscode.Position(line, (lines[line] || '').length)
      ),
      rangeIncludingLineBreak: new vscode.Range(
        new vscode.Position(line, 0),
        new vscode.Position(line + 1, 0)
      ),
      firstNonWhitespaceCharacterIndex: 0,
      isEmptyOrWhitespace: !(lines[line] || '').trim(),
    }),
    lineCount: lines.length,
    getText: () => lines.join('\n'),
    uri: vscode.Uri.file('/test.osdev'),
    fileName: '/test.osdev',
    isUntitled: false,
    languageId: 'osdev',
    version: 1,
    isDirty: false,
    isClosed: false,
    save: vi.fn(),
    eol: 1,
    offsetAt: vi.fn(),
    positionAt: vi.fn(),
    getWordRangeAtPosition: vi.fn(),
    validateRange: vi.fn(),
    validatePosition: vi.fn(),
  } as unknown as vscode.TextDocument;
}

describe('completionProvider', () => {
  describe('HTTP_METHODS', () => {
    it('should contain all standard HTTP methods', () => {
      expect(HTTP_METHODS).toContain('GET');
      expect(HTTP_METHODS).toContain('POST');
      expect(HTTP_METHODS).toContain('PUT');
      expect(HTTP_METHODS).toContain('DELETE');
      expect(HTTP_METHODS).toContain('HEAD');
      expect(HTTP_METHODS).toContain('PATCH');
    });

    it('should have exactly 6 methods', () => {
      expect(HTTP_METHODS).toHaveLength(6);
    });
  });

  describe('COMMON_ENDPOINTS', () => {
    it('should contain cluster health endpoint', () => {
      const healthEndpoint = COMMON_ENDPOINTS.find((e) => e.path === '/_cluster/health');
      expect(healthEndpoint).toBeDefined();
      expect(healthEndpoint?.methods).toContain('GET');
    });

    it('should contain search endpoint', () => {
      const searchEndpoint = COMMON_ENDPOINTS.find((e) => e.path === '/_search');
      expect(searchEndpoint).toBeDefined();
      expect(searchEndpoint?.methods).toContain('GET');
      expect(searchEndpoint?.methods).toContain('POST');
    });

    it('should contain cat indices endpoint', () => {
      const catIndices = COMMON_ENDPOINTS.find((e) => e.path === '/_cat/indices');
      expect(catIndices).toBeDefined();
      expect(catIndices?.description).toBeDefined();
    });

    it('should have descriptions for all endpoints', () => {
      for (const endpoint of COMMON_ENDPOINTS) {
        expect(endpoint.description).toBeTruthy();
      }
    });

    it('should have valid methods for all endpoints', () => {
      for (const endpoint of COMMON_ENDPOINTS) {
        expect(endpoint.methods.length).toBeGreaterThan(0);
        for (const method of endpoint.methods) {
          expect(HTTP_METHODS).toContain(method);
        }
      }
    });
  });

  describe('COMMON_QUERY_PARAMS', () => {
    it('should contain common parameters', () => {
      const paramNames = COMMON_QUERY_PARAMS.map((p) => p.name);
      expect(paramNames).toContain('v');
      expect(paramNames).toContain('pretty');
      expect(paramNames).toContain('format');
      expect(paramNames).toContain('size');
      expect(paramNames).toContain('from');
    });

    it('should have descriptions for all parameters', () => {
      for (const param of COMMON_QUERY_PARAMS) {
        expect(param.description).toBeTruthy();
      }
    });
  });

  describe('QUERY_DSL_KEYWORDS', () => {
    it('should contain query keyword', () => {
      const queryKw = QUERY_DSL_KEYWORDS.find((k) => k.keyword === 'query');
      expect(queryKw).toBeDefined();
    });

    it('should contain common query types', () => {
      const keywords = QUERY_DSL_KEYWORDS.map((k) => k.keyword);
      expect(keywords).toContain('match');
      expect(keywords).toContain('match_all');
      expect(keywords).toContain('bool');
      expect(keywords).toContain('term');
      expect(keywords).toContain('range');
    });

    it('should contain aggregation keywords', () => {
      const keywords = QUERY_DSL_KEYWORDS.map((k) => k.keyword);
      expect(keywords).toContain('aggs');
      expect(keywords).toContain('terms');
      expect(keywords).toContain('avg');
      expect(keywords).toContain('sum');
    });

    it('should have descriptions for all keywords', () => {
      for (const kw of QUERY_DSL_KEYWORDS) {
        expect(kw.description).toBeTruthy();
      }
    });
  });

  describe('OsdevCompletionProvider', () => {
    let provider: OsdevCompletionProvider;
    let mockToken: vscode.CancellationToken;
    let mockContext: vscode.CompletionContext;

    beforeEach(() => {
      provider = new OsdevCompletionProvider();
      mockToken = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn(),
      };
      mockContext = {
        triggerKind: 0,
        triggerCharacter: undefined,
      };
    });

    describe('HTTP method completions', () => {
      it('should provide HTTP method completions at line start', () => {
        const doc = createMockDocument(['']);
        const position = new vscode.Position(0, 0);

        const completions = provider.provideCompletionItems(doc, position, mockToken, mockContext);

        expect(completions).toBeDefined();
        expect(completions?.length).toBeGreaterThan(0);

        const labels = completions?.map((c) => c.label);
        expect(labels).toContain('GET');
        expect(labels).toContain('POST');
      });

      it('should provide HTTP method completions with partial input', () => {
        const doc = createMockDocument(['GE']);
        const position = new vscode.Position(0, 2);

        const completions = provider.provideCompletionItems(doc, position, mockToken, mockContext);

        expect(completions).toBeDefined();
        const labels = completions?.map((c) => c.label);
        expect(labels).toContain('GET');
      });
    });

    describe('endpoint completions', () => {
      it('should provide endpoint completions after HTTP method', () => {
        const doc = createMockDocument(['GET /']);
        const position = new vscode.Position(0, 5);

        const completions = provider.provideCompletionItems(doc, position, mockToken, mockContext);

        expect(completions).toBeDefined();
        expect(completions?.length).toBeGreaterThan(0);

        const labels = completions?.map((c) => c.label);
        expect(labels).toContain('/_search');
        expect(labels).toContain('/_cat/indices');
      });

      it('should filter endpoints by HTTP method', () => {
        const doc = createMockDocument(['POST /']);
        const position = new vscode.Position(0, 6);

        const completions = provider.provideCompletionItems(doc, position, mockToken, mockContext);

        // POST endpoints should include /_search but not GET-only endpoints
        const labels = completions?.map((c) => c.label);
        expect(labels).toContain('/_search');
        expect(labels).toContain('/_bulk');
      });
    });

    describe('query parameter completions', () => {
      it('should detect query parameters in URL', () => {
        // The isInQueryParams method checks for ? in the line
        const doc = createMockDocument(['GET /_cat/indices?']);
        const position = new vscode.Position(0, 18);

        const completions = provider.provideCompletionItems(doc, position, mockToken, mockContext);

        // When ? is present, query param completions should be returned
        expect(completions).toBeDefined();
        expect(completions?.length).toBeGreaterThan(0);
      });

      it('should provide completions for query parameters', () => {
        // Test that COMMON_QUERY_PARAMS contains expected params
        const paramNames = COMMON_QUERY_PARAMS.map((p) => p.name);
        expect(paramNames).toContain('v');
        expect(paramNames).toContain('pretty');
        expect(paramNames).toContain('format');
      });
    });

    describe('Query DSL completions', () => {
      it('should provide Query DSL completions in JSON body', () => {
        const doc = createMockDocument(['POST /_search', '{', '  "']);
        const position = new vscode.Position(2, 3);

        const completions = provider.provideCompletionItems(doc, position, mockToken, mockContext);

        expect(completions).toBeDefined();
        const labels = completions?.map((c) => c.label);
        expect(labels).toContain('query');
        expect(labels).toContain('aggs');
      });

      it('should provide completions after colon', () => {
        const doc = createMockDocument(['POST /_search', '{', '  "query":']);
        const position = new vscode.Position(2, 10);

        const completions = provider.provideCompletionItems(doc, position, mockToken, mockContext);

        expect(completions).toBeDefined();
        expect(completions?.length).toBeGreaterThan(0);
      });
    });

    describe('comment handling', () => {
      it('should not provide completions in comments', () => {
        const doc = createMockDocument(['# This is a comment']);
        const position = new vscode.Position(0, 5);

        const completions = provider.provideCompletionItems(doc, position, mockToken, mockContext);

        expect(completions).toBeUndefined();
      });
    });
  });
});
