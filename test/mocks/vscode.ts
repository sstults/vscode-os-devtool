/**
 * Mock implementation of VS Code API for unit testing.
 * This file provides mock implementations of commonly used VS Code APIs.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const window = {
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showInputBox: vi.fn(),
  showQuickPick: vi.fn(),
  showSaveDialog: vi.fn(),
  showOpenDialog: vi.fn(),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
  createStatusBarItem: vi.fn(() => ({
    text: '',
    tooltip: '',
    command: '',
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
  activeTextEditor: undefined as any,
};

export const workspace = {
  getConfiguration: vi.fn(() => ({
    get: vi.fn(),
    update: vi.fn(),
    has: vi.fn(),
    inspect: vi.fn(),
  })),
  workspaceFolders: [],
  onDidChangeConfiguration: vi.fn(),
};

export const commands = {
  registerCommand: vi.fn((command: string, callback: (...args: any[]) => any) => ({
    dispose: vi.fn(),
  })),
  executeCommand: vi.fn(),
};

export const languages = {
  registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
  registerHoverProvider: vi.fn(() => ({ dispose: vi.fn() })),
  registerCodeActionsProvider: vi.fn(() => ({ dispose: vi.fn() })),
  setLanguageConfiguration: vi.fn(),
};

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export class Uri {
  static file(path: string): Uri {
    return new Uri('file', '', path, '', '');
  }

  static parse(value: string): Uri {
    return new Uri('', '', value, '', '');
  }

  constructor(
    public readonly scheme: string,
    public readonly authority: string,
    public readonly path: string,
    public readonly query: string,
    public readonly fragment: string
  ) {}

  toString(): string {
    return `${this.scheme}://${this.path}`;
  }

  get fsPath(): string {
    return this.path;
  }
}

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position
  ) {}
}

export class Selection extends Range {
  constructor(
    public readonly anchor: Position,
    public readonly active: Position
  ) {
    super(anchor, active);
  }
}

export class CompletionItem {
  constructor(
    public label: string,
    public kind?: CompletionItemKind
  ) {}
}

export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  File = 16,
  Reference = 17,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24,
}

export class Hover {
  constructor(public contents: any) {}
}

export class MarkdownString {
  constructor(public value: string = '') {}

  appendMarkdown(value: string): MarkdownString {
    this.value += value;
    return this;
  }

  appendCodeblock(code: string, language?: string): MarkdownString {
    this.value += `\n\`\`\`${language || ''}\n${code}\n\`\`\`\n`;
    return this;
  }
}

export class Disposable {
  static from(...disposables: { dispose: () => any }[]): Disposable {
    return new Disposable(() => {
      disposables.forEach((d) => d.dispose());
    });
  }

  constructor(private callOnDispose: () => any) {}

  dispose(): void {
    this.callOnDispose();
  }
}

export class EventEmitter<T> {
  private listeners: ((e: T) => any)[] = [];

  event = (listener: (e: T) => any): Disposable => {
    this.listeners.push(listener);
    return new Disposable(() => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    });
  };

  fire(data: T): void {
    this.listeners.forEach((listener) => listener(data));
  }

  dispose(): void {
    this.listeners = [];
  }
}

// Mock ExtensionContext
export function createMockExtensionContext(): any {
  return {
    subscriptions: [],
    workspaceState: {
      get: vi.fn(),
      update: vi.fn(),
      keys: vi.fn(() => []),
    },
    globalState: {
      get: vi.fn(),
      update: vi.fn(),
      keys: vi.fn(() => []),
      setKeysForSync: vi.fn(),
    },
    secrets: {
      get: vi.fn(),
      store: vi.fn(),
      delete: vi.fn(),
      onDidChange: vi.fn(),
    },
    extensionPath: '/mock/extension/path',
    extensionUri: Uri.file('/mock/extension/path'),
    storagePath: '/mock/storage/path',
    storageUri: Uri.file('/mock/storage/path'),
    globalStoragePath: '/mock/global/storage/path',
    globalStorageUri: Uri.file('/mock/global/storage/path'),
    logPath: '/mock/log/path',
    logUri: Uri.file('/mock/log/path'),
    extensionMode: 1,
    extension: {
      id: 'mock.extension',
      extensionUri: Uri.file('/mock/extension/path'),
      extensionPath: '/mock/extension/path',
      isActive: true,
      packageJSON: {},
      exports: undefined,
      activate: vi.fn(),
    },
    asAbsolutePath: vi.fn((relativePath: string) => `/mock/extension/path/${relativePath}`),
  };
}

// Import vi from vitest for mocking
import { vi } from 'vitest';
