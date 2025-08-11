// client/src/capacitor/build.action.mjs
import { execSync } from 'node:child_process';

const platform = process.argv[2];
if (!platform) {
  console.error('Usage: node build.action.mjs <ios|android>');
  process.exit(1);
}

try {
  if (platform === 'ios') {
    execSync('cap open ios', { stdio: 'inherit' });
  } else if (platform === 'android') {
    execSync('cap open android', { stdio: 'inherit' });
  } else {
    console.error(`Unknown platform "${platform}". Use "ios" or "android".`);
    process.exit(1);
  }
} catch (error) {
  console.error(`Failed to open ${platform} project:`, error);
  process.exit(1);
}
