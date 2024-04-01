if (process.arch === 'arm64') {
  process._archPath = require.resolve('../app-arm64');
} else {
  process._archPath = require.resolve('../app-x64');
}

require(process._archPath);
