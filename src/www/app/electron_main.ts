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

/// <reference path="../../electron/preload.d.ts" />

import 'web-animations-js/web-animations-next-lite.min.js';
import '@webcomponents/webcomponentsjs/webcomponents-bundle.js';

import * as sentry from '@sentry/electron/renderer';

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
import {
  ADD_SERVER_CHANNEL,
  APP_UPDATE_DOWNLOADED_CHANNEL,
  CHECK_REACHABLE_CHANNEL,
  INSTALL_SERVICES_CHANNEL,
  LOCALIZATION_RESPONSE_CHANNEL,
  OutlineIpcClient,
  OutlineIpcHandler,
  PUSH_CLIPBOARD_CHANNEL,
  QUIT_APP_CHANNEL,
  REQUEST_LOCALIZATION_CHANNEL,
} from '../../electron/ipc';

const isWindows = window.electron.os.platform === 'win32';
const isLinux = window.electron.os.platform === 'linux';
const isOsSupported = isWindows || isLinux;

const ipcClient = new OutlineIpcClient(window.electron.ipc);
const ipcHandler = new OutlineIpcHandler(window.electron.ipc);

const interceptor = new UrlInterceptor();
ipcHandler.on(ADD_SERVER_CHANNEL, interceptor.executeListeners);

ipcHandler.on(REQUEST_LOCALIZATION_CHANNEL, localizationKeys => {
  const localize = getLocalizationFunction();
  if (!localize) {
    console.error('Localization function not available.');
    ipcClient.send(LOCALIZATION_RESPONSE_CHANNEL, null);
    return;
  }
  const localizationResult: {[key: string]: string} = {};
  for (const key of localizationKeys) {
    localizationResult[key] = localize(key);
  }
  ipcClient.send(LOCALIZATION_RESPONSE_CHANNEL, localizationResult);
});

// Pushes a clipboard event whenever the app window receives focus.
class ElectronClipboard extends AbstractClipboard {
  constructor() {
    super();
    ipcHandler.on(PUSH_CLIPBOARD_CHANNEL, this.emitEvent.bind(this));
  }

  getContents() {
    return navigator.clipboard.readText();
  }
}

class ElectronUpdater extends AbstractUpdater {
  constructor() {
    super();
    ipcHandler.on(APP_UPDATE_DOWNLOADED_CHANNEL, this.emitEvent.bind(this));
  }
}

class ElectronVpnInstaller implements VpnInstaller {
  public installVpn(): Promise<void> {
    return ipcClient.invoke(INSTALL_SERVICES_CHANNEL);
  }
}

class ElectronErrorReporter implements OutlineErrorReporter {
  constructor(appVersion: string, privateDsn: string) {
    if (privateDsn) {
      sentry.init({
        dsn: privateDsn,
        release: appVersion,
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
  isServerReachable(hostname: string, port: number) {
    return ipcClient.invoke(CHECK_REACHABLE_CHANNEL, hostname, port);
  }
}

main({
  hasDeviceSupport: () => isOsSupported,
  getNativeNetworking: () => {
    return isOsSupported ? new ElectronNativeNetworking() : new FakeNativeNetworking();
  },
  getTunnelFactory: () => {
    return (id: string) => {
      return isOsSupported ? new ElectronOutlineTunnel(id, ipcClient, ipcHandler) : new FakeOutlineTunnel(id);
    };
  },
  getUrlInterceptor: () => interceptor,
  getClipboard: () => new ElectronClipboard(),
  getErrorReporter: (env: EnvironmentVariables) => new ElectronErrorReporter(env.APP_VERSION, env.SENTRY_DSN || ''),
  getUpdater: () => new ElectronUpdater(),
  getVpnServiceInstaller: () => new ElectronVpnInstaller(),
  quitApplication: () => ipcClient.send(QUIT_APP_CHANNEL),
});
