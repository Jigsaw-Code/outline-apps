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

import * as errors from '../model/errors';
import * as events from '../model/events';
import {Server} from '../model/server';
import {OperationTimedOut} from '../../infrastructure/timeout_promise';
import {ServerListItem, ServerConnectionState} from '../views/servers_view';
import {SERVER_CONNECTION_INDICATOR_DURATION_MS} from '../views/servers_view/server_connection_indicator';

import {Clipboard} from './clipboard';
import {EnvironmentVariables} from './environment';
import {OutlineErrorReporter} from '../shared/error_reporter';
import {OutlineServerRepository} from './outline_server_repository';
import {Settings, SettingsKey} from './settings';
import {Updater} from './updater';
import {UrlInterceptor} from './url_interceptor';
import {VpnInstaller} from './vpn_installer';
import {Localizer} from 'src/infrastructure/i18n';

enum OUTLINE_ACCESS_KEY_SCHEME {
  STATIC = 'ss',
  DYNAMIC = 'ssconf',
}

// If "possiblyInviteUul" is a URL whose fragment contains a Shadowsocks URL
// then return that Shadowsocks URL, otherwise return the original string.
export function unwrapInvite(possiblyInviteUrl: string): string {
  try {
    const url = new URL(possiblyInviteUrl);
    if (url.hash) {
      const decodedFragment = decodeURIComponent(url.hash);

      // Search in the fragment for ss:// for two reasons:
      //  - URL.hash includes the leading # (what).
      //  - When a user opens invite.html#ENCODEDSSURL in their browser, the website (currently)
      //    redirects to invite.html#/en/invite/ENCODEDSSURL. Since copying that redirected URL
      //    seems like a reasonable thing to do, let's support those URLs too.
      //  - Dynamic keys are not supported by the invite flow, so we don't need to check for them
      const possibleShadowsocksUrl = decodedFragment.substring(
        decodedFragment.indexOf(`${OUTLINE_ACCESS_KEY_SCHEME.STATIC}://`)
      );

      if (new URL(possibleShadowsocksUrl).protocol === `${OUTLINE_ACCESS_KEY_SCHEME.STATIC}:`) {
        return possibleShadowsocksUrl;
      }
    }
  } catch (e) {
    // It wasn't an invite URL!
  }

  return possiblyInviteUrl;
}

// Returns true if the given url was a valid Outline invitation or
// access key
export function isOutlineAccessKey(url: string): boolean {
  if (!url) return false;

  // URL does not parse the hostname if the protocol is non-standard (e.g. non-http)
  // so we're using `startsWith`
  return (
    url.startsWith(`${OUTLINE_ACCESS_KEY_SCHEME.STATIC}://`) ||
    url.startsWith(`${OUTLINE_ACCESS_KEY_SCHEME.DYNAMIC}://`)
  );
}

const DEFAULT_SERVER_CONNECTION_STATUS_CHANGE_TIMEOUT = 600;

export class App {
  private feedbackViewEl: polymer.Base;
  private localize: Localizer;
  private ignoredAccessKeys: {[accessKey: string]: boolean} = {};
  private serverConnectionChangeTimeouts: {[serverId: string]: boolean} = {};

