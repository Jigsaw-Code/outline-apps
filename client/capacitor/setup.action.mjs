import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Hard anchors
const capRoot    = __dirname;                  // /.../client/capacitor   ← where the config lives
const clientRoot = path.resolve(capRoot, '..'); // /.../client
const repoRoot   = path.resolve(clientRoot, '..');

const iosDir     = path.join(clientRoot, 'ios');
const androidDir = path.join(clientRoot, 'android');

const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(name);
  if (i === -1) return null;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const flagAssetPath = flag('--asset-path');
const noBuild       = argv.includes('--no-build');

function binDir(projectDir) { return path.join(projectDir, 'node_modules', '.bin'); }
function withLocalBinEnv(projectDir, extraEnv = {}) {
  const PATH = process.env.PATH
    ? `${binDir(projectDir)}${path.delimiter}${process.env.PATH}`
    : binDir(projectDir);
  return { ...process.env, PATH, ...extraEnv };
}
function log(step, msg) { console.log(`▶ ${step}: ${msg}`); }
function run(step, cmd, args, { cwd = clientRoot, env } = {}) {
  return new Promise((resolve, reject) => {
    log(step, `Running [${cmd} ${args.join(' ')}]`);
    const child = spawn(cmd, args, {
      cwd, env: env || withLocalBinEnv(clientRoot),
      shell: process.platform === 'win32',
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    child.stdout.on('data', d => { process.stdout.write(d); out += d; });
    child.stderr.on('data', d => { process.stderr.write(d); err += d; });
    child.on('error', e => reject(new Error(`${step}: failed to spawn "${cmd}" (${e.code || 'UNKNOWN'})`)));
    child.on('close', c => c === 0
      ? resolve({ stdout: out, stderr: err })
      : reject(new Error(`${step} failed with exit code ${c}\n\n--- output ---\n${(err || out || '').trim()}\n--------------`)));
  });
}
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function readJSON(p) { return JSON.parse(await fs.readFile(p, 'utf8')); }

// --- deps --------------------------------------------------------------------
async function detectPM() {
  if (await exists(path.join(repoRoot, 'pnpm-lock.yaml')) || await exists(path.join(clientRoot, 'pnpm-lock.yaml')))
    return { pm: 'pnpm', addDev: ['add', '-D'], build: ['-w', 'run', 'build'], buildAlt: ['run', 'build'] };
  if (await exists(path.join(repoRoot, 'yarn.lock')) || await exists(path.join(clientRoot, 'yarn.lock')))
    return { pm: 'yarn', addDev: ['add', '--dev'], build: ['build'] };
  return { pm: 'npm', addDev: ['i', '-D'], build: ['run', 'build'] };
}
async function ensureCLIs() {
  const cap    = path.join(binDir(clientRoot), process.platform === 'win32' ? 'cap.cmd' : 'cap');
  const assets = path.join(binDir(clientRoot), process.platform === 'win32' ? 'capacitor-assets.cmd' : 'capacitor-assets');
  const missing = [];
  if (!(await exists(cap)))    missing.push('@capacitor/cli');
  if (!(await exists(assets))) missing.push('@capacitor/assets');
  if (!missing.length) return;

  const { pm, addDev } = await detectPM();
  log('deps', `Installing ${missing.join(', ')} with ${pm} in ${clientRoot}...`);
  await run('deps', pm, [...addDev, ...missing], { cwd: clientRoot, env: process.env });
}

// --- clean generated icons/splashes only ------------------------------------
async function rmIfExists(p) { if (await exists(p)) { await fs.rm(p, { recursive: true, force: true }); log('clean', `removed ${path.relative(clientRoot, p)}`); } }
async function cleanGeneratedAssets() {
  log('clean', 'Removing previously generated app icons & splash screens…');
  await rmIfExists(path.join(iosDir, 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset'));
  await rmIfExists(path.join(iosDir, 'App', 'App', 'Assets.xcassets', 'Splash.imageset'));
  const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');
  if (await exists(resDir)) {
    const dirs = await fs.readdir(resDir, { withFileTypes: true });
    for (const d of dirs) {
      if (d.isDirectory() && /^mipmap-/.test(d.name)) {
        const folder = path.join(resDir, d.name);
        const files = await fs.readdir(folder);
        await Promise.all(files.filter(f => /^ic_launcher/.test(f)).map(f => rmIfExists(path.join(folder, f))));
      }
      if (d.isDirectory() && /^drawable/.test(d.name)) {
        const folder = path.join(resDir, d.name);
        const files = await fs.readdir(folder);
        await Promise.all(files.filter(f => /^splash\./.test(f)).map(f => rmIfExists(path.join(folder, f))));
      }
    }
    await rmIfExists(path.join(resDir, 'values', 'ic_launcher_background.xml'));
  }
  log('clean', 'Done.');
}

// --- read Capacitor config (from *this* folder) ------------------------------
async function readCapConfig() {
  const json = path.join(capRoot, 'capacitor.config.json');
  const ts   = path.join(capRoot, 'capacitor.config.ts');
  if (await exists(json)) return { kind: 'json', path: json, data: await readJSON(json) };
  if (await exists(ts)) {
    const text = await fs.readFile(ts, 'utf8');
    const webDir = (text.match(/webDir\s*:\s*['"`]([^'"`]+)['"`]/) || [])[1];
    const appId  = (text.match(/appId\s*:\s*['"`]([^'"`]+)['"`]/)  || [])[1];
    const appName= (text.match(/appName\s*:\s*['"`]([^'"`]+)['"`]/)|| [])[1];
    return { kind: 'ts', path: ts, data: { webDir, appId, appName } };
  }
  throw new Error(`No Capacitor config found in ${capRoot}. Add capacitor.config.ts/json there.`);
}

// Resolve webDir absolute path relative to the config file location
function resolveWebDirAbs(cfg) {
  const rel = cfg.data.webDir || 'www';
  return path.resolve(path.dirname(cfg.path), rel);
}

// Make sure webDir has index.html (Capacitor requires this for sync). 
// Docs: webDir in config + CLI workflow. 
// https://capacitorjs.com/docs/config  https://capacitorjs.com/docs/cli
async function ensureWebAssets(webDirAbs) {
  const indexHtml = path.join(webDirAbs, 'index.html');
  if (await exists(indexHtml)) return;

  const clientPkgPath = path.join(clientRoot, 'package.json');
  const hasBuild = (await exists(clientPkgPath))
    ? !!(JSON.parse(await fs.readFile(clientPkgPath, 'utf8')).scripts || {}).build
    : false;

  if (!hasBuild || noBuild) {
    throw new Error(
      `index.html not found in ${webDirAbs}. Build your web app into that folder (or adjust webDir in capacitor.config).`
    );
  }

  const { pm, build, buildAlt } = await detectPM();
  log('build', `index.html not found in ${webDirAbs}. Running ${pm} ${build.join(' ')} ...`);
  try {
    await run('build', pm, build, { cwd: clientRoot, env: process.env });
  } catch (e) {
    if (pm === 'pnpm' && buildAlt) {
      log('build', `Retrying ${pm} ${buildAlt.join(' ')} ...`);
      await run('build', pm, buildAlt, { cwd: clientRoot, env: process.env });
    } else { throw e; }
  }

  if (!(await exists(indexHtml))) {
    throw new Error(`Build finished but ${indexHtml} is still missing. Ensure your frontend outputs to ${webDirAbs}.`);
  }
}

// Figure out resources dir for @capacitor/assets (skip if none). 
// CLI supports --assetPath and defaults to checking "assets" then "resources". 
// https://github.com/ionic-team/capacitor-assets
async function resolveAssetsPath(cfg) {
  if (flagAssetPath && flagAssetPath !== true) {
    return path.isAbsolute(flagAssetPath)
      ? flagAssetPath
      : path.resolve(path.dirname(cfg.path), flagAssetPath);
  }
  const candidates = [
    path.join(clientRoot, 'resources'),
    path.join(clientRoot, 'assets'),
    path.join(path.dirname(cfg.path), 'resources'),
    path.join(path.dirname(cfg.path), 'assets'),
  ];
  for (const c of candidates) if (await exists(c)) return c;
  return null;
}

async function main() {
  try {
    await ensureCLIs();
    await cleanGeneratedAssets();

    const cfg = await readCapConfig();
    const webDirAbs = resolveWebDirAbs(cfg); // e.g. ../www → client/www
    log('sync', `Resolved webDir (from ${path.basename(cfg.path)}): ${webDirAbs}`);

    await ensureWebAssets(webDirAbs); // Capacitor requires index.html in webDir. :contentReference[oaicite:1]{index=1}

    const assetsPath = await resolveAssetsPath(cfg);
    if (assetsPath) {
      log('assets', `Using assets from: ${assetsPath}`);
      await run('assets', 'capacitor-assets', ['generate', '--assetPath', assetsPath], { cwd: capRoot });
    } else {
      log('assets', 'No assets/resources folder found — skipping icon/splash generation.');
    }

    // Run CLI from the folder that contains the Capacitor config (so it picks it up)
    await run('sync', 'cap', ['sync'], { cwd: capRoot });

    console.log('✨ setup(action/capacitor) complete.');
  } catch (e) {
    console.error('❌ setup(action/capacitor) failed:', e.message);
    process.exit(1);
  }
}

main();
