# OpenSearch DevTools for VS Code

A VS Code extension that provides an OpenSearch DevTools-like experience, allowing you to write, execute, and save OpenSearch queries with IntelliSense support.

## Features

- **Custom `.osdev` file type** - Write OpenSearch queries with syntax highlighting
- **Multiple connection management** - Configure and switch between OpenSearch clusters
- **Authentication support** - Basic Auth and AWS IAM (SigV4)
- **IntelliSense** - Autocomplete for HTTP methods, endpoints, and Query DSL
- **Query execution** - Execute queries and view results in an output panel
- **SSL/TLS support** - Custom CA certificates and self-signed certificate handling
- **Save output** - Export query results as JSON or raw text

## Installation

### From VS Code Marketplace

Search for "OpenSearch DevTools" in the VS Code Extensions view.

### From VSIX Package

1. Download the `.vsix` file from the [Releases](https://github.com/sstults/vscode-os-devtool/releases) page
2. In VS Code, open the Extensions view (`Cmd+Shift+X` / `Ctrl+Shift+X`)
3. Click the `...` menu (top-right) and select "Install from VSIX..."
4. Select the downloaded `.vsix` file

### From Source

```bash
git clone https://github.com/sstults/vscode-os-devtool.git
cd vscode-os-devtool
npm install
npm run build
```

**To run in development mode:** Press F5 to launch the Extension Development Host.

**To package and install locally:**
```bash
npm run package
```
This creates `vscode-opensearch-devtools-0.1.0.vsix`. Install it via the "Install from VSIX..." option in VS Code.

## Usage

### Creating a Query File

Create a new file with the `.osdev` extension:

```json
// Get cluster health
GET /_cluster/health

// Search for documents
POST /my-index/_search
{
  "query": {
    "match": {
      "title": "opensearch"
    }
  }
}

// Create an index
PUT /new-index
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1
  }
}
```

### Configuring Connections

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run "OpenSearch: Add Connection"
3. Enter connection details:
   - Name: A friendly name for the connection
   - URL: The OpenSearch cluster URL (e.g., `https://localhost:9200`)
   - Auth Type: Basic Auth or AWS IAM
   - Credentials: Username/password or AWS profile

### Executing Queries

- **Execute single request**: Place cursor on a request and press `Cmd+Enter` / `Ctrl+Enter`
- **Execute all requests**: Press `Cmd+Shift+Enter` / `Ctrl+Shift+Enter`

Results appear in the OpenSearch output panel.

### Keyboard Shortcuts

| Command | macOS | Windows/Linux |
|---------|-------|---------------|
| Execute Request | `Cmd+Enter` | `Ctrl+Enter` |
| Execute All Requests | `Cmd+Shift+Enter` | `Ctrl+Shift+Enter` |

## File Format

The `.osdev` file format follows the OpenSearch DevTools console format:

```json
// Comments start with //
/* Or use block comments */

METHOD /path?query=params
{
  "optional": "json body"
}
```

Supported HTTP methods: `GET`, `POST`, `PUT`, `DELETE`, `HEAD`, `PATCH`, `OPTIONS`

## Configuration

Settings can be configured in VS Code settings (`settings.json`):

```json
{
  "osdev.outputFormat": "json",
  "osdev.prettyPrintJson": true
}
```

| Setting | Description | Default |
|---------|-------------|---------|
| `osdev.connections` | List of configured connections | `[]` |
| `osdev.activeConnectionId` | Currently active connection | `""` |
| `osdev.outputFormat` | Output format (`json` or `raw`) | `json` |
| `osdev.prettyPrintJson` | Pretty print JSON responses | `true` |

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
npm install
```

### Build

```bash
npm run build        # Production build
npm run watch        # Development watch mode
```

### Test

```bash
npm test             # Run all tests
npm run test:unit    # Run unit tests only
npm run test:coverage # Run with coverage report
```

### Lint

```bash
npm run lint         # Check for issues
npm run lint:fix     # Auto-fix issues
```

## Requirements

- VS Code 1.85.0 or higher
- OpenSearch 2.11 or higher

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a pull request.

## License

Apache-2.0

## Acknowledgments

- Inspired by [OpenSearch Dashboards DevTools](https://opensearch.org/docs/latest/dashboards/dev-tools/index-dev/)
- Built with the [VS Code Extension API](https://code.visualstudio.com/api)