  constructor(
    private eventQueue: events.EventQueue,
    private serverRepo: OutlineServerRepository,
    private rootEl: polymer.Base,
    private debugMode: boolean,
    urlInterceptor: UrlInterceptor | undefined,
    private clipboard: Clipboard,
    private errorReporter: OutlineErrorReporter,
    private settings: Settings,
    environmentVars: EnvironmentVariables,
    private updater: Updater,
    private installer: VpnInstaller,
    private quitApplication: () => void,
    document = window.document
  ) {
    this.feedbackViewEl = rootEl.shadowRoot.querySelector('#feedbackView');
    this.localize = this.rootEl.localize.bind(this.rootEl);

    this.syncServersToUI();
    this.syncConnectivityStateToServerCards();
    rootEl.appVersion = environmentVars.APP_VERSION;
    rootEl.appBuild = environmentVars.APP_BUILD_NUMBER;
    rootEl.errorReporter = this.errorReporter;

    if (urlInterceptor) {
      this.registerUrlInterceptionListener(urlInterceptor);
    } else {
      console.warn('no urlInterceptor, ss:// urls will not be intercepted');
    }

    this.clipboard.setListener(this.handleClipboardText.bind(this));

    this.updater.setListener(this.updateDownloaded.bind(this));

    // Register Cordova mobile foreground event to sync server connectivity.
    document.addEventListener('resume', this.syncConnectivityStateToServerCards.bind(this));

    // Register handlers for events fired by Polymer components.
    this.rootEl.addEventListener('PromptAddServerRequested', this.requestPromptAddServer.bind(this));
    this.rootEl.addEventListener('AddServerConfirmationRequested', this.requestAddServerConfirmation.bind(this));
    this.rootEl.addEventListener('AddServerRequested', this.requestAddServer.bind(this));
    this.rootEl.addEventListener('IgnoreServerRequested', this.requestIgnoreServer.bind(this));
    this.rootEl.addEventListener('ConnectPressed', this.connectServer.bind(this));
    this.rootEl.addEventListener('DisconnectPressed', this.disconnectServer.bind(this));
    this.rootEl.addEventListener('ForgetPressed', this.forgetServer.bind(this));
    this.rootEl.addEventListener('RenameRequested', this.renameServer.bind(this));
    this.rootEl.addEventListener('QuitPressed', this.quitApplication.bind(this));
    this.rootEl.addEventListener('AutoConnectDialogDismissed', this.autoConnectDialogDismissed.bind(this));
    this.rootEl.addEventListener('ShowServerRename', this.rootEl.showServerRename.bind(this.rootEl));
    if (this.feedbackViewEl) {
      this.feedbackViewEl.$.submitButton.addEventListener('tap', this.submitFeedback.bind(this));
    }
    this.rootEl.addEventListener('PrivacyTermsAcked', this.ackPrivacyTerms.bind(this));
    this.rootEl.addEventListener('SetLanguageRequested', this.setAppLanguage.bind(this));

    // Register handlers for events published to our event queue.
    this.eventQueue.subscribe(events.ServerAdded, this.onServerAdded.bind(this));
    this.eventQueue.subscribe(events.ServerForgotten, this.onServerForgotten.bind(this));
    this.eventQueue.subscribe(events.ServerRenamed, this.onServerRenamed.bind(this));
    this.eventQueue.subscribe(events.ServerForgetUndone, this.onServerForgetUndone.bind(this));
    this.eventQueue.subscribe(events.ServerConnected, this.onServerConnected.bind(this));
    this.eventQueue.subscribe(events.ServerDisconnected, this.onServerDisconnected.bind(this));
    this.eventQueue.subscribe(events.ServerReconnecting, this.onServerReconnecting.bind(this));

    this.eventQueue.startPublishing();

    if (!this.arePrivacyTermsAcked()) {
      this.displayPrivacyView();
    }
    this.displayZeroStateUi();
    this.pullClipboardText();
  }

