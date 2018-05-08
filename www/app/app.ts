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

import {SHADOWSOCKS_URI} from 'ShadowsocksConfig/shadowsocks_config';

import * as errors from '../model/errors';
import * as events from '../model/events';
import {Server} from '../model/server';

import {Clipboard} from './clipboard';
import {EnvironmentVariables} from './environment';
import {OutlineErrorReporter} from './error_reporter';
import {getLocalizedErrorMessage, LocalizationFunction} from './i18n';
import {OutlineServer} from './outline_server';
import {PersistentServerRepository} from './persistent_server';
import {Settings, SettingsKey} from './settings';
import {Updater} from './updater';
import {UrlInterceptor} from './url_interceptor';

export class App {
  private serverListEl: polymer.Base;
  private feedbackViewEl: polymer.Base;
  private localize: LocalizationFunction;
  private ignoredAccessKeys: {[accessKey: string]: boolean;} = {};

  constructor(
      private eventQueue: events.EventQueue, private serverRepo: PersistentServerRepository,
      private rootEl: polymer.Base, private debugMode: boolean,
      urlInterceptor: UrlInterceptor|undefined, private clipboard: Clipboard,
      private errorReporter: OutlineErrorReporter, private settings: Settings,
      private environmentVars: EnvironmentVariables, private updater: Updater,
      document = window.document) {
    this.serverListEl = rootEl.$.serversView.$.serverList;
    this.feedbackViewEl = rootEl.$.feedbackView;

    this.syncServersToUI();
    this.syncConnectivityStateToServerCards();
    rootEl.$.aboutView.version = environmentVars.APP_VERSION;

    this.localize = this.rootEl.localize.bind(this.rootEl);

    this.registerUrlInterceptionListener(urlInterceptor);
    this.clipboard.setListener(this.handleClipboardText.bind(this));

    this.updater.setListener(this.updateDownloaded.bind(this));

    // Register Cordova mobile foreground event to sync server connectivity.
    document.addEventListener('resume', this.syncConnectivityStateToServerCards.bind(this));

    // Register handlers for events fired by Polymer components.
    this.rootEl.addEventListener(
        'PromptAddServerRequested', this.requestPromptAddServer.bind(this));
    this.rootEl.addEventListener(
        'AddServerConfirmationRequested', this.requestAddServerConfirmation.bind(this));
    this.rootEl.addEventListener('AddServerRequested', this.requestAddServer.bind(this));
    this.rootEl.addEventListener('IgnoreServerRequested', this.requestIgnoreServer.bind(this));
    this.rootEl.addEventListener('ConnectPressed', this.connectServer.bind(this));
    this.rootEl.addEventListener('DisconnectPressed', this.disconnectServer.bind(this));
    this.rootEl.addEventListener('ForgetPressed', this.forgetServer.bind(this));
    this.rootEl.addEventListener('RenameRequested', this.renameServer.bind(this));
    this.rootEl.addEventListener('QuitPressed', this.quitApplication.bind(this));
    this.rootEl.addEventListener(
        'ShowServerRename', this.rootEl.showServerRename.bind(this.rootEl));
    this.feedbackViewEl.$.submitButton.addEventListener('tap', this.submitFeedback.bind(this));

    // Register handlers for events published to our event queue.
    this.eventQueue.subscribe(events.ServerAdded, this.showServerAdded.bind(this));
    this.eventQueue.subscribe(events.ServerForgotten, this.showServerForgotten.bind(this));
    this.eventQueue.subscribe(events.ServerRenamed, this.showServerRenamed.bind(this));
    this.eventQueue.subscribe(events.ServerForgetUndone, this.showServerForgetUndone.bind(this));
    this.eventQueue.subscribe(events.ServerConnected, this.showServerConnected.bind(this));
    this.eventQueue.subscribe(events.ServerDisconnected, this.showServerDisconnected.bind(this));
    this.eventQueue.subscribe(events.ServerReconnecting, this.showServerReconnecting.bind(this));

    this.eventQueue.startPublishing();

    this.displayZeroStateUi();
    this.pullClipboardText();
  }

  showLocalizedError(err?: Error, toastDuration = 10000) {
    if (err && err.message) {
      console.error(err.message);
    }
    if (this.rootEl && this.rootEl.async && this.rootEl.showToast) {
      const msg = getLocalizedErrorMessage(err || new errors.OutlineError(), this.localize);
      // Defer this by 500ms so that this toast is shown after any toasts that get
      // shown when any currently-in-flight domain events land (e.g. fake servers
      // added).
      this.rootEl.async(() => {
        this.rootEl.showToast(msg, toastDuration);
      }, 500);
    }
  }

  // Terminates the application by calling the native Outline plugin. The quit option is only
  // displayed in macOS, since menu bar apps provide no alternative way of quitting.
  private quitApplication() {
    cordova.plugins.outline.quitApplication();
  }

  private pullClipboardText() {
    this.clipboard.getContents().then(
        (text: string) => {
          this.handleClipboardText(text);
        },
        (e) => {
          console.warn('cannot read clipboard, system may lack clipboard support');
        });
  }

