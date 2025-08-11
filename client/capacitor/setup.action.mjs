// client/src/capacitor/setup.action.mjs
import { execSync } from 'node:child_process';

try {
  // Clean Capacitor-generated web assets
  execSync('npm run clean', { stdio: 'inherit' });

  // Generate icons & splash screens from resources
  execSync('capacitor-assets generate', { stdio: 'inherit' });

  // Sync the web app with native projects
  execSync('cap sync', { stdio: 'inherit' });

  console.log('✅ Capacitor setup completed: assets generated, synced with native projects.');
} catch (error) {
  console.error('⚠️ Error during Capacitor setup:', error);
  process.exit(1);
}
