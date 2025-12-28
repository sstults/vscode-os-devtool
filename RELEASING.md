# Releasing OpenSearch DevTools for VS Code

This document describes how to create releases for the extension.

## Prerequisites

- Node.js 18+ and npm 9+
- Git with push access to the repository
- (Optional) VS Code Marketplace Personal Access Token for publishing

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

Pre-release versions can use suffixes: `1.0.0-beta`, `1.0.0-rc.1`

## Creating a Release

### 1. Update Version Number

Update the version in `package.json`:

```json
{
  "version": "0.2.0"
}
```

### 2. Update CHANGELOG (Optional)

If you maintain a CHANGELOG.md, update it with the changes for this release.

### 3. Commit Version Bump

```bash
git add package.json
git commit -m "chore: bump version to 0.2.0"
git push origin main
```

### 4. Create and Push Tag

The tag must match the pattern `v*.*.*`:

```bash
git tag v0.2.0
git push origin v0.2.0
```

### 5. Automated Release Process

Once the tag is pushed, GitHub Actions automatically:

1. Checks out the code
2. Installs dependencies
3. Runs unit tests
4. Builds the extension
5. Packages the .vsix file
6. Creates a GitHub Release with:
   - The .vsix file attached
   - Auto-generated release notes from commits

### 6. Verify the Release

1. Go to the [Releases page](https://github.com/sstults/vscode-os-devtool/releases)
2. Verify the new release appears with the .vsix file
3. Download and test the .vsix file locally

## Manual Release (Alternative)

If you need to create a release manually:

```bash
# Build and package
npm install
npm run build
npm run package

# This creates: vscode-opensearch-devtools-X.X.X.vsix
```

Then upload the .vsix file manually when creating a GitHub Release.

## Publishing to VS Code Marketplace

### One-Time Setup

1. Create an Azure DevOps organization at https://dev.azure.com
2. Create a Personal Access Token (PAT):
   - Go to User Settings > Personal Access Tokens
   - Create new token with "Marketplace (Manage)" scope
   - Copy the token (you won't see it again)
3. Add the token to GitHub repository secrets:
   - Go to Settings > Secrets and variables > Actions
   - Create new secret named `VSCE_PAT`
   - Paste the token value

### Enable Automatic Publishing

Edit `.github/workflows/release.yml` and uncomment the publishing step:

```yaml
- name: Publish to VS Code Marketplace
  run: npx vsce publish -p ${{ secrets.VSCE_PAT }}
  env:
    VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

### Manual Publishing

```bash
# Login (first time only)
npx vsce login opensearch-devtools

# Publish
npx vsce publish
```

## Troubleshooting

### Tag Already Exists

If you need to re-release the same version:

```bash
# Delete local tag
git tag -d v0.2.0

# Delete remote tag
git push origin :refs/tags/v0.2.0

# Recreate and push
git tag v0.2.0
git push origin v0.2.0
```

### Release Workflow Failed

1. Check the Actions tab for error details
2. Common issues:
   - Tests failing: Fix tests before releasing
   - Package errors: Ensure `npm run package` works locally
   - Permission errors: Check repository settings

### VSIX File Too Large

The `.vscodeignore` file controls what's included. Ensure unnecessary files are excluded:

```
node_modules/**
src/**
test/**
coverage/**
*.vsix
```

## Release Checklist

- [ ] All tests passing (`npm run test:unit`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Package creates successfully (`npm run package`)
- [ ] Version updated in package.json
- [ ] Tag created and pushed
- [ ] GitHub Release created with .vsix attached
- [ ] (Optional) Published to VS Code Marketplace
