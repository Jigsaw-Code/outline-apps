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

import {constants} from 'fs';
import {access} from 'fs/promises';
import minimist from 'minimist';
import {dirname, resolve} from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {format} from 'util';

import {jsign} from '../../../third_party/jsign/index.mjs';

/**
 * Get the parent folder path of this script.
 * @returns the folder path containing the current script.
 */
function currentDirname() {
  return dirname(fileURLToPath(import.meta.url));
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

function concatPfxJsignArgs(args, options) {
  // self-signed development certificate
  let newArgs = args.concat('--storetype', 'PKCS12');

  const pfxCert = getOptionValue(options, 'pfx', 'WINDOWS_SIGNING_PFX_CERT', true);
  newArgs = newArgs.concat('--keystore', pfxCert);

  return newArgs;
}

function concatDigicertUsbJsignArgs(args, options) {
  // extended validation certificate stored in USB drive
  let newArgs = args.concat('--storetype', 'PKCS11');

  const subject = getOptionValue(options, 'subject', 'WINDOWS_SIGNING_EV_CERT_SUBJECT', false);
  if (subject) {
    newArgs = newArgs.concat('--alias', subject);
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
  newArgs = newArgs.concat('--keystore', eTokenCfg);

  return newArgs;
}

function concatGcpHsmJsignArgs(args, options) {
  // Google Cloud Key Management HSM based certificate
  let newArgs = args.concat('--storetype', 'GOOGLECLOUD');

  const keyRing = getOptionValue(options, 'gcp-keyring', 'WINDOWS_SIGNING_GCP_KEYRING', true);
  newArgs = newArgs.concat('--keystore', keyRing);

  const keyName = getOptionValue(options, 'gcp-private-key', 'WINDOWS_SIGNING_GCP_PRIVATE_KEY', true);
  newArgs = newArgs.concat('--alias', keyName);

  const certFile = getOptionValue(options, 'gcp-public-cert', 'WINDOWS_SIGNING_GCP_PUBLIC_CERT', true);
  newArgs = newArgs.concat('--certfile', certFile);

  return newArgs;
}

/**
 * Sign the target exeFile using a specific algorithm and options.
 * @param {string} exeFile the full path of the exe file to be signed.
 * @param {'sha1'|'sha256'} algorithm the algorithm used for signing.
 * @param {object} options additional options (cli arguments) for signing.
 *                         the options will also be read from environment
 *                         variables.
 */
async function signWindowsExecutable(exeFile, algorithm, options) {
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

  let jsignArgs = [
    '--alg',
    algorithm === 'sha256' ? 'SHA-256' : 'SHA-1',
    '--tsaurl',
    'http://timestamp.digicert.com',
    '--storepass',
    password,
  ];

  switch (type) {
    case 'pfx':
      jsignArgs = concatPfxJsignArgs(jsignArgs, options);
      break;
    case 'digicert-usb':
      jsignArgs = concatDigicertUsbJsignArgs(jsignArgs, options);
      break;
    case 'gcp-hsm':
      jsignArgs = concatGcpHsmJsignArgs(jsignArgs, options);
      break;
    default:
      throw new Error(`cert type ${type} is not supported`);
  }

  var exitCode;
  try {
    exitCode = await jsign(exeFile, jsignArgs);
  } catch (err) {
    throw new Error('failed to run jsign', {cause: err});
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
//   npm run action src/electron/windows/sign_windows_executable --
//     --target <exe-path-to-sign>
//     --algorithm <sha1|sha256>
//     --certtype <none|pfx|digicert-usb|gcp-hsm>
//     --password <cert-store-password|gcp-access-token>
// The following options are for --certtype == pfx
//     --pfx <pfx-cert-path>
// The following options are for --certtype == digicert-usb
//     [--subject <cert-subject-name>]
// The following options are for --certtype == gcp-hsm
//     --gcp-keyring <full-id: https://cloud.google.com/kms/docs/resource-hierarchy#retrieve_resource_id>
//     --gcp-private-key <name-of-the-key-in-key-ring>
//     --gcp-public-cert <full-path-of-the-public-certificate-file>
//
// You can also use environment variables to specify some arguments:
//   WINDOWS_SIGNING_CERT_TYPE       <=> --certtype
//   WINDOWS_SIGNING_CERT_PASSWORD   <=> --password
//   WINDOWS_SIGNING_PFX_CERT        <=> --pfx
//   WINDOWS_SIGNING_EV_CERT_SUBJECT <=> --subject
//   WINDOWS_SIGNING_GCP_KEYRING     <=> --gcp-keyring
//   WINDOWS_SIGNING_GCP_PRIVATE_KEY <=> --gcp-private-key
//   WINDOWS_SIGNING_GCP_PUBLIC_CERT <=> --gcp-public-cert
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
