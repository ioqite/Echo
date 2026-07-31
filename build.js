// Build script: bundle frontend/main.js -> public/bundle.js using esbuild
import { build, context } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [path.join(__dirname, 'frontend/main.js')],
  bundle: true,
  format: 'esm',
  target: ['es2022', 'chrome109', 'firefox109', 'safari16'],
  outdir: path.join(__dirname, 'public'),
  entryNames: '[name]',
  sourcemap: true,
  minify: !isWatch,
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  loader: {
    '.svg': 'text',
    '.ttf': 'file',
    '.woff': 'file',
    '.woff2': 'file',
  },
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
};

if (isWatch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('Watching frontend for changes...');
} else {
  await build(options);
  console.log('Frontend bundle built: public/main.js (+ chunks/)');
}
