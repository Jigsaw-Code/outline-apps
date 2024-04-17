// Copyright 2022 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// CommonJS module is required, ES6 module is not supported by electron-builder:
//   /outline-client/node_modules/app-builder-lib/out/platformPackager.js:597
//       const m = require(p);
//       ^
//   Error [ERR_REQUIRE_ESM]: require() of ES Module .../electron_builder_signing_plugin.mjs not supported.
//   Instead change the require of .../electron_builder_signing_plugin.mjs to a dynamic import() which is
//   available in all CommonJS modules.

/**
 * The entry point which will be called by electron-builder signing module.
 * @param {Object} configuration a configuration containing signing information
 * @param {string} configuration.path the executable file path to be signed
 * @param {'sha1'|'sha256'} configuration.hash requested hash algorithm
 * @param {boolean} configuration.isNest whether it is a secondary signature
 * @param {Object} configuration.options a duplication of electron-builder.json
 */
async function electronBuilderEntryPoint(configuration) {
  const {runAction} = await import('../../build/run_action.mjs');
  await runAction('src/electron/windows/sign_windows_executable',
    '--target', configuration.path,
    '--algorithm', configuration.hash);
}

exports.default = electronBuilderEntryPoint;
