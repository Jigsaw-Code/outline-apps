// Minimal: open the native project (ios|android) using Capacitor, from cap root.
import path from 'path';
import {fileURLToPath} from 'url';
import {spawnStream} from '../../infrastructure/build/spawn_stream.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);                        // <-- ensure cap sees capacitor.config.*

const args = process.argv.slice(2);              // pass-through (e.g. ios|android --verbose)
await spawnStream('npx', 'cap', 'open', ...(args.length ? args : ['ios']));
