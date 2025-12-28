/**
 * IntelliSense completion provider for .osdev files.
 * Provides autocomplete for HTTP methods, endpoints, and query DSL.
 */

import * as vscode from 'vscode';
import { isRequestLine, isComment, parseRequestLine, HttpMethod } from './parser';

/**
 * HTTP methods supported by OpenSearch
 */
export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'PATCH'];

/**
 * Common OpenSearch API endpoints
 */
/**
 * Endpoint definition
 */
export interface EndpointDefinition {
  path: string;
  methods: HttpMethod[];
  description: string;
}

export const COMMON_ENDPOINTS: EndpointDefinition[] = [
  // Cluster APIs
  { path: '/_cluster/health', methods: ['GET'], description: 'Get cluster health status' },
  { path: '/_cluster/state', methods: ['GET'], description: 'Get cluster state' },
  { path: '/_cluster/stats', methods: ['GET'], description: 'Get cluster statistics' },
  {
    path: '/_cluster/settings',
    methods: ['GET', 'PUT'],
    description: 'Get/update cluster settings',
  },
  { path: '/_cluster/pending_tasks', methods: ['GET'], description: 'Get pending cluster tasks' },

  // Cat APIs
  { path: '/_cat/indices', methods: ['GET'], description: 'List all indices' },
  { path: '/_cat/nodes', methods: ['GET'], description: 'List all nodes' },
  { path: '/_cat/shards', methods: ['GET'], description: 'List all shards' },
  { path: '/_cat/health', methods: ['GET'], description: 'Get cluster health' },
  { path: '/_cat/master', methods: ['GET'], description: 'Get master node info' },
  { path: '/_cat/allocation', methods: ['GET'], description: 'Get shard allocation' },
  { path: '/_cat/count', methods: ['GET'], description: 'Get document count' },
  { path: '/_cat/plugins', methods: ['GET'], description: 'List installed plugins' },
  { path: '/_cat/templates', methods: ['GET'], description: 'List index templates' },
  { path: '/_cat/aliases', methods: ['GET'], description: 'List aliases' },

  // Index APIs
  { path: '/_aliases', methods: ['GET', 'POST'], description: 'Manage index aliases' },
  { path: '/_mapping', methods: ['GET'], description: 'Get all mappings' },
  { path: '/_settings', methods: ['GET', 'PUT'], description: 'Get/update index settings' },
  { path: '/_refresh', methods: ['POST'], description: 'Refresh indices' },
  { path: '/_flush', methods: ['POST'], description: 'Flush indices' },
  { path: '/_forcemerge', methods: ['POST'], description: 'Force merge indices' },
  { path: '/_cache/clear', methods: ['POST'], description: 'Clear caches' },

  // Search APIs
  { path: '/_search', methods: ['GET', 'POST'], description: 'Search across all indices' },
  { path: '/_msearch', methods: ['POST'], description: 'Multi-search' },
  { path: '/_count', methods: ['GET', 'POST'], description: 'Count documents' },
  { path: '/_validate/query', methods: ['GET', 'POST'], description: 'Validate a query' },
  { path: '/_search/scroll', methods: ['POST', 'DELETE'], description: 'Scroll search' },

  // Document APIs
  { path: '/_bulk', methods: ['POST'], description: 'Bulk operations' },
  { path: '/_mget', methods: ['GET', 'POST'], description: 'Multi-get documents' },
  { path: '/_reindex', methods: ['POST'], description: 'Reindex documents' },
  { path: '/_update_by_query', methods: ['POST'], description: 'Update by query' },
  { path: '/_delete_by_query', methods: ['POST'], description: 'Delete by query' },

  // Node APIs
  { path: '/_nodes', methods: ['GET'], description: 'Get node information' },
  { path: '/_nodes/stats', methods: ['GET'], description: 'Get node statistics' },
  { path: '/_nodes/hot_threads', methods: ['GET'], description: 'Get hot threads' },

  // Snapshot APIs
  { path: '/_snapshot', methods: ['GET'], description: 'List snapshot repositories' },

  // Task APIs
  { path: '/_tasks', methods: ['GET'], description: 'List tasks' },

  // Ingest APIs
  { path: '/_ingest/pipeline', methods: ['GET'], description: 'List ingest pipelines' },

  // Index template APIs
  { path: '/_index_template', methods: ['GET'], description: 'List index templates' },
  { path: '/_component_template', methods: ['GET'], description: 'List component templates' },
];

/**
 * Common query parameters
 */
