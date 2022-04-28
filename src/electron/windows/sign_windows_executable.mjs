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

import {spawn} from 'child_process';
import {constants} from 'fs';
import {access} from 'fs/promises';
import minimist from 'minimist';
import {dirname, resolve} from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {format} from 'util';

/**
 * Get the parent folder path of this script.
 * @returns the folder path containing the current script.
 */
function currentDirname() {
  return dirname(fileURLToPath(import.meta.url));
}

/**
 * Get the outline-client root folder path.
 * @returns the folder path of outline-client root.
 */
function outlineDirname() {
  return resolve(currentDirname(), '..', '..', '..');
}

function assert(condition, msg) {
  if (!condition) {
    throw new Error(msg);
  }
}

async function assertFileExists(file, msg) {
  try {
    await access(file, constants.R_OK | constants.W_OK);
  } catch (err) {
    throw new Error(format(msg, file), {cause: err});
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
  args.push('--storetype', 'PKCS12');

  const pfxCert = getOptionValue(options, 'pfx', 'WINDOWS_SIGNING_PFX_CERT', true);
  args.push('--keystore', pfxCert);
}

function appendDigicertUsbJsignArgs(args, options) {
  // extended validation certificate stored in USB drive
  args.push('--storetype', 'PKCS11');

  const subject = getOptionValue(options, 'subject', 'WINDOWS_SIGNING_EV_CERT_SUBJECT', false);
  if (subject) {
    args.push('--alias', subject);
  }

  var eTokenCfg;
  switch (process.platform) {
    case 'win32':
      eTokenCfg = resolve(currentDirname(), 'digicert-usb-config', 'eToken-windows.cfg');
      break;
    case 'darwin':
      eTokenCfg = resolve(currentDirname(), 'digicert-usb-config', 'eToken-macos.cfg');
      break;
    default:
      throw new Error(`we do not support ev signing on ${process.platform}`);
  }
  args.push('--keystore', eTokenCfg);
}

/**
 * Run jsign.jar according to the corresponding options targeting fileToSign.
 * @param {string} fileToSign The path string of a file to be signed.
 * @param {string[]} options The options to be passed to jsign. see https://ebourg.github.io/jsign/
 * @returns {Promise<number>} A promise containing the exit code of jsign.
 */
function jsign(fileToSign, options) {
  if (!options) {
    throw new Error('options are required by jsign');
  }
  if (!fileToSign) {
    throw new Error('fileToSign is required by jsign');
  }

  const jSignJarPath = resolve(outlineDirname(), 'third_party', 'jsign', 'jsign-4.0.jar');
  const jsignProc = spawn('java', ['-jar', jSignJarPath, ...options, fileToSign], {
    stdio: 'inherit',
  });
  return new Promise((resolve, reject) => {
    jsignProc.on('error', reject);
    jsignProc.on('exit', resolve);
  });
}

/**
 * Sign the target exeFile using a specific algorithm and options.
 * @param {string} exeFile the full path of the exe file to be signed.
 * @param {'sha1'|'sha256'} algorithm the algorithm used for signing.
 * @param {object} options additional options (cli arguments) for signing.
 *                         the options will also be read from environment
 *                         variables.
 */
export async function signWindowsExecutable(exeFile, algorithm, options) {
  const type = getOptionValue(options, 'certtype', 'WINDOWS_SIGNING_CERT_TYPE', false);
  if (!type || type === 'none') {
    console.info(`skip signing "${exeFile}"`);
    return;
  }

  assert(!!exeFile, 'executable path is required');
  assert(algorithm === 'sha1' || algorithm === 'sha256', 'hashing algorithm must be either "sha1" or "sha256"');

  exeFile = resolve(exeFile);
  await assertFileExists(exeFile, 'executable file "%s" does not exist');

  const password = getOptionValue(options, 'password', 'WINDOWS_SIGNING_CERT_PASSWORD', true);

  const jsignArgs = [
    '--alg',
    algorithm === 'sha256' ? 'SHA-256' : 'SHA-1',
    '--tsaurl',
    'http://timestamp.digicert.com',
    '--storepass',
    password,
  ];

  switch (type) {
    case 'pfx':
      appendPfxJsignArgs(jsignArgs, options);
      break;
    case 'digicert-usb':
      appendDigicertUsbJsignArgs(jsignArgs, options);
      break;
    default:
      throw new Error(`cert type ${type} is not supported`);
  }

  var exitCode;
  try {
    exitCode = await jsign(exeFile, jsignArgs);
  } catch (err) {
    console.error('failed to start java, please make sure you have installed java');
    throw new Error(err);
  }

  if (exitCode === 0) {
    console.info(`successfully signed "${exeFile}"`);
  } else {
    console.error(`jsign exited with error code ${exitCode}`);
    throw new Error(`failed to sign "${exeFile}"`);
  }
}

async function main() {
  const {target, algorithm, ...options} = minimist(process.argv);
  await signWindowsExecutable(target, algorithm, options);
}

// Call this script through CLI to sign a Windows executable:
//   node sign_windows_executable.mjs
//     --target <exe-path-to-sign>
//     --algorithm <sha1|sha256>
//     --certtype <none|pfx|digicert-usb>
//     --password <cert-store-password>
// The following options are for --certtype == pfx
//     --pfx <pfx-cert-path>
// The following options are for --certtype == digicert-usb
//     [--subject <cert-subject-name>]
//
// You can also use environment variables to specify some arguments:
//   WINDOWS_SIGNING_CERT_TYPE       <=> --certtype
//   WINDOWS_SIGNING_CERT_PASSWORD   <=> --password
//   WINDOWS_SIGNING_PFX_CERT        <=> --pfx
//   WINDOWS_SIGNING_EV_CERT_SUBJECT <=> --subject
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (err) {
    console.error(err);
  }
}