  showLocalizedError(error?: Error, toastDuration = 10000) {
    let toastMessage: string;
    let buttonMessage: string;
    let buttonHandler: () => void;
    let buttonLink: string;

    if (error instanceof errors.VpnPermissionNotGranted) {
      toastMessage = this.localize('outline-plugin-error-vpn-permission-not-granted');
    } else if (error instanceof errors.InvalidServerCredentials) {
      toastMessage = this.localize('outline-plugin-error-invalid-server-credentials');
    } else if (error instanceof errors.RemoteUdpForwardingDisabled) {
      toastMessage = this.localize('outline-plugin-error-udp-forwarding-not-enabled');
    } else if (error instanceof errors.ServerUnreachable) {
      toastMessage = this.localize('outline-plugin-error-server-unreachable');
    } else if (error instanceof errors.FeedbackSubmissionError) {
      toastMessage = this.localize('error-feedback-submission');
    } else if (error instanceof errors.ServerUrlInvalid) {
      toastMessage = this.localize('error-invalid-access-key');
    } else if (error instanceof errors.ServerIncompatible) {
      toastMessage = this.localize('error-server-incompatible');
    } else if (error instanceof OperationTimedOut) {
      toastMessage = this.localize('error-timeout');
    } else if (error instanceof errors.ShadowsocksStartFailure && this.isWindows()) {
      // Fall through to `error-unexpected` for other platforms.
      toastMessage = this.localize('outline-plugin-error-antivirus');
      buttonMessage = this.localize('fix-this');
      buttonLink = 'https://s3.amazonaws.com/outline-vpn/index.html#/en/support/antivirusBlock';
    } else if (error instanceof errors.ConfigureSystemProxyFailure) {
      toastMessage = this.localize('outline-plugin-error-routing-tables');
      buttonMessage = this.localize('feedback-page-title');
      buttonHandler = () => {
        // TODO: Drop-down has no selected item, why not?
        this.rootEl.changePage('feedback');
      };
    } else if (error instanceof errors.NoAdminPermissions) {
      toastMessage = this.localize('outline-plugin-error-admin-permissions');
    } else if (error instanceof errors.UnsupportedRoutingTable) {
      toastMessage = this.localize('outline-plugin-error-unsupported-routing-table');
    } else if (error instanceof errors.ServerAlreadyAdded) {
      toastMessage = this.localize('error-server-already-added', 'serverName', this.getServerDisplayName(error.server));
    } else if (error instanceof errors.SystemConfigurationException) {
      toastMessage = this.localize('outline-plugin-error-system-configuration');
    } else if (error instanceof errors.ShadowsocksUnsupportedCipher) {
      toastMessage = this.localize('error-shadowsocks-unsupported-cipher', 'cipher', error.cipher);
    } else if (error instanceof errors.ServerAccessKeyInvalid) {
      toastMessage = this.localize('error-connection-configuration');
      buttonMessage = this.localize('error-details');
      buttonHandler = () => {
        this.showErrorDetailDialog(error);
      };
    } else if (error instanceof errors.SessionConfigFetchFailed) {
      toastMessage = this.localize('error-connection-configuration-fetch');
      buttonMessage = this.localize('error-details');
      buttonHandler = () => {
        this.showErrorDetailDialog(error);
      };
    } else if (error instanceof errors.ProxyConnectionFailure) {
      toastMessage = this.localize('error-connection-proxy');
      buttonMessage = this.localize('error-details');
      buttonHandler = () => {
        this.showErrorDetailDialog(error);
      };
    } else {
      const hasErrorDetails = Boolean(error.message || error.cause);
      toastMessage = this.localize('error-unexpected');

      if (hasErrorDetails) {
        buttonMessage = this.localize('error-details');
        buttonHandler = () => {
          this.showErrorDetailDialog(error);
        };
      }
    }

    // Defer by 500ms so that this toast is shown after any toasts that get shown when any
    // currently-in-flight domain events land (e.g. fake servers added).
    if (this.rootEl && this.rootEl.async) {
      this.rootEl?.async(() => {
        this.rootEl.showToast(toastMessage ?? error.message, toastDuration, buttonMessage, buttonHandler, buttonLink);
      }, 500);
    }
  }

  private async pullClipboardText() {
    try {
      const text = await this.clipboard.getContents();
      this.handleClipboardText(text);
    } catch (e) {
      console.warn('cannot read clipboard, system may lack clipboard support');
    }
  }

  private displayZeroStateUi() {
    if (this.rootEl.$.serversView.shouldShowZeroState) {
      this.rootEl.$.addServerView.openAddServerSheet();
    }
  }

  private arePrivacyTermsAcked() {
    try {
      return this.settings.get(SettingsKey.PRIVACY_ACK) === 'true';
    } catch (e) {
      console.error(`could not read privacy acknowledgement setting, assuming not acknowledged`);
    }
    return false;
  }

  private displayPrivacyView() {
    this.rootEl.$.serversView.hidden = true;
    this.rootEl.$.privacyView.hidden = false;
  }

  private ackPrivacyTerms() {
    this.rootEl.$.serversView.hidden = false;
    this.rootEl.$.privacyView.hidden = true;
    this.settings.set(SettingsKey.PRIVACY_ACK, 'true');
  }