export const COMMON_QUERY_PARAMS = [
  { name: 'v', description: 'Verbose output (for _cat APIs)' },
  { name: 'pretty', description: 'Pretty print JSON response' },
  { name: 'format', description: 'Response format (json, yaml, etc.)' },
  { name: 'h', description: 'Columns to display (for _cat APIs)' },
  { name: 's', description: 'Sort columns (for _cat APIs)' },
  { name: 'timeout', description: 'Request timeout' },
  { name: 'master_timeout', description: 'Master node timeout' },
  { name: 'wait_for_active_shards', description: 'Wait for active shards' },
  { name: 'refresh', description: 'Refresh after operation' },
  { name: 'routing', description: 'Routing value' },
  { name: 'preference', description: 'Execution preference' },
  { name: 'q', description: 'Query string query' },
  { name: 'size', description: 'Number of results' },
  { name: 'from', description: 'Starting offset' },
  { name: 'sort', description: 'Sort order' },
  { name: '_source', description: 'Source filtering' },
  { name: '_source_includes', description: 'Fields to include' },
  { name: '_source_excludes', description: 'Fields to exclude' },
] as const;

/**
 * Query DSL keywords for JSON body completion
 */
export const QUERY_DSL_KEYWORDS = [
  // Top-level
  { keyword: 'query', description: 'Query container' },
  { keyword: 'aggs', description: 'Aggregations container' },
  { keyword: 'aggregations', description: 'Aggregations container (alias)' },
  { keyword: 'size', description: 'Number of hits to return' },
  { keyword: 'from', description: 'Starting offset' },
  { keyword: 'sort', description: 'Sort order' },
  { keyword: '_source', description: 'Source filtering' },
  { keyword: 'highlight', description: 'Highlighting configuration' },
  { keyword: 'suggest', description: 'Suggestions' },
  { keyword: 'track_total_hits', description: 'Track total hits' },
  { keyword: 'min_score', description: 'Minimum score threshold' },
  { keyword: 'timeout', description: 'Search timeout' },
  { keyword: 'terminate_after', description: 'Max docs to collect per shard' },

  // Query types
  { keyword: 'match', description: 'Full-text match query' },
  { keyword: 'match_all', description: 'Match all documents' },
  { keyword: 'match_none', description: 'Match no documents' },
  { keyword: 'match_phrase', description: 'Phrase match query' },
  { keyword: 'match_phrase_prefix', description: 'Phrase prefix match' },
  { keyword: 'multi_match', description: 'Multi-field match query' },
  { keyword: 'term', description: 'Exact term query' },
  { keyword: 'terms', description: 'Multiple terms query' },
  { keyword: 'range', description: 'Range query' },
  { keyword: 'exists', description: 'Field exists query' },
  { keyword: 'prefix', description: 'Prefix query' },
  { keyword: 'wildcard', description: 'Wildcard query' },
  { keyword: 'regexp', description: 'Regular expression query' },
  { keyword: 'fuzzy', description: 'Fuzzy query' },
  { keyword: 'ids', description: 'IDs query' },

  // Compound queries
  { keyword: 'bool', description: 'Boolean query' },
  { keyword: 'must', description: 'Must match (AND)' },
  { keyword: 'must_not', description: 'Must not match (NOT)' },
  { keyword: 'should', description: 'Should match (OR)' },
  { keyword: 'filter', description: 'Filter context (no scoring)' },
  { keyword: 'minimum_should_match', description: 'Minimum should clauses' },
  { keyword: 'boost', description: 'Query boost factor' },

  // Nested/has queries
  { keyword: 'nested', description: 'Nested query' },
  { keyword: 'has_child', description: 'Has child query' },
  { keyword: 'has_parent', description: 'Has parent query' },

  // Aggregation types
  { keyword: 'terms', description: 'Terms aggregation' },
  { keyword: 'histogram', description: 'Histogram aggregation' },
  { keyword: 'date_histogram', description: 'Date histogram aggregation' },
  { keyword: 'range', description: 'Range aggregation' },
  { keyword: 'avg', description: 'Average aggregation' },
  { keyword: 'sum', description: 'Sum aggregation' },
  { keyword: 'min', description: 'Minimum aggregation' },
  { keyword: 'max', description: 'Maximum aggregation' },
  { keyword: 'cardinality', description: 'Cardinality aggregation' },
  { keyword: 'stats', description: 'Stats aggregation' },
  { keyword: 'extended_stats', description: 'Extended stats aggregation' },
  { keyword: 'percentiles', description: 'Percentiles aggregation' },
  { keyword: 'top_hits', description: 'Top hits aggregation' },
] as const;

/**
 * Completion provider for .osdev files
 */
export class OsdevCompletionProvider implements vscode.CompletionItemProvider {
  /**
   * Provide completion items
   */
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.CompletionItem[] | undefined {
    const line = document.lineAt(position.line).text;
    const linePrefix = line.substring(0, position.character);

    // Skip comments
    if (isComment(line)) {
      return undefined;
    }

    // Check if we're at the start of a line (HTTP method completion)
    if (this.isAtLineStart(linePrefix)) {
      return this.getHttpMethodCompletions();
    }

    // Check if we're after an HTTP method (endpoint completion)
    if (this.isAfterHttpMethod(linePrefix)) {
      return this.getEndpointCompletions(linePrefix);
    }

    // Check if we're in query parameters
    if (this.isInQueryParams(linePrefix)) {
      return this.getQueryParamCompletions(linePrefix);
    }

    // Check if we're in a JSON body
    if (this.isInJsonBody(document, position)) {
      return this.getQueryDslCompletions(linePrefix);
    }

    return undefined;
  }

