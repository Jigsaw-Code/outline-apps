// client/src/capacitor/build.action.mjs
import { execSync } from 'node:child_process';

const platform = process.argv[2];
if (!platform) {
  console.error('Usage: node build.action.mjs <ios|android>');
  process.exit(1);
}
if (platform === 'ios') {
  // Open iOS project in Xcode
  try {
    execSync('npx cap open ios', { stdio: 'inherit' });  // opens Xcode:contentReference[oaicite:10]{index=10}
  } catch (error) {
    console.error('Failed to open iOS project:', error);
    process.exit(1);
  }
} else if (platform === 'android') {
  // Open Android project in Android Studio
  try {
    execSync('npx cap open android', { stdio: 'inherit' });  // opens Android Studio:contentReference[oaicite:11]{index=11}
  } catch (error) {
    console.error('Failed to open Android project:', error);
    process.exit(1);
  }
} else {
  console.error(`Unknown platform "${platform}". Use "ios" or "android".`);
  process.exit(1);
}
