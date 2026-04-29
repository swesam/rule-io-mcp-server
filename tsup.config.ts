import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };
const define = { __PACKAGE_VERSION__: JSON.stringify(pkg.version) };

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: false,
    define,
  },
  {
    entry: ['src/bin/rule-io-mcp.ts'],
    format: ['cjs'],
    outDir: 'dist/bin',
    splitting: false,
    sourcemap: false,
    clean: false,
    minify: false,
    define,
  },
]);
