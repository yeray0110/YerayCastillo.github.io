import { cp, mkdir, rm } from 'node:fs/promises';

// Sites serves the client bundle from dist/client and the Worker from
// dist/server. Keeping those outputs separate makes the static assets
// available to the Worker in production as well as locally.
const outputDirectory = new URL('../dist/client/', import.meta.url);
const projectRoot = new URL('../', import.meta.url);
const publishablePaths = [
  'index.html',
  'lista-compra.html',
  'css',
  'js',
  'sections',
  'data',
  'images',
  'digital-7.ttf',
  'RVR1960-Spanish.json'
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const path of publishablePaths) {
  await cp(new URL(path, projectRoot), new URL(path, outputDirectory), { recursive: true });
}

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true });
await cp(new URL('../server/worker.js', import.meta.url), new URL('../dist/server/index.js', import.meta.url));
await cp(new URL('../server/poems-db.js', import.meta.url), new URL('../dist/server/poems-db.js', import.meta.url));

console.log('Static site ready in dist/.');
