import * as vscode from 'vscode';

/**
 * Called when the extension is activated.
 * Activation happens when a .osdev file is opened or a command is invoked.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('OpenSearch DevTools extension is now active');

  // TODO: Initialize connection manager
  // TODO: Register language providers (completion, hover)
  // TODO: Register commands
  // TODO: Create status bar item
  // TODO: Create output channel

  // Placeholder command registrations
  const commands = [
    vscode.commands.registerCommand('osdev.executeRequest', () => {
      vscode.window.showInformationMessage('Execute Request - Not yet implemented');
    }),
    vscode.commands.registerCommand('osdev.executeAllRequests', () => {
      vscode.window.showInformationMessage('Execute All Requests - Not yet implemented');
    }),
    vscode.commands.registerCommand('osdev.addConnection', () => {
      vscode.window.showInformationMessage('Add Connection - Not yet implemented');
    }),
    vscode.commands.registerCommand('osdev.editConnection', () => {
      vscode.window.showInformationMessage('Edit Connection - Not yet implemented');
    }),
    vscode.commands.registerCommand('osdev.deleteConnection', () => {
      vscode.window.showInformationMessage('Delete Connection - Not yet implemented');
    }),
    vscode.commands.registerCommand('osdev.switchConnection', () => {
      vscode.window.showInformationMessage('Switch Connection - Not yet implemented');
    }),
    vscode.commands.registerCommand('osdev.testConnection', () => {
      vscode.window.showInformationMessage('Test Connection - Not yet implemented');
    }),
    vscode.commands.registerCommand('osdev.saveOutput', () => {
      vscode.window.showInformationMessage('Save Output - Not yet implemented');
    }),
    vscode.commands.registerCommand('osdev.clearOutput', () => {
      vscode.window.showInformationMessage('Clear Output - Not yet implemented');
    }),
  ];

  context.subscriptions.push(...commands);
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  console.log('OpenSearch DevTools extension is now deactivated');
}
