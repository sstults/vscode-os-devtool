/**
 * Output panel for displaying OpenSearch query results.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ParsedRequest } from '../language/parser';
import { QueryResult, formatQueryResult } from './queryExecutor';

/**
 * Manages the output panel for displaying query results
 */
export class OutputPanel {
  private outputChannel: vscode.OutputChannel;
  private lastOutput: string = '';

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('OpenSearch', 'json');
  }

  /**
   * Show the output panel
   */
  show(): void {
    this.outputChannel.show(true);
  }

  /**
   * Clear the output panel
   */
  clear(): void {
    this.outputChannel.clear();
    this.lastOutput = '';
  }

  /**
   * Append text to the output panel
   */
  append(text: string): void {
    this.outputChannel.appendLine(text);
    this.lastOutput += text + '\n';
  }

  /**
   * Display a single query result
   */
  showResult(request: ParsedRequest, result: QueryResult, prettyPrint: boolean = true): void {
    const formatted = formatQueryResult(request, result, prettyPrint);
    this.append(formatted);
    this.append(''); // Empty line separator
  }

  /**
   * Display multiple query results
   */
  showResults(
    results: Array<{ request: ParsedRequest; result: QueryResult }>,
    prettyPrint: boolean = true
  ): void {
    for (const { request, result } of results) {
      this.showResult(request, result, prettyPrint);
    }
  }

  /**
   * Display an error message
   */
  showError(message: string): void {
    this.append(`# ERROR: ${message}`);
    this.append('');
  }

  /**
   * Display an info message
   */
  showInfo(message: string): void {
    this.append(`# ${message}`);
  }

  /**
   * Display a separator line
   */
  showSeparator(): void {
    this.append('─'.repeat(60));
  }

  /**
   * Get the last output content
   */
  getLastOutput(): string {
    return this.lastOutput;
  }

  /**
   * Save the last output to a file
   */
  async saveOutput(): Promise<void> {
    if (!this.lastOutput.trim()) {
      await vscode.window.showWarningMessage('No output to save');
      return;
    }

    const options: vscode.SaveDialogOptions = {
      defaultUri: vscode.Uri.file('opensearch-output.json'),
      filters: {
        'JSON files': ['json'],
        'Text files': ['txt'],
        'All files': ['*'],
      },
    };

    const uri = await vscode.window.showSaveDialog(options);
    if (uri) {
      try {
        const dir = path.dirname(uri.fsPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(uri.fsPath, this.lastOutput, 'utf-8');
        await vscode.window.showInformationMessage(`Output saved to ${uri.fsPath}`);
      } catch (error) {
        await vscode.window.showErrorMessage(
          `Failed to save output: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}