  private showServerConnected(event: events.ServerDisconnected): void {
    console.debug(`server ${event.server.id} connected`);
    const card = this.serverListEl.getServerCard(event.server.id);
    card.state = 'CONNECTED';
  }

  private showServerDisconnected(event: events.ServerDisconnected): void {
    console.debug(`server ${event.server.id} disconnected`);
    try {
      this.serverListEl.getServerCard(event.server.id).state = 'DISCONNECTED';
    } catch (e) {
      console.warn('server card not found after disconnection event, assuming forgotten');
    }
  }

  private showServerReconnecting(event: events.ServerDisconnected): void {
    console.debug(`server ${event.server.id} reconnecting`);
    const card = this.serverListEl.getServerCard(event.server.id);
    card.state = 'RECONNECTING';
  }

  private displayZeroStateUi() {
    if (this.rootEl.$.serversView.shouldShowZeroState) {
      this.rootEl.$.addServerView.openAddServerSheet();
    }
  }

  private handleClipboardText(text: string) {
    // Shorten, sanitise.
    // Note that we always check the text, even if the contents are same as last time, because we
    // keep an in-memory cache of user-ignored access keys.
    text = text.substring(0, 1000).trim();
    try {
      this.confirmAddServer(text, true);
    } catch (err) {
      // Don't alert the user; high false positive rate.
    }
  }

  private updateDownloaded() {
    this.rootEl.showToast(this.localize('update-downloaded'), 60000);
  }

  private requestPromptAddServer() {
    this.rootEl.promptAddServer();
  }

  // Caches an ignored server access key so we don't prompt the user to add it again.
  private requestIgnoreServer(event: CustomEvent) {
    const accessKey = event.detail.accessKey;
    this.ignoredAccessKeys[accessKey] = true;
  }

  private requestAddServer(event: CustomEvent) {
    try {
      this.serverRepo.add(event.detail.serverConfig);
    } catch (err) {
      this.changeToDefaultPage();
      this.showLocalizedError(err);
    }
  }

  private requestAddServerConfirmation(event: CustomEvent) {
    const accessKey = event.detail.accessKey;
    console.debug('Got add server confirmation request from UI');
    try {
      this.confirmAddServer(accessKey);
    } catch (err) {
      console.error('Failed to confirm add sever.', err);
      const addServerView = this.rootEl.$.addServerView;
      addServerView.$.accessKeyInput.invalid = true;
    }
  }

  private confirmAddServer(accessKey: string, fromClipboard = false) {
    if (fromClipboard && accessKey in this.ignoredAccessKeys) {
      console.debug('Ignoring access key');
      return;
    }
    // Expect SHADOWSOCKS_URI.parse to throw on invalid access key; propagate any exception.
    let shadowsocksConfig = null;
    try {
      shadowsocksConfig = SHADOWSOCKS_URI.parse(accessKey);
    } catch (error) {
      const message = !!error.message ? error.message : 'Failed to parse access key';
      throw new errors.ServerUrlInvalid(message);
    }
    if (shadowsocksConfig.host.isIPv6) {
      throw new errors.ServerIncompatible('Only IPv4 addresses are currently supported');
    }
    const name = shadowsocksConfig.extra.outline ?
        this.localize('server-default-name-outline') :
        shadowsocksConfig.tag.data ? shadowsocksConfig.tag.data :
                                     this.localize('server-default-name');
    const serverConfig = {
      host: shadowsocksConfig.host.data,
      port: shadowsocksConfig.port.data,
      method: shadowsocksConfig.method.data,
      password: shadowsocksConfig.password.data,
      name,
    };
    const addServerView = this.rootEl.$.addServerView;
    if (!this.serverRepo.containsServer(serverConfig)) {
      // Only prompt the user to add new servers.
      try {
        addServerView.openAddServerConfirmationSheet(accessKey, serverConfig);
      } catch (err) {
        console.error('Failed to open add sever confirmation sheet:', err.message);
        if (!fromClipboard) this.showLocalizedError();
      }
    } else if (!fromClipboard) {
      // Display error message if this is not a clipboard add.
      addServerView.close();
      this.showLocalizedError(new errors.ServerAlreadyAdded(
          this.serverRepo.createServer('', serverConfig, this.eventQueue)));
    }
  }

  private forgetServer(event: CustomEvent) {
    const serverId = event.detail.serverId;
    const server = this.serverRepo.getById(serverId);
    if (!server) {
      console.error(`No server with id ${serverId}`);
      return this.showLocalizedError();
    }
    const onceNotRunning = server.checkRunning().then((isRunning) => {
      return isRunning ? this.disconnectServer(event) : Promise.resolve();
    });
    onceNotRunning.then(() => {
      this.serverRepo.forget(serverId);
    });
  }

  private renameServer(event: CustomEvent) {
    const serverId = event.detail.serverId;
    const newName = event.detail.newName;
    this.serverRepo.rename(serverId, newName);
  }