  private setAppLanguage(event: CustomEvent) {
    const languageCode = event.detail.languageCode;
    window.localStorage.setItem('overrideLanguage', languageCode);
    this.rootEl.setLanguage(languageCode);
    this.changeToDefaultPage();
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
      this.serverRepo.add(event.detail.accessKey);
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
    const addServerView = this.rootEl.$.addServerView;
    accessKey = unwrapInvite(accessKey);
    if (fromClipboard && !addServerView.isAddingServer()) {
      if (accessKey in this.ignoredAccessKeys) {
        return console.debug('Ignoring access key');
      } else if (accessKey.startsWith('https://')) {
        return console.debug('Non-Invite https:// keys should be pasted in explicitly.');
      }
    }
    try {
      this.serverRepo.validateAccessKey(accessKey);
      addServerView.openAddServerConfirmationSheet(accessKey);
    } catch (e) {
      if (!fromClipboard && e instanceof errors.ServerAlreadyAdded) {
        // Display error message and don't propagate error if this is not a clipboard add.
        addServerView.close();
        this.showLocalizedError(e);
        return;
      }
      // Propagate access key validation error.
      throw e;
    }
  }

  private async forgetServer(event: CustomEvent) {
    event.stopImmediatePropagation();

    const {serverId} = event.detail;
    const server = this.serverRepo.getById(serverId);
    if (!server) {
      console.error(`No server with id ${serverId}`);
      return this.showLocalizedError();
    }
    try {
      if (await server.checkRunning()) {
        await this.disconnectServer(event);
      }
    } catch (e) {
      console.warn(`failed to disconnect from server to forget: ${e}`);
    }
    this.serverRepo.forget(serverId);
  }

  private renameServer(event: CustomEvent) {
    const {serverId, newName} = event.detail;
    this.serverRepo.rename(serverId, newName);
  }

  private async connectServer(event: CustomEvent) {
    event.stopImmediatePropagation();

    const {serverId} = event.detail;
    if (!serverId) {
      throw new Error(`connectServer event had no server ID`);
    }

    if (this.throttleServerConnectionChange(serverId, DEFAULT_SERVER_CONNECTION_STATUS_CHANGE_TIMEOUT)) return;

    const server = this.getServerByServerId(serverId);
    console.log(`connecting to server ${serverId}`);

    this.updateServerListItem(serverId, {connectionState: ServerConnectionState.CONNECTING});
    try {
      await server.connect();
      this.updateServerListItem(serverId, {
        connectionState: ServerConnectionState.CONNECTED,
        address: server.address,
      });
      console.log(`connected to server ${serverId}`);
      this.rootEl.showToast(this.localize('server-connected', 'serverName', this.getServerDisplayName(server)));
      this.maybeShowAutoConnectDialog();
    } catch (e) {
      this.updateServerListItem(serverId, {connectionState: ServerConnectionState.DISCONNECTED});
      console.error(`could not connect to server ${serverId}: ${e.name}`);
      if (e instanceof errors.SystemConfigurationException) {
        if (await this.showConfirmationDialog(this.localize('outline-services-installation-confirmation'))) {
          await this.installVpnService();
          return;
        }
      }
      this.showLocalizedError(e);
    }
  }

  private async installVpnService(): Promise<void> {
    this.rootEl.showToast(this.localize('outline-services-installing'), Infinity);
    try {
      await this.installer.installVpn();
      this.rootEl.showToast(this.localize('outline-services-installed'));
    } catch (e) {
      const err = e.errorCode ? errors.fromErrorCode(e.errorCode) : e;
      console.error('failed to set up Outline VPN', err);
      if (err instanceof errors.UnexpectedPluginError) {
        this.rootEl.showToast(this.localize('outline-services-installation-failed'));
      } else {
        this.showLocalizedError(err);
      }
    }
  }

  private maybeShowAutoConnectDialog() {
    let dismissed = false;
    try {
      dismissed = this.settings.get(SettingsKey.AUTO_CONNECT_DIALOG_DISMISSED) === 'true';
    } catch (e) {
      console.error(`Failed to read auto-connect dialog status, assuming not dismissed: ${e}`);
    }
    if (!dismissed) {
      this.rootEl.$.serversView.$.autoConnectDialog.show();
    }
  }

