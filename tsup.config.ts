import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkgUrl = new URL('./package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8')) as { version: string };
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
