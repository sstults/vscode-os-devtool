/**
 * OpenSearch DevTools VS Code Extension
 * Main entry point - handles activation and command registration.
 */

import * as vscode from 'vscode';
import { ConnectionManager } from './connections/connectionManager';
import { StoredConnection, AuthType } from './connections/connectionTypes';
import { registerCompletionProvider } from './language/completionProvider';
import { parseOsdevFile, findRequestAtLine } from './language/parser';
import {
  executeRequest,
  executeRequests,
  testConnection,
  ExecuteOptions,
} from './execution/queryExecutor';
import { OutputPanel } from './execution/outputPanel';
import { AWS_REGIONS } from './connections/awsAuth';

// Global instances
let connectionManager: ConnectionManager;
let outputPanel: OutputPanel;
let statusBarItem: vscode.StatusBarItem;

/**
 * Called when the extension is activated.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('OpenSearch DevTools extension is now active');

  // Initialize core components
  connectionManager = new ConnectionManager(context);
  outputPanel = new OutputPanel();

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'osdev.switchConnection';
  updateStatusBar();
  statusBarItem.show();

  // Listen for connection changes
  connectionManager.onActiveConnectionChanged(() => {
    updateStatusBar();
  });

  // Register language providers
  const completionDisposable = registerCompletionProvider(context);

  // Register all commands
  const commands = [
    vscode.commands.registerCommand('osdev.executeRequest', () => executeCurrentRequest()),
    vscode.commands.registerCommand('osdev.executeAllRequests', () => executeAllRequests()),
    vscode.commands.registerCommand('osdev.addConnection', () => addConnection()),
    vscode.commands.registerCommand('osdev.editConnection', () => editConnection()),
    vscode.commands.registerCommand('osdev.deleteConnection', () => deleteConnection()),
    vscode.commands.registerCommand('osdev.switchConnection', () => switchConnection()),
    vscode.commands.registerCommand('osdev.testConnection', () => testCurrentConnection()),
    vscode.commands.registerCommand('osdev.saveOutput', () => outputPanel.saveOutput()),
    vscode.commands.registerCommand('osdev.clearOutput', () => {
      outputPanel.clear();
      void vscode.window.showInformationMessage('Output cleared');
    }),
  ];

  // Add all disposables to context
  context.subscriptions.push(
    completionDisposable,
    statusBarItem,
    outputPanel,
    connectionManager,
    ...commands
  );
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  console.log('OpenSearch DevTools extension is now deactivated');
}

/**
 * Update the status bar with current connection info
 */
function updateStatusBar(): void {
  const activeConnection = connectionManager.getActiveConnection();
  if (activeConnection) {
    statusBarItem.text = `$(database) ${activeConnection.name}`;
    statusBarItem.tooltip = `OpenSearch: ${activeConnection.name}\n${activeConnection.url}\nClick to switch connection`;
  } else {
    statusBarItem.text = '$(database) No Connection';
    statusBarItem.tooltip = 'Click to add or switch OpenSearch connection';
  }
}

/**
 * Get execute options for the active connection
 */
async function getExecuteOptions(): Promise<ExecuteOptions | undefined> {
  const connection = connectionManager.getActiveConnection();
  if (!connection) {
    const action = await vscode.window.showWarningMessage(
      'No active OpenSearch connection. Would you like to add one?',
      'Add Connection',
      'Cancel'
    );
    if (action === 'Add Connection') {
      await addConnection();
    }
    return undefined;
  }

  const options: ExecuteOptions = { connection };

  // Get credentials based on auth type
  if (connection.authType === 'basic') {
    const password = await connectionManager.getPassword(connection.id);
    if (!password) {
      await vscode.window.showErrorMessage(
        'Password not found for this connection. Please edit the connection.'
      );
      return undefined;
    }
    options.password = password;
  } else if (connection.authType === 'aws-iam') {
    const awsCreds = await connectionManager.getAwsCredentials(connection.id);
    if (awsCreds.accessKeyId && awsCreds.secretAccessKey) {
      options.awsCredentials = awsCreds;
    }
    // If no explicit credentials, awsAuth will use profile or default chain
  }

  return options;
}