  private autoConnectDialogDismissed() {
    this.settings.set(SettingsKey.AUTO_CONNECT_DIALOG_DISMISSED, 'true');
  }

  private async disconnectServer(event: CustomEvent) {
    event.stopImmediatePropagation();

    const {serverId} = event.detail;
    if (!serverId) {
      throw new Error(`disconnectServer event had no server ID`);
    }

    if (this.throttleServerConnectionChange(serverId, DEFAULT_SERVER_CONNECTION_STATUS_CHANGE_TIMEOUT)) return;

    const server = this.getServerByServerId(serverId);
    console.log(`disconnecting from server ${serverId}`);

    this.updateServerListItem(serverId, {connectionState: ServerConnectionState.DISCONNECTING});
    try {
      await server.disconnect();
      this.updateServerListItem(serverId, {
        connectionState: ServerConnectionState.DISCONNECTED,
      });

      // Wait until the server connection indicator is done animating to update the
      // address, which potentially will remove it.

      // TODO(daniellacosse): Server connection indicator should broadcast an
      // animationend event, which the app can respond to.
      this.rootEl.async(
        () =>
          this.updateServerListItem(serverId, {
            address: server.address,
          }),
        SERVER_CONNECTION_INDICATOR_DURATION_MS
      );

      console.log(`disconnected from server ${serverId}`);
      this.rootEl.showToast(this.localize('server-disconnected', 'serverName', this.getServerDisplayName(server)));
    } catch (e) {
      this.updateServerListItem(serverId, {connectionState: ServerConnectionState.CONNECTED});
      this.showLocalizedError(e);
      console.warn(`could not disconnect from server ${serverId}: ${e.name}`);
    }
  }

  private async submitFeedback() {
    const formData = this.feedbackViewEl.getValidatedFormData();
    if (!formData) {
      return;
    }
    const {feedback, category, email} = formData;
    this.feedbackViewEl.submitting = true;
    try {
      await this.errorReporter.report(feedback, category, email);
      this.feedbackViewEl.submitting = false;
      this.feedbackViewEl.resetForm();
      this.changeToDefaultPage();
      this.rootEl.showToast(this.rootEl.localize('feedback-thanks'));
    } catch (e) {
      this.feedbackViewEl.submitting = false;
      this.showLocalizedError(new errors.FeedbackSubmissionError());
    }
  }

  //#region EventQueue event handlers

  private onServerConnected(event: events.ServerConnected): void {
    console.debug(`server ${event.server.id} connected`);
    this.updateServerListItem(event.server.id, {connectionState: ServerConnectionState.CONNECTED});
  }

  private onServerDisconnected(event: events.ServerDisconnected): void {
    console.debug(`server ${event.server.id} disconnected`);
    try {
      this.updateServerListItem(event.server.id, {connectionState: ServerConnectionState.DISCONNECTED});
    } catch (e) {
      console.warn('server card not found after disconnection event, assuming forgotten');
    }
  }

  private onServerReconnecting(event: events.ServerReconnecting): void {
    console.debug(`server ${event.server.id} reconnecting`);
    this.updateServerListItem(event.server.id, {connectionState: ServerConnectionState.RECONNECTING});
  }

  private onServerAdded(event: events.ServerAdded) {
    const server = event.server;
    console.debug('Server added');
    this.syncServersToUI();
    this.changeToDefaultPage();
    this.rootEl.showToast(this.localize('server-added', 'serverName', this.getServerDisplayName(server)));
  }

  private onServerForgotten(event: events.ServerForgotten) {
    const server = event.server;
    console.debug('Server forgotten');
    this.syncServersToUI();
    this.rootEl.showToast(
      this.localize('server-forgotten', 'serverName', this.getServerDisplayName(server)),
      10000,
      this.localize('undo-button-label'),
      () => {
        this.serverRepo.undoForget(server.id);
      }
    );
  }

