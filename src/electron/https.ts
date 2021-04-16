// Copyright 2021 The Outline Authors
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

import * as http from 'http';
import * as https from 'https';
import * as tls from 'tls';

import {HttpsRequest, HttpsResponse} from '../www/app/net';

const HTTPS_TIMEOUT_MS = 30 * 1000;

/**
 * Retrieves data over HTTPs. When `request.certificateFingerprint` is set, validates the server TLS
 * certificate by comparing its fingerprint to the trusted certificate fingerprint.
 *
 * @param {HttpsRequest} request - HTTP request to send.
 * @returns {Promise<HtttpResponse>} - server HTTP response.
 */
export async function fetchHttps(request: HttpsRequest): Promise<HttpsResponse> {
  // TODO(alalama): wrap thrown errors with OutlineError subclasses.
  const url = new URL(request.url);
  if (url.protocol !== 'https:') {
    throw new Error('protocol must be https');
  }
  const validateServerCertificate = !!request.hexSha256CertFingerprint;
  const agentOptions = {
    // Disable system validation when we need to validate the server certificate.
    rejectUnauthorized: !validateServerCertificate,
    // Don't cache TLS sessions so we can validate the server certificate on each request.
    maxCachedSessions: 0,
    timeout: HTTPS_TIMEOUT_MS,
  };
  const agent = new https.Agent(agentOptions);
  const options = {method: request.method || 'GET', agent};
  let res: http.IncomingMessage;
  try {
    res = await new Promise(async (resolve, reject) => {
      const req = https.request(url, options, resolve);
      req.on('error', reject);
      req.on('timeout', () => {
        req.emit('error', new Error('connection timeout'));
        req.destroy();
      });
      if (!validateServerCertificate) {
        return req.end();
      }
      // Validate server certificate against the trusted certificate fingerprint.
      const cert = await getServerCertifcate(req);
      const hexSha256CertFingerprint = cert.fingerprint256.replace(/:/g, '');
      if (request.hexSha256CertFingerprint !== hexSha256CertFingerprint) {
        req.emit('error', new Error('failed to validate server TLS certificate'));
        return req.destroy();
      }
      req.end();
    });
  } catch (e) {
    throw e;
  }

  const statusCode = res.statusCode;
  if (statusCode >= 400) {
    return {statusCode};
  } else if (statusCode >= 300) {
    return {statusCode, redirectUrl: res.headers.location};
  }

  let data: string;
  try {
    data = await readResponseData(res);
  } catch (e) {
    throw e;
  }
  return {statusCode, data};
}

function getServerCertifcate(req: http.ClientRequest): Promise<tls.PeerCertificate> {
  return new Promise<tls.PeerCertificate>(resolve => {
    req.on('socket', socket => {
      socket.on('secureConnect', () => {
        resolve((socket as tls.TLSSocket).getPeerCertificate());
      });
    });
  });
}

function readResponseData(res: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('error', err => reject(err));
    res.on('end', () => resolve(data));
  });
}
