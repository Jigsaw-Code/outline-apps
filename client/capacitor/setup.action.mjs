// Minimal: ensure web bundle, map index_cordova -> index.html, generate assets, sync.
import fs from 'fs/promises';
import path from 'path';
import {fileURLToPath} from 'url';
import {spawnStream} from '../../infrastructure/build/spawn_stream.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, '..');
const www = path.join(clientRoot, 'www');
const exists = p => fs.access(p).then(() => true, () => false);

// 1) If client/www is missing, build it as requested
if (!(await exists(www))) await spawnStream('npm', 'run', 'action', 'client/src/www/build');

// 2) Ensure index.html (fallback to index_cordova.html)
const idx = path.join(www, 'index.html'), idxCord = path.join(www, 'index_cordova.html');
if (!(await exists(idx)) && (await exists(idxCord))) await fs.copyFile(idxCord, idx);

// 3) Generate icons/splashes, then sync (run from cap root so config is picked up)
process.chdir(__dirname);
await spawnStream('npx', 'capacitor-assets', 'generate', '--assetPath', path.join(__dirname, 'assets'));
await spawnStream('npx', 'cap', 'sync');
