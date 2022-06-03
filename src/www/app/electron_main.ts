// Copyright 2018 The Outline Authors
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

import 'web-animations-js/web-animations-next-lite.min.js';
import '@webcomponents/webcomponentsjs/webcomponents-bundle.js';

import * as sentry from '@sentry/electron';
import {clipboard, ipcRenderer} from 'electron';
import promiseIpc from 'electron-promise-ipc';
import * as os from 'os';

import {ErrorCode, OutlinePluginError} from '../model/errors';

import {AbstractClipboard} from './clipboard';
import {ElectronOutlineTunnel} from './electron_outline_tunnel';
import {EnvironmentVariables} from './environment';
import {getSentryBrowserIntegrations, OutlineErrorReporter} from './error_reporter';
import {FakeNativeNetworking} from './fake_net';
import {FakeOutlineTunnel} from './fake_tunnel';
import {getLocalizationFunction, main} from './main';
import {NativeNetworking} from './net';
import {AbstractUpdater} from './updater';
import {UrlInterceptor} from './url_interceptor';
import {VpnInstaller} from './vpn_installer';

const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';
const isOsSupported = isWindows || isLinux;

const interceptor = new UrlInterceptor();
ipcRenderer.on('add-server', (e: Event, url: string) => {
  interceptor.executeListeners(url);
});

ipcRenderer.on('localizationRequest', (e: Event, localizationKeys: string[]) => {
  const localize = getLocalizationFunction();
  if (!localize) {
    console.error('Localization function not available.');
    ipcRenderer.send('localizationResponse', null);
    return;
  }
  const localizationResult: {[key: string]: string} = {};
  for (const key of localizationKeys) {
    localizationResult[key] = localize(key);
  }
  ipcRenderer.send('localizationResponse', localizationResult);
});

// Pushes a clipboard event whenever the app window receives focus.
class ElectronClipboard extends AbstractClipboard {
  constructor() {
    super();
    ipcRenderer.on('push-clipboard', this.emitEvent.bind(this));
  }

  getContents() {
    return Promise.resolve(clipboard.readText());
  }
}

class ElectronUpdater extends AbstractUpdater {
  constructor() {
    super();
    ipcRenderer.on('update-downloaded', this.emitEvent.bind(this));
  }
}

class ElectronVpnInstaller implements VpnInstaller {
  public async installVpn(): Promise<void> {
    const err = await ipcRenderer.invoke('install-outline-services');

    // catch custom errors (even simple as numbers) does not work for ipcRenderer:
    // https://github.com/electron/electron/issues/24427
    if (err !== ErrorCode.NO_ERROR) {
      throw new OutlinePluginError(err);
    }
  }
}

class ElectronErrorReporter implements OutlineErrorReporter {
  constructor(appVersion: string, privateDsn: string, appName: string) {
    if (privateDsn) {
      sentry.init({
        dsn: privateDsn,
        release: appVersion,
        appName,
        integrations: getSentryBrowserIntegrations,
      });
    }
  }

  report(userFeedback: string, feedbackCategory: string, userEmail?: string): Promise<void> {
    sentry.captureEvent({message: userFeedback, user: {email: userEmail}, tags: {category: feedbackCategory}});
    return Promise.resolve();
  }
}

class ElectronNativeNetworking implements NativeNetworking {
  async isServerReachable(hostname: string, port: number) {
    return promiseIpc.send('is-server-reachable', {hostname, port});
  }
}

main({
  hasDeviceSupport: () => isOsSupported,
  getNativeNetworking: () => {
    return isOsSupported ? new ElectronNativeNetworking() : new FakeNativeNetworking();
  },
  getTunnelFactory: () => {
    return (id: string) => {
      return isOsSupported ? new ElectronOutlineTunnel(id) : new FakeOutlineTunnel(id);
    };
  },
  getUrlInterceptor: () => interceptor,
  getClipboard: () => new ElectronClipboard(),
  getErrorReporter: (env: EnvironmentVariables) => {
    // Initialise error reporting in the main process.
    ipcRenderer.send('environment-info', {appVersion: env.APP_VERSION, dsn: env.SENTRY_DSN});
    return new ElectronErrorReporter(
      env.APP_VERSION,
      env.SENTRY_DSN || '',
      new URL(document.URL).searchParams.get('appName') || 'Outline Client'
    );
  },
  getUpdater: () => new ElectronUpdater(),
  getVpnServiceInstaller: () => new ElectronVpnInstaller(),
  quitApplication: () => ipcRenderer.send('quit-app'),
});
