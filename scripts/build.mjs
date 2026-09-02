import { cp, mkdir, rm } from 'node:fs/promises';

const outputDirectory = new URL('../dist/', import.meta.url);
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
  'RVR1960-Spanish.json',
  '.openai'
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const path of publishablePaths) {
  await cp(new URL(path, projectRoot), new URL(path, outputDirectory), { recursive: true });
}

console.log('Static site ready in dist/.');
