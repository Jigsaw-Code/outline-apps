if (process.arch === 'arm64') {
  process._archPath = require.resolve('../app-arm64.asar');
} else {
  process._archPath = require.resolve('../app-x64.asar');
}

require(process._archPath);