  private onServerForgetUndone(event: events.ServerForgetUndone) {
    this.syncServersToUI();
    const server = event.server;
    this.rootEl.showToast(this.localize('server-forgotten-undo', 'serverName', this.getServerDisplayName(server)));
  }

  private onServerRenamed(event: events.ServerForgotten) {
    const server = event.server;
    console.debug('Server renamed');
    this.updateServerListItem(server.id, {name: server.name});
    this.rootEl.showToast(this.localize('server-rename-complete'));
  }

  //#endregion EventQueue event handlers

  //#region UI dialogs

  private showConfirmationDialog(message: string): Promise<boolean> {
    // Temporarily use window.confirm here
    return new Promise<boolean>(resolve => resolve(confirm(message)));
  }

  private showErrorDetailDialog(error: Error) {
    let message = error.toString();

    if (error.cause) {
      message += '\nCause: ';
      message += error.cause.toString();
    }

    // Temporarily use window.alert here
    return alert(message);
  }

  //#endregion UI dialogs

  // Helpers:

  private makeServerListItem(server: Server): ServerListItem {
    return {
      disabled: false,
      errorMessageId: server.errorMessageId,
      isOutlineServer: server.isOutlineServer,
      name: this.getServerDisplayName(server),
      address: server.address,
      id: server.id,
      connectionState: ServerConnectionState.DISCONNECTED,
    };
  }

  private throttleServerConnectionChange(serverId: string, time: number) {
    if (this.serverConnectionChangeTimeouts[serverId]) return true;

    this.serverConnectionChangeTimeouts[serverId] = true;

    setTimeout(() => delete this.serverConnectionChangeTimeouts[serverId], time);

    return false;
  }

  private syncServersToUI() {
    this.rootEl.servers = this.serverRepo.getAll().map(this.makeServerListItem.bind(this));
  }

  private syncConnectivityStateToServerCards() {
    for (const server of this.serverRepo.getAll()) {
      this.syncServerConnectivityState(server);
    }
  }

  private async syncServerConnectivityState(server: Server) {
    try {
      const isRunning = await server.checkRunning();
      const connectionState = isRunning ? ServerConnectionState.CONNECTED : ServerConnectionState.DISCONNECTED;
      this.updateServerListItem(server.id, {connectionState});
    } catch (e) {
      console.error('Failed to sync server connectivity state', e);
    }
  }

  private registerUrlInterceptionListener(urlInterceptor: UrlInterceptor) {
    urlInterceptor.registerListener(url => {
      if (!isOutlineAccessKey(unwrapInvite(url))) {
        // This check is necessary to ignore empty and malformed install-referrer URLs in Android
        // while allowing ss://, ssconf:// and invite URLs.
        // TODO: Stop receiving install referrer intents so we can remove this.
        return console.debug(`Ignoring intercepted non-Outline url`);
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

  // Returns the server's name, if present, or a default server name.
  private getServerDisplayName(server: Server): string {
    if (server.name) {
      return server.name;
    }

    if (server.sessionConfigLocation) {
      return server.sessionConfigLocation.port === '443'
        ? server.sessionConfigLocation.hostname
        : `${server.sessionConfigLocation.hostname}:${server.sessionConfigLocation.port}`;
    }

    return this.localize(server.isOutlineServer ? 'server-default-name-outline' : 'server-default-name');
  }

  // Returns the server having serverId, throws if the server cannot be found.
  private getServerByServerId(serverId: string): Server {
    const server = this.serverRepo.getById(serverId);
    if (!server) {
      throw new Error(`could not find server with ID ${serverId}`);
    }
    return server;
  }

  private updateServerListItem(id: string, properties: object) {
    // We have to create a new list so the property change is observed.
    this.rootEl.servers = this.rootEl.servers.map((cardModel: ServerListItem) => {
      if (cardModel.id === id) {
        // Create a new object so the change is reflected in the server_card view.
        return {...cardModel, ...properties} as ServerListItem;
      } else {
        return cardModel;
      }
    });
  }

  private showLocalizedErrorInDefaultPage(err: Error) {
    this.changeToDefaultPage();
    this.showLocalizedError(err);
  }

  private isWindows() {
    return !('cordova' in window);
  }
}
