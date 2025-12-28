/**
 * Unit tests for the output panel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { OutputPanel } from './outputPanel';
import { ParsedRequest } from '../language/parser';
import { QueryResult } from './queryExecutor';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// Get the mocked vscode module
const mockVscode = await vi.importMock<typeof import('vscode')>('vscode');

describe('OutputPanel', () => {
  let outputPanel: OutputPanel;
  let mockOutputChannel: {
    appendLine: ReturnType<typeof vi.fn>;
    append: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create a fresh mock output channel for each test
    mockOutputChannel = {
      appendLine: vi.fn(),
      append: vi.fn(),
      clear: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
    };

    // Setup createOutputChannel to return our mock
    vi.mocked(mockVscode.window.createOutputChannel).mockReturnValue(
      mockOutputChannel as unknown as ReturnType<typeof mockVscode.window.createOutputChannel>
    );

    outputPanel = new OutputPanel();
  });

  afterEach(() => {
    outputPanel.dispose();
  });

  describe('constructor', () => {
    it('should create an output channel with correct name and language', () => {
      expect(mockVscode.window.createOutputChannel).toHaveBeenCalledWith('OpenSearch', 'json');
    });
  });

  describe('show', () => {
    it('should show the output channel with preserveFocus=true', () => {
      outputPanel.show();
      expect(mockOutputChannel.show).toHaveBeenCalledWith(true);
    });
  });

  describe('clear', () => {
    it('should clear the output channel', () => {
      outputPanel.clear();
      expect(mockOutputChannel.clear).toHaveBeenCalled();
    });

    it('should reset lastOutput', () => {
      outputPanel.append('some text');
      outputPanel.clear();
      expect(outputPanel.getLastOutput()).toBe('');
    });
  });

  describe('append', () => {
    it('should append text to output channel', () => {
      outputPanel.append('test message');
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('test message');
    });

    it('should accumulate text in lastOutput', () => {
      outputPanel.append('line 1');
      outputPanel.append('line 2');
      expect(outputPanel.getLastOutput()).toBe('line 1\nline 2\n');
    });
  });

  describe('showResult', () => {
    const baseRequest: ParsedRequest = {
      method: 'GET',
      path: '/_search',
      startLine: 0,
      endLine: 0,
    };

    it('should display a successful query result', () => {
      const result: QueryResult = {
        success: true,
        statusCode: 200,
        statusMessage: 'OK',
        body: '{"hits":{"total":10}}',
        json: { hits: { total: 10 } },
        headers: {},
        durationMs: 50,
      };

      outputPanel.showResult(baseRequest, result);

      // Should have called appendLine at least twice (result + empty line)
      expect(mockOutputChannel.appendLine).toHaveBeenCalled();
      const output = outputPanel.getLastOutput();
      expect(output).toContain('GET /_search');
      expect(output).toContain('200 OK');
    });

    it('should display a failed query result', () => {
      const result: QueryResult = {
        success: false,
        statusCode: 404,
        statusMessage: 'Not Found',
        body: '{"error":"index not found"}',
        json: { error: 'index not found' },
        headers: {},
        durationMs: 25,
      };

      outputPanel.showResult(baseRequest, result);

      const output = outputPanel.getLastOutput();
      expect(output).toContain('404 Not Found');
    });

    it('should pretty print JSON by default', () => {
      const result: QueryResult = {
        success: true,
        statusCode: 200,
        statusMessage: 'OK',
        body: '{"a":1}',
        json: { a: 1 },
        headers: {},
        durationMs: 10,
      };

      outputPanel.showResult(baseRequest, result, true);

      const output = outputPanel.getLastOutput();
      // Pretty printed JSON has indentation
      expect(output).toContain('"a": 1');
    });

    it('should not pretty print when disabled', () => {
      const result: QueryResult = {
        success: true,
        statusCode: 200,
        statusMessage: 'OK',
        body: '{"a":1}',
        json: { a: 1 },
        headers: {},
        durationMs: 10,
      };

      outputPanel.showResult(baseRequest, result, false);

      const output = outputPanel.getLastOutput();
      expect(output).toContain('{"a":1}');
    });
  });

  describe('showResults', () => {
    it('should display multiple query results', () => {
      const request1: ParsedRequest = {
        method: 'GET',
        path: '/_cat/indices',
        startLine: 0,
        endLine: 0,
      };
      const result1: QueryResult = {
        success: true,
        statusCode: 200,
        statusMessage: 'OK',
        body: 'index1',
        headers: {},
        durationMs: 10,
      };

      const request2: ParsedRequest = {
        method: 'POST',
        path: '/_search',
        startLine: 2,
        endLine: 5,
      };
      const result2: QueryResult = {
        success: true,
        statusCode: 200,
        statusMessage: 'OK',
        body: '{"hits":[]}',
        json: { hits: [] },
        headers: {},
        durationMs: 20,
      };

      outputPanel.showResults([
        { request: request1, result: result1 },
        { request: request2, result: result2 },
      ]);

      const output = outputPanel.getLastOutput();
      expect(output).toContain('GET /_cat/indices');
      expect(output).toContain('POST /_search');
    });

    it('should handle empty results array', () => {
      outputPanel.showResults([]);
      expect(outputPanel.getLastOutput()).toBe('');
    });
  });

  describe('showError', () => {
    it('should display error message with ERROR prefix', () => {
      outputPanel.showError('Connection failed');

      const output = outputPanel.getLastOutput();
      expect(output).toContain('# ERROR: Connection failed');
    });

    it('should add empty line after error', () => {
      outputPanel.showError('Test error');

      // Should have two appendLine calls: error message and empty line
      expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(2);
    });
  });

  describe('showInfo', () => {
    it('should display info message with # prefix', () => {
      outputPanel.showInfo('Executing query...');

      const output = outputPanel.getLastOutput();
      expect(output).toContain('# Executing query...');
    });
  });

  describe('showSeparator', () => {
    it('should display a separator line', () => {
      outputPanel.showSeparator();

      const output = outputPanel.getLastOutput();
      // Should contain repeated separator character
      expect(output).toContain('─'.repeat(60));
    });
  });

  describe('getLastOutput', () => {
    it('should return empty string initially', () => {
      expect(outputPanel.getLastOutput()).toBe('');
    });

    it('should return accumulated output', () => {
      outputPanel.append('first');
      outputPanel.append('second');

      expect(outputPanel.getLastOutput()).toBe('first\nsecond\n');
    });
  });

  describe('saveOutput', () => {
    it('should show warning when no output to save', async () => {
      await outputPanel.saveOutput();

      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith('No output to save');
    });

    it('should show warning when output is only whitespace', async () => {
      // Manually set lastOutput to whitespace (simulating cleared state)
      outputPanel.clear();
      await outputPanel.saveOutput();

      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith('No output to save');
    });

    it('should open save dialog with correct options', async () => {
      outputPanel.append('test output');
      vi.mocked(mockVscode.window.showSaveDialog).mockResolvedValue(undefined);

      await outputPanel.saveOutput();

      expect(mockVscode.window.showSaveDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            'JSON files': ['json'],
            'Text files': ['txt'],
          }),
        })
      );
    });

    it('should not save when dialog is cancelled', async () => {
      outputPanel.append('test output');
      vi.mocked(mockVscode.window.showSaveDialog).mockResolvedValue(undefined);

      await outputPanel.saveOutput();

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      outputPanel.append('test output');
      const mockUri = { fsPath: '/path/to/new/dir/output.json' };
      vi.mocked(mockVscode.window.showSaveDialog).mockResolvedValue(
        mockUri as unknown as ReturnType<typeof mockVscode.Uri.file>
      );
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await outputPanel.saveOutput();

      expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to/new/dir', { recursive: true });
    });

    it('should not create directory if it exists', async () => {
      outputPanel.append('test output');
      const mockUri = { fsPath: '/existing/dir/output.json' };
      vi.mocked(mockVscode.window.showSaveDialog).mockResolvedValue(
        mockUri as unknown as ReturnType<typeof mockVscode.Uri.file>
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await outputPanel.saveOutput();

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should write output to file', async () => {
      outputPanel.append('test output content');
      const mockUri = { fsPath: '/path/to/output.json' };
      vi.mocked(mockVscode.window.showSaveDialog).mockResolvedValue(
        mockUri as unknown as ReturnType<typeof mockVscode.Uri.file>
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await outputPanel.saveOutput();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/path/to/output.json',
        'test output content\n',
        'utf-8'
      );
    });

    it('should show success message after saving', async () => {
      outputPanel.append('test output');
      const mockUri = { fsPath: '/path/to/output.json' };
      vi.mocked(mockVscode.window.showSaveDialog).mockResolvedValue(
        mockUri as unknown as ReturnType<typeof mockVscode.Uri.file>
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await outputPanel.saveOutput();

      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Output saved to /path/to/output.json'
      );
    });

    it('should show error message when save fails', async () => {
      outputPanel.append('test output');
      const mockUri = { fsPath: '/path/to/output.json' };
      vi.mocked(mockVscode.window.showSaveDialog).mockResolvedValue(
        mockUri as unknown as ReturnType<typeof mockVscode.Uri.file>
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await outputPanel.saveOutput();

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to save output: Permission denied'
      );
    });

    it('should handle non-Error exceptions when saving', async () => {
      outputPanel.append('test output');
      const mockUri = { fsPath: '/path/to/output.json' };
      vi.mocked(mockVscode.window.showSaveDialog).mockResolvedValue(
        mockUri as unknown as ReturnType<typeof mockVscode.Uri.file>
      );
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw 'string error';
      });

      await outputPanel.saveOutput();

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to save output: Unknown error'
      );
    });
  });

  describe('dispose', () => {
    it('should dispose the output channel', () => {
      outputPanel.dispose();
      expect(mockOutputChannel.dispose).toHaveBeenCalled();
    });
  });
});
