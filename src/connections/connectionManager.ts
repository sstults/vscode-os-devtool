/**
 * Connection Manager for OpenSearch connections.
 * Handles CRUD operations and storage of connections.
 */

import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import {
  OpenSearchConnection,
  StoredConnection,
  toStoredConnection,
  getPasswordKey,
  getAwsAccessKeyKey,
  getAwsSecretKeyKey,
  validateConnection,
} from './connectionTypes';

/**
 * Configuration keys
 */
const CONFIG_SECTION = 'osdev';
const CONNECTIONS_KEY = 'connections';
const ACTIVE_CONNECTION_KEY = 'activeConnectionId';

/**
 * Manages OpenSearch connections including storage and retrieval
 */
export class ConnectionManager {
  private context: vscode.ExtensionContext;
  private _onConnectionsChanged = new vscode.EventEmitter<void>();
  private _onActiveConnectionChanged = new vscode.EventEmitter<OpenSearchConnection | undefined>();

  /** Event fired when connections list changes */
  readonly onConnectionsChanged = this._onConnectionsChanged.event;
  /** Event fired when active connection changes */
  readonly onActiveConnectionChanged = this._onActiveConnectionChanged.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get all stored connections (without sensitive data)
   */
  getConnections(): StoredConnection[] {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return config.get<StoredConnection[]>(CONNECTIONS_KEY, []);
  }

  /**
   * Get a connection by ID
   */
  getConnection(id: string): StoredConnection | undefined {
    return this.getConnections().find((c) => c.id === id);
  }

  /**
   * Get the active connection ID
   */
  getActiveConnectionId(): string | undefined {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const id = config.get<string>(ACTIVE_CONNECTION_KEY);
    return id || undefined;
  }

  /**
   * Get the active connection
   */
  getActiveConnection(): StoredConnection | undefined {
    const id = this.getActiveConnectionId();
    return id ? this.getConnection(id) : undefined;
  }

  /**
   * Set the active connection
   */
  async setActiveConnection(id: string | undefined): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(ACTIVE_CONNECTION_KEY, id || '', vscode.ConfigurationTarget.Global);

    const connection = id ? this.getConnection(id) : undefined;
    this._onActiveConnectionChanged.fire(connection as OpenSearchConnection | undefined);
  }

  /**
   * Add a new connection
   */
  async addConnection(
    connection: Omit<OpenSearchConnection, 'id'>,
    password?: string,
    awsAccessKey?: string,
    awsSecretKey?: string
  ): Promise<string> {
    // Validate connection
    const errors = validateConnection(connection as OpenSearchConnection);
    if (errors.length > 0) {
      throw new Error(`Invalid connection: ${errors.join(', ')}`);
    }

    // Generate ID
    const id = uuidv4();
    const fullConnection: OpenSearchConnection = { ...connection, id };

    // Store non-sensitive data in settings
    const connections = this.getConnections();
    connections.push(toStoredConnection(fullConnection));

    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(CONNECTIONS_KEY, connections, vscode.ConfigurationTarget.Global);

    // Store sensitive data in SecretStorage
    if (password) {
      await this.context.secrets.store(getPasswordKey(id), password);
    }
    if (awsAccessKey) {
      await this.context.secrets.store(getAwsAccessKeyKey(id), awsAccessKey);
    }
    if (awsSecretKey) {
      await this.context.secrets.store(getAwsSecretKeyKey(id), awsSecretKey);
    }

    this._onConnectionsChanged.fire();

    // If this is the first connection, make it active
    if (connections.length === 1) {
      await this.setActiveConnection(id);
    }

    return id;
  }

  /**
   * Update an existing connection
   */
  async updateConnection(
    id: string,
    updates: Partial<Omit<OpenSearchConnection, 'id'>>,
    password?: string,
    awsAccessKey?: string,
    awsSecretKey?: string
  ): Promise<void> {
    const connections = this.getConnections();
    const index = connections.findIndex((c) => c.id === id);

    if (index < 0) {
      throw new Error(`Connection not found: ${id}`);
    }

    // Merge updates
    const existing = connections[index];
    if (!existing) {
      throw new Error(`Connection not found: ${id}`);
    }
    const updated: StoredConnection = { ...existing, ...updates };

    // Validate
    const errors = validateConnection(updated);
    if (errors.length > 0) {
      throw new Error(`Invalid connection: ${errors.join(', ')}`);
    }

    // Update settings
    connections[index] = updated;
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(CONNECTIONS_KEY, connections, vscode.ConfigurationTarget.Global);

    // Update secrets if provided
    if (password !== undefined) {
      if (password) {
        await this.context.secrets.store(getPasswordKey(id), password);
      } else {
        await this.context.secrets.delete(getPasswordKey(id));
      }
    }
    if (awsAccessKey !== undefined) {
      if (awsAccessKey) {
        await this.context.secrets.store(getAwsAccessKeyKey(id), awsAccessKey);
      } else {
        await this.context.secrets.delete(getAwsAccessKeyKey(id));
      }
    }
    if (awsSecretKey !== undefined) {
      if (awsSecretKey) {
        await this.context.secrets.store(getAwsSecretKeyKey(id), awsSecretKey);
      } else {
        await this.context.secrets.delete(getAwsSecretKeyKey(id));
      }
    }

    this._onConnectionsChanged.fire();

    // Fire active connection changed if this was the active connection
    if (this.getActiveConnectionId() === id) {
      this._onActiveConnectionChanged.fire(updated as OpenSearchConnection);
    }
  }

  /**
   * Delete a connection
   */
  async deleteConnection(id: string): Promise<void> {
    const connections = this.getConnections();
    const index = connections.findIndex((c) => c.id === id);

    if (index < 0) {
      throw new Error(`Connection not found: ${id}`);
    }

    // Remove from settings
    connections.splice(index, 1);
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update(CONNECTIONS_KEY, connections, vscode.ConfigurationTarget.Global);

    // Remove secrets
    await this.context.secrets.delete(getPasswordKey(id));
    await this.context.secrets.delete(getAwsAccessKeyKey(id));
    await this.context.secrets.delete(getAwsSecretKeyKey(id));

    this._onConnectionsChanged.fire();

    // If this was the active connection, clear it or set to first available
    if (this.getActiveConnectionId() === id) {
      const newActive = connections.length > 0 ? connections[0]?.id : undefined;
      await this.setActiveConnection(newActive);
    }
  }

  /**
   * Get the password for a connection
   */
  async getPassword(connectionId: string): Promise<string | undefined> {
    return this.context.secrets.get(getPasswordKey(connectionId));
  }

  /**
   * Get AWS credentials for a connection
   */
  async getAwsCredentials(
    connectionId: string
  ): Promise<{ accessKeyId?: string; secretAccessKey?: string }> {
    const accessKeyId = await this.context.secrets.get(getAwsAccessKeyKey(connectionId));
    const secretAccessKey = await this.context.secrets.get(getAwsSecretKeyKey(connectionId));
    return { accessKeyId, secretAccessKey };
  }

  /**
   * Check if a connection name already exists
   */
  connectionNameExists(name: string, excludeId?: string): boolean {
    return this.getConnections().some(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== excludeId
    );
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this._onConnectionsChanged.dispose();
    this._onActiveConnectionChanged.dispose();
  }
}
