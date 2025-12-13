import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const projectRoot = process.cwd();
const source = resolve(projectRoot, 'sw.js');
const destinationDir = resolve(projectRoot, 'dist');
const destination = resolve(destinationDir, 'sw.js');

try {
  if (!existsSync(source)) {
    console.warn('[SW] No sw.js found, skipping copy.');
    process.exit(0);
  }

  mkdirSync(destinationDir, { recursive: true });
  copyFileSync(source, destination);
  console.log('[SW] Copied sw.js to dist/.');
} catch (error) {
  console.error('[SW] Failed to copy sw.js:', error);
  process.exit(1);
}
