import { cp, mkdir, rm } from 'node:fs/promises';

const outputDirectory = new URL('../dist/', import.meta.url);
const projectRoot = new URL('../', import.meta.url);
const publishablePaths = [
  'index.html',
  'anniversary.html',
  'daily-verse.html',
  'playlist.html',
  'board.html',
  'poems.html',
  'lista-compra.html',
  'bible',
  'css',
  'js',
  'sections',
  'images',
  'digital-7.ttf',
  'RVR1960-Spanish.json'
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const path of publishablePaths) {
  await cp(new URL(path, projectRoot), new URL(path, outputDirectory), { recursive: true });
}

console.log('Static site ready in dist/.');