  private connectServer(event: CustomEvent) {
    const [server, card] = this.getServerAndCardByServerId(event.detail.serverId);
    card.state = 'CONNECTING';
    return server.connect().then(
        () => {
          card.state = 'CONNECTED';
          this.rootEl.showToast(this.localize('server-connected', 'serverName', server.name));
        },
        (err: errors.OutlinePluginError) => {
          console.error(`Failed to connect to server with plugin error: ${err.name}`);
          card.state = 'DISCONNECTED';
          this.showLocalizedError(err);
        });
  }

  private disconnectServer(event: CustomEvent) {
    const [server, card] = this.getServerAndCardByServerId(event.detail.serverId);
    card.state = 'DISCONNECTING';
    return server.disconnect().then(
        () => {
          card.state = 'DISCONNECTED';
          this.rootEl.showToast(this.localize('server-disconnected', 'serverName', server.name));
        },
        (err: errors.OutlinePluginError) => {
          card.state = 'CONNECTED';
          this.showLocalizedError(err);
        });
  }

  private submitFeedback(event: CustomEvent) {
    const formData = this.feedbackViewEl.getValidatedFormData();
    if (!formData) {
      return;
    }
    const {feedback, category, email} = formData;
    this.rootEl.$.feedbackView.submitting = true;
    this.errorReporter.report(feedback, category, email)
        .then(
            () => {
              this.rootEl.$.feedbackView.submitting = false;
              this.rootEl.$.feedbackView.resetForm();
              this.changeToDefaultPage();
              this.rootEl.showToast(this.rootEl.localize('feedback-thanks'));
            },
            (err: {}) => {
              this.rootEl.$.feedbackView.submitting = false;
              this.showLocalizedError(new errors.FeedbackSubmissionError());
            });
  }

  // EventQueue event handlers:

  private showServerAdded(event: events.ServerAdded) {
    const server = event.server;
    console.debug('Server added');
    this.syncServersToUI();
    this.syncServerConnectivityState(server);
    this.changeToDefaultPage();
    this.rootEl.showToast(this.localize('server-added', 'serverName', server.name));
  }

  private showServerForgotten(event: events.ServerForgotten) {
    const server = event.server;
    console.debug('Server forgotten');
    this.syncServersToUI();
    this.rootEl.showToast(
        this.localize('server-forgotten', 'serverName', server.name), 10000, () => {
          this.serverRepo.undoForget(server.id);
        });
  }

  private showServerForgetUndone(event: events.ServerForgetUndone) {
    this.syncServersToUI();
    const server = event.server;
    this.rootEl.showToast(this.localize('server-forgotten-undo', 'serverName', server.name));
  }

  private showServerRenamed(event: events.ServerForgotten) {
    const server = event.server;
    console.debug('Server renamed');
    this.serverListEl.getServerCard(server.id).serverName = server.name;
    this.rootEl.showToast(this.localize('server-rename-complete'));
  }

  // Helpers:

  private syncServersToUI() {
    this.rootEl.servers = this.serverRepo.getAll();
  }

  private syncConnectivityStateToServerCards() {
    for (const server of this.serverRepo.getAll()) {
      this.syncServerConnectivityState(server);
    }
  }

  private syncServerConnectivityState(server: Server) {
    server.checkRunning()
        .then((isRunning) => {
          const card = this.serverListEl.getServerCard(server.id);
          if (!isRunning) {
            card.state = 'DISCONNECTED';
            return;
          }
          server.checkReachable().then((isReachable) => {
            if (isReachable) {
              card.state = 'CONNECTED';
            } else {
              console.log(`Server ${server.id} reconnecting`);
              card.state = 'RECONNECTING';
            }
          });
        })
        .catch((e) => {
          console.error('Failed to sync server connectivity state', e);
        });
  }

  private registerUrlInterceptionListener(urlInterceptor?: UrlInterceptor) {
    if (!urlInterceptor) {
      return console.warn('no urlInterceptor, ss:// urls will not be intercepted');
    }
    urlInterceptor.registerListener((url) => {
      const ssProto = SHADOWSOCKS_URI.PROTOCOL;
      if (!url || url.substring(0, ssProto.length) !== ssProto) {
        // This check is necessary to handle empty and malformed install-referrer URLs in Android.
        // TODO: Stop receiving install referrer intents so we can remove this.
        return console.debug(`Ignoring intercepted non-shadowsocks url`);
      }
      try {
        this.confirmAddServer(url);
      } catch (err) {
        this.showLocalizedErrorInDefaultPage(err);
      }
    });
  }

  private changeToDefaultPage() {
    this.rootEl.changePage(this.rootEl.DEFAULT_PAGE);
  }

  private getServerAndCardByServerId(serverId: string) {
    const server = this.serverRepo.getById(serverId);
    const card = this.serverListEl.getServerCard(serverId);
    return [server, card];
  }

  private showLocalizedErrorInDefaultPage(err: Error) {
    this.changeToDefaultPage();
    this.showLocalizedError(err);
  }
}
