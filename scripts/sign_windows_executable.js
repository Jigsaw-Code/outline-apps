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

const minimist = require('minimist');
const fsPromises = require('fs/promises');
const fs = require('fs');
const path = require('path');
const util = require('util');

function assert(condition, msg) {
  if (!condition) {
    throw new Error(msg);
  }
}

async function assertFileExists(file, msg) {
  try {
    await fsPromises.access(file, fs.constants.R_OK | fs.constants.W_OK);
  } catch (err) {
    throw new Error(util.format(msg, file), { cause: err });
  }
}

/**
 * Get the required option value from either cliValue or environment variable.
 * @param {object} options the CLI options object.
 * @param {string} argName the CLI argument name.
 * @param {string} envName the environment variable name for this option.
 * @param {boolean} required indicates whether this option is required.
 * @returns {string} the value of the option
 */
function getOptionValue(options, argName, envName, required) {
  const cliValue = options ? options[argName] : null;
  const v = cliValue ?? process.env[envName];
  if (required) {
    assert(!!v, `either --${argName} or ${envName} is required`);
  }
  return v;
}

function appendPfxJsignArgs(args, options) {
  // self-signed development certificate
  const pfxCert = getOptionValue(options, 'pfx',
    'WINDOWS_SIGNING_PFX_CERT', true);
  args.push('--keystore', pfxCert);
}

function appendDigicertUsbJsignArgs(args, options) {
  // extended validation certificate stored in USB drive
  const subject = getOptionValue(options, 'subject',
    'WINDOWS_SIGNING_EV_CERT_SUBJECT', false);
  if (subject) {
    args.push('--alias', subject);
  }

  switch (process.platform) {
    case 'win32':
      args.push('--keystore', 'scripts/digicert-usb-config/eToken-windows.cfg');
      break;
    case 'darwin':
      args.push('--keystore', 'scripts/digicert-usb-config/eToken-macos.cfg');
      break;
    default:
      throw new Error(`we do not support ev signing on ${process.platform}`);
  }
}

/**
 * Sign the target exeFile using a specific algorithm and options.
 * @param {string} exeFile the full path of the exe file to be signed.
 * @param {'sha1'|'sha256'} algorithm the algorithm used for signing.
 * @param {object} options the additional options (cli arguments) for signing.
 */
async function signWindowsExecutable(exeFile, algorithm, options) {
  const type = getOptionValue(options, 'certtype',
    'WINDOWS_SIGNING_CERT_TYPE', true);
  if (!type || type == 'none') {
    console.info(`skip signing "${exeFile}"`);
    return;
  }

  assert(!!exeFile, 'executable path is required');
  assert(algorithm == 'sha1' || algorithm == 'sha256',
    'hashing algorithm must be either "sha1" or "sha256"');

  exeFile = path.resolve(exeFile);
  await assertFileExists(exeFile, 'executable file "%s" does not exist');

  const password = getOptionValue(options, 'password',
    'WINDOWS_SIGNING_CERT_PASSWORD', true);

  var jsignArgs = [
    '--alg', algorithm == 'sha256' ? 'SHA-256' : 'SHA-1',
    '--tsaurl', 'http://timestamp.digicert.com',
    '--storepass', password];

  switch (type) {
    case 'pfx':
      appendPfxJsignArgs(jsignArgs, options);
      break;
    case 'usb':
      appendDigicertUsbJsignArgs(jsignArgs, options);
      break;
    default:
      throw new Error(`cert type ${type} is not supported`);
  }

  // This is how we use ES6 modules in CommonJS
  const { default: jsign } = await import('./jsign.mjs');
  const exitCode = await jsign(exeFile, jsignArgs);
  if (exitCode == 0) {
    console.info(`successfully signed "${exeFile}"`);
  } else {
    console.error(`jsign exited with error code ${exitCode}`);
  }
}

/**
 * The entry point which will be called by electron-builder signing module.
 * @param {Object} configuration a configuration containing signing information
 * @param {string} configuration.path the executable file path to be signed
 * @param {'sha1'|'sha256'} configuration.hash requested hash algorithm
 * @param {boolean} configuration.isNest whether it is a secondary signature
 * @param {Object} configuration.options a duplication of electron-builder.json
 */
async function electronBuilderEntryPoint(configuration) {
  console.info(configuration);
  await signWindowsExecutable(configuration.path, configuration.hash, null);
}

/**
 * The entry point when calling this script from cli.
 */
async function cliEntryPoint() {
  const { target, algorithm, ...options } = minimist(process.argv);
  await signWindowsExecutable(target, algorithm, options);
}

// CommonJS module is required, ES6 module is not supported by electron-builder
exports.default = electronBuilderEntryPoint;

// If this is called by CLI:
//   node ./scripts/sign_windows_executable.js
//     --target <exe-path-to-sign>
//     --algorithm <sha1|sha256>
//     --certtype <none|pfx|usb>
//     --password <cert-store-password>
// The following options are for --certtype == pfx
//     --pfx <pfx-cert-path>
// The following options are for --certtype == usb
//     [--subject <cert-subject-name>]
if (require.main === module) {
  cliEntryPoint();
}