  /**
   * Check if cursor is at the start of a line (possibly with whitespace)
   */
  private isAtLineStart(linePrefix: string): boolean {
    return linePrefix.trim() === '' || /^[A-Z]*$/i.test(linePrefix.trim());
  }

  /**
   * Check if cursor is after an HTTP method
   */
  private isAfterHttpMethod(linePrefix: string): boolean {
    const trimmed = linePrefix.trim();
    return HTTP_METHODS.some(
      (method) => trimmed.startsWith(method + ' ') || trimmed.startsWith(method.toLowerCase() + ' ')
    );
  }

  /**
   * Check if cursor is in query parameters section
   */
  private isInQueryParams(linePrefix: string): boolean {
    return linePrefix.includes('?') && !linePrefix.includes('{');
  }

  /**
   * Check if cursor is inside a JSON body
   */
  private isInJsonBody(document: vscode.TextDocument, position: vscode.Position): boolean {
    // Look backwards for a request line
    for (let i = position.line - 1; i >= 0; i--) {
      const line = document.lineAt(i).text;
      if (isRequestLine(line)) {
        // Found request line, we're in the body
        return true;
      }
      if (line.trim() === '' && i < position.line - 1) {
        // Empty line before any request line means we're not in a body
        continue;
      }
    }
    return false;
  }

  /**
   * Get HTTP method completions
   */
  private getHttpMethodCompletions(): vscode.CompletionItem[] {
    return HTTP_METHODS.map((method) => {
      const item = new vscode.CompletionItem(method, vscode.CompletionItemKind.Keyword);
      item.insertText = method + ' ';
      item.detail = `HTTP ${method} method`;
      item.sortText = `0_${method}`;
      return item;
    });
  }

  /**
   * Get endpoint completions
   */
  private getEndpointCompletions(linePrefix: string): vscode.CompletionItem[] {
    const parsed = parseRequestLine(linePrefix.trim() + ' /');
    const method = parsed?.method;

    return COMMON_ENDPOINTS.filter((endpoint) => !method || endpoint.methods.includes(method)).map(
      (endpoint) => {
        const item = new vscode.CompletionItem(endpoint.path, vscode.CompletionItemKind.Function);
        item.detail = endpoint.description;
        item.documentation = `Methods: ${endpoint.methods.join(', ')}`;
        item.sortText = `1_${endpoint.path}`;
        return item;
      }
    );
  }

  /**
   * Get query parameter completions
   */
  private getQueryParamCompletions(linePrefix: string): vscode.CompletionItem[] {
    // Check which params are already used
    const usedParams = new Set<string>();
    const queryPart = linePrefix.split('?')[1] || '';
    const pairs = queryPart.split('&');
    for (const pair of pairs) {
      const [key] = pair.split('=');
      if (key) {
        usedParams.add(key);
      }
    }

    return COMMON_QUERY_PARAMS.filter((param) => !usedParams.has(param.name)).map((param) => {
      const item = new vscode.CompletionItem(param.name, vscode.CompletionItemKind.Property);
      item.detail = param.description;
      item.insertText = param.name + '=';
      item.sortText = `2_${param.name}`;
      return item;
    });
  }

  /**
   * Get Query DSL completions for JSON body
   */
  private getQueryDslCompletions(linePrefix: string): vscode.CompletionItem[] {
    // Simple heuristic: if we're after a colon or opening brace, suggest keywords
    const trimmed = linePrefix.trim();
    if (
      trimmed.endsWith(':') ||
      trimmed.endsWith('{') ||
      trimmed.endsWith(',') ||
      trimmed === '' ||
      trimmed.endsWith('"')
    ) {
      return QUERY_DSL_KEYWORDS.map((kw) => {
        const item = new vscode.CompletionItem(kw.keyword, vscode.CompletionItemKind.Field);
        item.detail = kw.description;
        item.insertText = `"${kw.keyword}"`;
        item.sortText = `3_${kw.keyword}`;
        return item;
      });
    }

    return [];
  }
}

/**
 * Create and register the completion provider
 */
export function registerCompletionProvider(_context: vscode.ExtensionContext): vscode.Disposable {
  const provider = new OsdevCompletionProvider();
  return vscode.languages.registerCompletionItemProvider(
    'osdev',
    provider,
    '/',
    '?',
    '&',
    '"',
    ':'
  );
}