/**
 * Execute the request at the current cursor position
 */
async function executeCurrentRequest(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'osdev') {
    await vscode.window.showWarningMessage('Please open a .osdev file to execute requests');
    return;
  }

  const options = await getExecuteOptions();
  if (!options) {
    return;
  }

  const content = editor.document.getText();
  const parseResult = parseOsdevFile(content);

  if (parseResult.errors.length > 0) {
    outputPanel.show();
    for (const error of parseResult.errors) {
      outputPanel.showError(`Line ${error.line + 1}: ${error.message}`);
    }
  }

  const cursorLine = editor.selection.active.line;
  const request = findRequestAtLine(parseResult.requests, cursorLine);

  if (!request) {
    await vscode.window.showWarningMessage('No request found at cursor position');
    return;
  }

  outputPanel.show();
  outputPanel.showInfo(`Executing ${request.method} ${request.path}...`);

  const result = await executeRequest(request, options);
  outputPanel.clear();
  outputPanel.showResult(request, result);
}

/**
 * Execute all requests in the current file
 */
async function executeAllRequests(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'osdev') {
    await vscode.window.showWarningMessage('Please open a .osdev file to execute requests');
    return;
  }

  const options = await getExecuteOptions();
  if (!options) {
    return;
  }

  const content = editor.document.getText();
  const parseResult = parseOsdevFile(content);

  if (parseResult.requests.length === 0) {
    await vscode.window.showWarningMessage('No requests found in file');
    return;
  }

  outputPanel.show();
  outputPanel.clear();
  outputPanel.showInfo(`Executing ${parseResult.requests.length} request(s)...`);
  outputPanel.showSeparator();

  const results = await executeRequests(parseResult.requests, options);

  outputPanel.clear();
  for (let i = 0; i < parseResult.requests.length; i++) {
    const request = parseResult.requests[i];
    const result = results[i];
    if (request && result) {
      outputPanel.showResult(request, result);
      if (i < parseResult.requests.length - 1) {
        outputPanel.showSeparator();
      }
    }
  }
}

/**
 * Add a new connection
 */
