// client/src/capacitor/setup.action.mjs
import { execSync } from 'node:child_process';
try {
  execSync('npx capacitor-assets generate', { stdio: 'inherit' });
  execSync('npx cap sync', { stdio: 'inherit' });
  console.log('✅ Capacitor assets generated and sync completed.');
} catch (error) {
  console.error('⚠️ Error during Capacitor setup:', error);
  process.exit(1);
}
