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

import * as sentry from '@sentry/electron';
import {clipboard, ipcRenderer} from 'electron';
import * as os from 'os';

import {EventQueue} from '../model/events';

import {AbstractClipboard, Clipboard, ClipboardListener} from './clipboard';
import {EnvironmentVariables} from './environment';
import {OutlineErrorReporter} from './error_reporter';
import {FakeOutlineConnection} from './fake_connection';
import {getLocalizationFunction, main} from './main';
import {OutlineServer} from './outline_server';
import {OutlinePlatform} from './platform';
import {AbstractUpdater, UpdateListener, Updater} from './updater';
import {UrlInterceptor} from './url_interceptor';
import {WindowsOutlineConnection} from './windows_connection';

// Currently, proxying is only supported on Windows.
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

class ElectronErrorReporter implements OutlineErrorReporter {
  constructor(appVersion: string, privateDsn: string) {
    sentry.init({dsn: privateDsn, release: appVersion});
  }

  report(userFeedback: string, feedbackCategory: string, userEmail?: string): Promise<void> {
    sentry.captureEvent(
        {message: userFeedback, user: {email: userEmail}, tags: {category: feedbackCategory}});
    return Promise.resolve();
  }
}

main({
  hasDeviceSupport: () => {
    return isOsSupported;
  },
  getPersistentServerFactory: () => {
    return (serverId: string, config: cordova.plugins.outline.ServerConfig,
            eventQueue: EventQueue) => {
      return new OutlineServer(
          serverId, config,
          isOsSupported ? new WindowsOutlineConnection(config, serverId) :
                          new FakeOutlineConnection(config, serverId),
          eventQueue);
    };
  },
  getUrlInterceptor: () => {
    return interceptor;
  },
  getClipboard: () => {
    return new ElectronClipboard();
  },
  getErrorReporter: (env: EnvironmentVariables) => {
    // Initialise error reporting in the main process.
    ipcRenderer.send('environment-info', {'appVersion': env.APP_VERSION, 'dsn': env.SENTRY_DSN});
    return new ElectronErrorReporter(env.APP_VERSION, env.SENTRY_DSN);
  },
  getUpdater: () => {
    return new ElectronUpdater();
  },
  quitApplication: () => {
    ipcRenderer.send('quit-app');
  }
});