async function addConnection(): Promise<void> {
  // Step 1: Connection name
  const name = await vscode.window.showInputBox({
    prompt: 'Enter a name for this connection',
    placeHolder: 'My OpenSearch Cluster',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Name is required';
      }
      if (connectionManager.connectionNameExists(value)) {
        return 'A connection with this name already exists';
      }
      return undefined;
    },
  });
  if (!name) {
    return;
  }

  // Step 2: URL
  const url = await vscode.window.showInputBox({
    prompt: 'Enter the OpenSearch cluster URL',
    placeHolder: 'https://localhost:9200',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'URL is required';
      }
      try {
        new URL(value);
        return undefined;
      } catch {
        return 'Invalid URL format';
      }
    },
  });
  if (!url) {
    return;
  }

  // Step 3: Auth type
  const authType = await vscode.window.showQuickPick(
    [
      {
        label: 'Basic Authentication',
        value: 'basic' as AuthType,
        description: 'Username and password',
      },
      { label: 'AWS IAM', value: 'aws-iam' as AuthType, description: 'AWS Signature V4' },
    ],
    { placeHolder: 'Select authentication type' }
  );
  if (!authType) {
    return;
  }

  let username: string | undefined;
  let password: string | undefined;
  let awsRegion: string | undefined;
  let awsProfile: string | undefined;
  let awsAccessKey: string | undefined;
  let awsSecretKey: string | undefined;

  if (authType.value === 'basic') {
    // Basic auth: get username and password
    username = await vscode.window.showInputBox({
      prompt: 'Enter username',
      placeHolder: 'admin',
    });
    if (!username) {
      return;
    }

    password = await vscode.window.showInputBox({
      prompt: 'Enter password',
      password: true,
    });
    if (!password) {
      return;
    }
  } else {
    // AWS IAM: get region and optionally profile/credentials
    const regionPick = await vscode.window.showQuickPick(
      AWS_REGIONS.map((r) => ({ label: r, value: r })),
      { placeHolder: 'Select AWS region' }
    );
    if (!regionPick) {
      return;
    }
    awsRegion = regionPick.value;

    const credentialMethod = await vscode.window.showQuickPick(
      [
        { label: 'Use AWS Profile', value: 'profile', description: 'From ~/.aws/credentials' },
        {
          label: 'Use Default Credential Chain',
          value: 'default',
          description: 'Environment variables, instance profile, etc.',
        },
        {
          label: 'Enter Access Keys',
          value: 'keys',
          description: 'Manually enter access key and secret',
        },
      ],
      { placeHolder: 'How should credentials be obtained?' }
    );
    if (!credentialMethod) {
      return;
    }

    if (credentialMethod.value === 'profile') {
      awsProfile = await vscode.window.showInputBox({
        prompt: 'Enter AWS profile name',
        placeHolder: 'default',
        value: 'default',
      });
      if (!awsProfile) {
        return;
      }
    } else if (credentialMethod.value === 'keys') {
      awsAccessKey = await vscode.window.showInputBox({
        prompt: 'Enter AWS Access Key ID',
        placeHolder: 'AKIA...',
      });
      if (!awsAccessKey) {
        return;
      }

      awsSecretKey = await vscode.window.showInputBox({
        prompt: 'Enter AWS Secret Access Key',
        password: true,
      });
      if (!awsSecretKey) {
        return;
      }
    }
  }

  // Step 4: SSL verification
  const sslVerify = await vscode.window.showQuickPick(
    [
      { label: 'Verify SSL Certificates', value: true, description: 'Recommended for production' },
      { label: 'Skip SSL Verification', value: false, description: 'For self-signed certificates' },
    ],
    { placeHolder: 'SSL certificate verification' }
  );
  if (sslVerify === undefined) {
    return;
  }

  // Step 5: Custom CA cert (optional)
  let caCertPath: string | undefined;
  if (sslVerify.value) {
    const useCustomCa = await vscode.window.showQuickPick(
      [
        { label: 'Use System CA Certificates', value: false },
        { label: 'Use Custom CA Certificate', value: true },
      ],
      { placeHolder: 'CA certificate configuration' }
    );
    if (useCustomCa?.value) {
      const caUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { 'Certificate files': ['pem', 'crt', 'cer'] },
        title: 'Select CA Certificate File',
      });
      if (caUri && caUri[0]) {
        caCertPath = caUri[0].fsPath;
      }
    }
  }

  // Create the connection
  try {
    const connectionId = await connectionManager.addConnection(
      {
        name,
        url,
        authType: authType.value,
        username,
        awsRegion,
        awsProfile,
        sslVerify: sslVerify.value,
        caCertPath,
      },
      password,
      awsAccessKey,
      awsSecretKey
    );

    await vscode.window.showInformationMessage(`Connection "${name}" added successfully`);

    // Offer to test the connection
    const testIt = await vscode.window.showInformationMessage(
      'Would you like to test the connection?',
      'Test',
      'Skip'
    );
    if (testIt === 'Test') {
      await connectionManager.setActiveConnection(connectionId);
      await testCurrentConnection();
    }
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Failed to add connection: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Edit an existing connection
 */
async function editConnection(): Promise<void> {
  const connections = connectionManager.getConnections();
  if (connections.length === 0) {
    await vscode.window.showWarningMessage('No connections to edit. Add a connection first.');
    return;
  }

  const selected = await vscode.window.showQuickPick(
    connections.map((c) => ({
      label: c.name,
      description: c.url,
      detail: `Auth: ${c.authType}`,
      connection: c,
    })),
    { placeHolder: 'Select connection to edit' }
  );
  if (!selected) {
    return;
  }

  const conn = selected.connection;

  // For now, allow editing name and URL
  const newName = await vscode.window.showInputBox({
    prompt: 'Connection name',
    value: conn.name,
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Name is required';
      }
      if (connectionManager.connectionNameExists(value, conn.id)) {
        return 'A connection with this name already exists';
      }
      return undefined;
    },
  });
  if (!newName) {
    return;
  }

  const newUrl = await vscode.window.showInputBox({
    prompt: 'OpenSearch cluster URL',
    value: conn.url,
    validateInput: (value) => {
      if (!value.trim()) {
        return 'URL is required';
      }
      try {
        new URL(value);
        return undefined;
      } catch {
        return 'Invalid URL format';
      }
    },
  });
  if (!newUrl) {
    return;
  }

  // Update password if basic auth
  let newPassword: string | undefined;
  if (conn.authType === 'basic') {
    const updatePassword = await vscode.window.showQuickPick(
      [
        { label: 'Keep existing password', value: false },
        { label: 'Update password', value: true },
      ],
      { placeHolder: 'Password' }
    );
    if (updatePassword?.value) {
      newPassword = await vscode.window.showInputBox({
        prompt: 'Enter new password',
        password: true,
      });
    }
  }

  try {
    await connectionManager.updateConnection(conn.id, { name: newName, url: newUrl }, newPassword);
    await vscode.window.showInformationMessage(`Connection "${newName}" updated successfully`);
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Failed to update connection: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a connection
 */
async function deleteConnection(): Promise<void> {
  const connections = connectionManager.getConnections();
  if (connections.length === 0) {
    await vscode.window.showWarningMessage('No connections to delete.');
    return;
  }

  const selected = await vscode.window.showQuickPick(
    connections.map((c) => ({
      label: c.name,
      description: c.url,
      connection: c,
    })),
    { placeHolder: 'Select connection to delete' }
  );
  if (!selected) {
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to delete "${selected.connection.name}"?`,
    { modal: true },
    'Delete'
  );
  if (confirm !== 'Delete') {
    return;
  }

  try {
    await connectionManager.deleteConnection(selected.connection.id);
    await vscode.window.showInformationMessage(`Connection "${selected.connection.name}" deleted`);
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Failed to delete connection: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Switch to a different connection
 */
async function switchConnection(): Promise<void> {
  const connections = connectionManager.getConnections();
  if (connections.length === 0) {
    const action = await vscode.window.showWarningMessage(
      'No connections configured. Would you like to add one?',
      'Add Connection',
      'Cancel'
    );
    if (action === 'Add Connection') {
      await addConnection();
    }
    return;
  }

  const activeId = connectionManager.getActiveConnectionId();
  const items = connections.map((c) => ({
    label: c.name,
    description: c.url,
    detail: c.id === activeId ? '$(check) Active' : undefined,
    connection: c,
  }));

  // Add option to add new connection
  const addNewItem = {
    label: '$(add) Add New Connection',
    description: '',
    detail: undefined,
    connection: undefined as StoredConnection | undefined,
  };

  const selected = await vscode.window.showQuickPick([...items, addNewItem], {
    placeHolder: 'Select connection',
  });

  if (!selected) {
    return;
  }

  if (!selected.connection) {
    await addConnection();
    return;
  }

  await connectionManager.setActiveConnection(selected.connection.id);
  await vscode.window.showInformationMessage(`Switched to "${selected.connection.name}"`);
}

/**
 * Test the current connection
 */
async function testCurrentConnection(): Promise<void> {
  const options = await getExecuteOptions();
  if (!options) {
    return;
  }

  outputPanel.show();
  outputPanel.showInfo(`Testing connection to ${options.connection.url}...`);

  const result = await testConnection(options);

  outputPanel.clear();
  if (result.success) {
    outputPanel.showInfo('✓ Connection successful!');
    outputPanel.append('');
    if (result.clusterName) {
      outputPanel.append(`Cluster: ${result.clusterName}`);
    }
    if (result.version) {
      outputPanel.append(`Version: ${result.version}`);
    }
    outputPanel.append(`Response: ${result.message}`);
    await vscode.window.showInformationMessage(`Connection successful: ${result.message}`);
  } else {
    outputPanel.showError(result.message);
    await vscode.window.showErrorMessage(`Connection failed: ${result.message}`);
  }
}
