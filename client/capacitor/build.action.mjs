import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const capRoot    = __dirname;                // /.../client/capacitor (Capacitor config lives here)
const clientRoot = path.resolve(capRoot, '..');     // /.../client
const repoRoot   = path.resolve(clientRoot, '..');  // /.../outline-apps

const isWin = process.platform === 'win32';
const CAP_BIN_NAME = isWin ? 'cap.cmd' : 'cap';

function bindir(dir) { return path.join(dir, 'node_modules', '.bin'); }
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

function withLocalBins(extraEnv = {}) {
  // Put both client/.bin and repo/.bin on PATH so either location works
  const bins = [bindir(clientRoot), bindir(repoRoot)].join(path.delimiter);
  const PATH = process.env.PATH ? `${bins}${path.delimiter}${process.env.PATH}` : bins;
  return { ...process.env, PATH, ...extraEnv };
}

function log(step, msg) { console.log(`▶ ${step}: ${msg}`); }

function run(step, cmd, args, { cwd = capRoot, env } = {}) {
  return new Promise((resolve, reject) => {
    log(step, `Running [${cmd} ${args.join(' ')}]`);
    const child = spawn(cmd, args, {
      cwd,
      env: env || withLocalBins(),
      shell: isWin,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    child.stdout.on('data', d => { process.stdout.write(d); out += d; });
    child.stderr.on('data', d => { process.stderr.write(d); err += d; });
    child.on('error', e => reject(new Error(`${step}: failed to spawn "${cmd}" (${e.code || 'UNKNOWN'})`)));
    child.on('close', code => code === 0
      ? resolve({ stdout: out, stderr: err })
      : reject(new Error(`${step} failed with exit code ${code}\n\n--- output ---\n${(err || out || '').trim()}\n--------------`)));
  });
}

async function detectPM() {
  const isPNPM = await exists(path.join(repoRoot, 'pnpm-lock.yaml')) || await exists(path.join(clientRoot, 'pnpm-lock.yaml'));
  const isYarn = await exists(path.join(repoRoot, 'yarn.lock')) || await exists(path.join(clientRoot, 'yarn.lock'));
  if (isPNPM) return { pm: 'pnpm', addDev: ['add', '-D'] };
  if (isYarn) return { pm: 'yarn', addDev: ['add', '--dev'] };
  return { pm: 'npm', addDev: ['i', '-D'] };
}

function yarnPnpDetected() {
  return ['.pnp.cjs', '.pnp.js'].some(f => require('fs').existsSync(path.join(repoRoot, f)));
}

async function findCapBin() {
  // Look in client/.bin then repo/.bin
  const candidates = [path.join(bindir(clientRoot), CAP_BIN_NAME), path.join(bindir(repoRoot), CAP_BIN_NAME)];
  for (const p of candidates) if (await exists(p)) return p;
  return null;
}

async function ensureCapacitorCLIInstalled() {
  // If bin is in either location, we’re good
  let capBin = await findCapBin();
  if (capBin || yarnPnpDetected()) return capBin; // Yarn PnP may have no .bin

  // Install into the client workspace
  const { pm, addDev } = await detectPM();
  log('deps', `@capacitor/cli not found. Installing with ${pm} in ${clientRoot}...`);
  await run('deps', pm, [...addDev, '@capacitor/cli'], { cwd: clientRoot, env: process.env });

  // Re-check both locations
  capBin = await findCapBin();

  // pnpm/yarn workspaces may hoist to repo/.bin; already in PATH via withLocalBins()
  if (!capBin && !yarnPnpDetected()) {
    throw new Error(`@capacitor/cli installation finished but no "cap" binary was found in:
  - ${bindir(clientRoot)}
  - ${bindir(repoRoot)}
If you use Yarn PnP, this is expected (no node_modules/.bin).`);
  }

  return capBin;
}

function requirePlatformArg() {
  const platform = (process.argv[2] || '').toLowerCase();
  if (!['ios', 'android'].includes(platform)) {
    console.error('Usage: node client/capacitor/build.action.mjs <ios|android>');
    process.exit(2);
  }
  return platform;
}

async function ensureHasCapConfig() {
  const hasJson = await exists(path.join(capRoot, 'capacitor.config.json'));
  const hasTs   = await exists(path.join(capRoot, 'capacitor.config.ts'));
  if (!hasJson && !hasTs) {
    throw new Error(`No Capacitor config found in ${capRoot}. Add capacitor.config.ts/json there so the CLI can locate your project.`);
  }
}

(async () => {
  try {
    await ensureHasCapConfig();
    const platform = requirePlatformArg();

    // Make sure CLI exists or is installable
    const capBin = await ensureCapacitorCLIInstalled();

    if (capBin) {
      // Use the resolved binary explicitly (robust across npm/pnpm/yarn workspaces)
      await run('cap/open', capBin, ['open', platform], { cwd: capRoot });
    } else if (yarnPnpDetected()) {
      // Yarn PnP: run via `yarn cap open …`
      await run('cap/open', 'yarn', ['cap', 'open', platform], { cwd: capRoot, env: process.env });
    } else {
      // Shouldn’t happen, but leave a clear error
      throw new Error('Could not locate the "cap" command after installation.');
    }

    console.log('✨ build(action/capacitor) done.');
  } catch (e) {
    console.error('❌ build(action/capacitor) failed:', e.message);
    process.exit(1);
  }
})();
