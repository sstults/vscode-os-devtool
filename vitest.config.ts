import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'out', 'test/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/extension.ts', // Requires VS Code integration testing
        'src/connections/connectionManager.ts', // Requires VS Code integration testing
        'src/execution/queryExecutor.ts', // HTTP functions require network mocking
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, 'test/mocks/vscode.ts'),
    },
  },
});
