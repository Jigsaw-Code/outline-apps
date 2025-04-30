// CONCEPTUAL
// Copyright 2025 The Outline Authors
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

import {Localizer} from '@outline/infrastructure/i18n'; // [cite: 254]
import {OperationTimedOut} from '@outline/infrastructure/timeout_promise'; // [cite: 254]

import {Clipboard} from './clipboard'; // [cite: 254]
import {EnvironmentVariables} from './environment'; // [cite: 254]
import * as config from './outline_server_repository/config'; // [cite: 254]
import {Settings, SettingsKey, Appearance} from './settings'; // [cite: 254]
import {Updater} from './updater'; // [cite: 254]
import {UrlInterceptor} from './url_interceptor'; // [cite: 254]
import {VpnInstaller} from './vpn_installer'; // [cite: 254]
import * as errors from '../model/errors'; // [cite: 254]
import * as events from '../model/events'; // [cite: 254]
import {Server, ServerRepository} from '../model/server'; // [cite: 254]
import {OutlineErrorReporter as ErrorReporter} from '../shared/error_reporter'; // Changed to OutlineErrorReporter
import {AppRoot} from '../views/root_view';
import {ServerConnectionState, ServerListItem} from '../views/servers_view'; // [cite: 254]
import {SERVER_CONNECTION_INDICATOR_DURATION_MS} from '../views/servers_view/server_connection_indicator'; // [cite: 254]

enum OutlineAccessKeyScheme { // Renamed for clarity
  STATIC = 'ss',
  DYNAMIC = 'ssconf',
}

const DEFAULT_SERVER_CONNECTION_THROTTLE_MS = 600; // Renamed for clarity

// Top-level utility functions, could be moved to a utils file if preferred.
// No changes needed for these two functions based on the request, just ensuring they are well-placed.
export function unwrapInvite(possiblyInviteUrl: string): string {
  try {
    const url = new URL(possiblyInviteUrl);
    if (url.hash) {
      const decodedFragment = decodeURIComponent(url.hash);
      const staticKeyScheme = `${OutlineAccessKeyScheme.STATIC}://`;
      const ssUrlIndex = decodedFragment.indexOf(staticKeyScheme);

      if (ssUrlIndex !== -1) {
        const possibleShadowsocksUrl = decodedFragment.substring(ssUrlIndex);
        if (
          new URL(possibleShadowsocksUrl).protocol ===
          `${OutlineAccessKeyScheme.STATIC}:`
        ) {
          return possibleShadowsocksUrl;
        }
      }
    }
  } catch {
    // Not a valid URL or not an invite structure we recognize.
  }
  return possiblyInviteUrl;
}

export function isOutlineAccessKey(url: string): boolean {
  if (!url) return false;
  return (
    url.startsWith(`${OutlineAccessKeyScheme.STATIC}://`) ||
    url.startsWith(`${OutlineAccessKeyScheme.DYNAMIC}://`)
  );
}

export class App {
  private readonly localize: Localizer;
  private readonly ignoredAccessKeys: Set<string> = new Set(); // Use Set for better semantics
  private readonly serverConnectionChangeTimeouts: Map<string, NodeJS.Timeout> =
    new Map(); // Store timeout IDs

  constructor(
    private readonly eventQueue: events.EventQueue,
    private readonly serverRepo: ServerRepository,
    private readonly rootEl: AppRoot,
    private readonly debugMode: boolean, // Keep for potential debug features
    private readonly urlInterceptor: UrlInterceptor | undefined,
    private readonly clipboard: Clipboard,
    private readonly errorReporter: ErrorReporter,
    private readonly settings: Settings,
    private readonly environmentVars: EnvironmentVariables,
    private readonly updater: Updater,
    private readonly installer: VpnInstaller,
    private readonly quitApplication: () => void,
    private readonly document = window.document // Keep for 'resume' event, etc.
  ) {
    // Initialize localizer immediately
    this.localize = this.rootEl.localize.bind(this.rootEl); // Ensure `this` context for localize

    this._initializeApplicationState();
    this._registerUiEventListeners();
    this._registerQueueEventSubscribers();
    this._setupInitialUi();
  }

  // Initialization and Setup
  private _initializeApplicationState(): void {
    this.rootEl.appVersion = this.environmentVars.APP_VERSION;
    this.rootEl.appBuild = String(this.environmentVars.APP_BUILD_NUMBER); // Ensure string
    this.rootEl.errorReporter = this.errorReporter;

    if (this.urlInterceptor) {
      this._registerUrlInterceptionListener(this.urlInterceptor);
    } else {
      console.warn(
        'No UrlInterceptor provided, ss:// URLs will not be intercepted.'
      );
    }

    this.clipboard.setListener(this._handleClipboardText.bind(this));
    this.updater.setListener(this._onUpdateDownloaded.bind(this));

    this.document.addEventListener(
      'resume',
      this._syncConnectivityStateToAllServers.bind(this)
    );
    this.eventQueue.startPublishing();
  }

  private _registerUiEventListeners(): void {
    // Assuming AppRoot directly emits these events or delegates from its children.
    // The event names should be constants or an enum if many.
    const uiEvents: Array<[string, (event: CustomEvent<any>) => void]> = [
      [
        'add-server-requested-by-empty-state',
        this._requestPromptAddServerFromUi,
      ], // From servers-view zero state
      ['show-add-server-dialog', this._onShowAddServerDialogRequest], // Generic request to show dialog
      ['show-navigation-request', this._onShowNavigationRequest],
      ['hide-navigation-request', this._onHideNavigationRequest],
      ['change-page-request', this._onChangePageRequest],
      ['add-server-confirmation-requested', this._requestAddServerConfirmation], // From add-server-dialog (or similar)
      ['add-server-requested', this._requestAddServer], // From add-server-dialog
      ['ignore-server-requested', this._requestIgnoreServer], // From add-server-dialog
      ['connect-pressed', this._connectServer], // From server-card
      ['disconnect-pressed', this._disconnectServer], // From server-card
      ['forget-pressed', this._forgetServer], // From server-card
      ['rename-requested', this._renameServer], // From server-card
      ['quit-pressed', this.quitApplication], // From app-root's navigation
      ['auto-connect-dialog-dismissed', this._autoConnectDialogDismissed],
      ['privacy-terms-acked', this._ackPrivacyTerms],
      ['set-language-requested', this._setAppLanguage], // From language-view or app-root
      ['set-appearance-requested', this._onSetAppearanceRequested],
    ];

    uiEvents.forEach(([eventName, handler]) => {
      (this.rootEl as unknown as HTMLElement).addEventListener(
        eventName,
        handler.bind(this) as EventListener
      );
    });
  }

  private _registerQueueEventSubscribers(): void {
    this.eventQueue.subscribe(
      events.ServerAdded,
      this._onServerAdded.bind(this)
    );
    this.eventQueue.subscribe(
      events.ServerForgotten,
      this._onServerForgotten.bind(this)
    );
    this.eventQueue.subscribe(
      events.ServerRenamed,
      this._onServerRenamed.bind(this)
    );
    this.eventQueue.subscribe(
      events.ServerForgetUndone,
      this._onServerForgetUndone.bind(this)
    );
    this.eventQueue.subscribe(
      events.ServerConnected,
      this._onServerConnected.bind(this)
    );
    this.eventQueue.subscribe(
      events.ServerDisconnecting,
      this._onServerDisconnecting.bind(this)
    );
    this.eventQueue.subscribe(
      events.ServerDisconnected,
      this._onServerDisconnected.bind(this)
    );
    this.eventQueue.subscribe(
      events.ServerReconnecting,
      this._onServerReconnecting.bind(this)
    );
  }

  private _setupInitialUi(): void {
    this._syncServersToUi();
    this._syncConnectivityStateToAllServers(); // Initial sync on app start

    this.rootEl.setAddServerDialogAccessKeyValidator(
      async (accessKey: string): Promise<boolean> => {
        try {
          await config.parseAccessKey(accessKey);
          return true;
        } catch {
          return false;
        }
      }
    );

    this._setAppearance(
      this.settings.get(SettingsKey.APPEARANCE) as Appearance
    );

    if (!this._arePrivacyTermsAcked()) {
      this._displayPrivacyView();
    } else if (this.rootEl.isServersViewInZeroState()) {
      // Assumes AppRoot has this method
      this.rootEl.openAddServerDialog();
    }
  }

  // Error Display
  showLocalizedError(error?: Error, toastDuration = 10000): void {
    let toastMessageKey: string | undefined;
    let toastParams: {[key: string]: string} = {};
    let buttonMessageKey: string | undefined;
    let buttonHandler: (() => void) | undefined;
    let buttonLink: string | undefined;

    // TODO: Consider refactoring this large if/else into a map or strategy pattern
    // if it grows further or becomes too unwieldy. For now, direct mapping is clear.
    if (error instanceof errors.VpnPermissionNotGranted) {
      toastMessageKey = 'outline-plugin-error-vpn-permission-not-granted';
    } else if (error instanceof errors.InvalidServerCredentials) {
      toastMessageKey = 'outline-plugin-error-invalid-server-credentials';
    } else if (error instanceof errors.RemoteUdpForwardingDisabled) {
      toastMessageKey = 'outline-plugin-error-udp-forwarding-not-enabled';
    } else if (error instanceof errors.ServerUnreachable) {
      toastMessageKey = 'outline-plugin-error-server-unreachable';
    } else if (error instanceof errors.ServerUrlInvalid) {
      toastMessageKey = 'error-invalid-access-key';
    } else if (error instanceof errors.ServerIncompatible) {
      toastMessageKey = 'error-server-incompatible';
    } else if (error instanceof OperationTimedOut) {
      toastMessageKey = 'error-timeout';
    } else if (
      error instanceof errors.ClientStartFailure &&
      this._isWindows()
    ) {
      toastMessageKey = 'outline-plugin-error-antivirus';
      buttonMessageKey = 'fix-this';
      buttonLink =
        'https://s3.amazonaws.com/outline-vpn/index.html#/en/support/antivirusBlock';
    } else if (error instanceof errors.ConfigureSystemProxyFailure) {
      toastMessageKey = 'outline-plugin-error-routing-tables';
      buttonMessageKey = 'contact-page-title';
      buttonHandler = () => {
        this.rootEl.changePage('contact');
      };
    } else if (error instanceof errors.NoAdminPermissions) {
      toastMessageKey = 'outline-plugin-error-admin-permissions';
    } else if (error instanceof errors.UnsupportedRoutingTable) {
      toastMessageKey = 'outline-plugin-error-unsupported-routing-table';
    } else if (error instanceof errors.ServerAlreadyAdded) {
      toastMessageKey = 'error-server-already-added';
      toastParams = {serverName: error.server.name};
    } else if (error instanceof errors.SystemConfigurationException) {
      toastMessageKey = 'outline-plugin-error-system-configuration';
    } else if (error instanceof errors.ShadowsocksUnsupportedCipher) {
      toastMessageKey = 'error-shadowsocks-unsupported-cipher';
      toastParams = {cipher: error.cipher};
    } else if (
      error instanceof errors.InvalidServiceConfiguration ||
      error instanceof errors.SessionConfigFetchFailed ||
      error instanceof errors.ProxyConnectionFailure
    ) {
      toastMessageKey =
        error instanceof errors.InvalidServiceConfiguration
          ? 'error-connection-configuration'
          : error instanceof errors.SessionConfigFetchFailed
            ? 'error-connection-configuration-fetch'
            : 'error-connection-proxy';
      if (error.message || error.cause) {
        // Only show details button if there's something to show
        buttonMessageKey = 'error-details';
        buttonHandler = () => {
          this._showErrorCauseDialog(error);
        };
      }
    } else if (error instanceof errors.SessionProviderError) {
      // Custom errors from session provider
      toastMessageKey = error.message; // Assume message is already localized or is technical
      if (error.details) {
        buttonMessageKey = 'error-details';
        buttonHandler = () => {
          alert(error.details);
        }; // Keep alert for direct technical details as before
      }
    } else {
      // Default/Unexpected errors
      toastMessageKey = 'error-unexpected';
      if (error && (error.message || (error as any).cause)) {
        // Check if error or its cause has info
        buttonMessageKey = 'error-details';
        buttonHandler = () => {
          this._showErrorCauseDialog(error ?? new Error('Unknown error'));
        };
      }
    }

    const finalToastMessage = toastMessageKey
      ? this.localize(toastMessageKey, ...Object.values(toastParams))
      : error?.message || 'Unknown error';
    const finalButtonMessage = buttonMessageKey
      ? this.localize(buttonMessageKey)
      : undefined;

    // Defer to allow other UI updates to settle, e.g., from domain events.
    setTimeout(() => {
      this.rootEl.showToast(
        finalToastMessage,
        toastDuration,
        finalButtonMessage,
        buttonHandler,
        buttonLink
      );
    }, 500);
  }

  private _showLocalizedErrorInDefaultPage(err: Error): void {
    this._changeToDefaultPageUi();
    this.showLocalizedError(err);
  }

  // UI Event Handlers (from AppRoot)
  private _onShowNavigationRequest(): void {
    this.rootEl.openDrawer();
  }
  private _onHideNavigationRequest(): void {
    this.rootEl.closeDrawer();
  }
  private _onChangePageRequest(event: CustomEvent<{page: string}>): void {
    this.rootEl.changePage(event.detail.page);
  }
  private _onShowAddServerDialogRequest(): void {
    this.rootEl.openAddServerDialog();
  }

  // Server Interaction Handlers (from UI events)
  private _requestPromptAddServerFromUi(): void {
    this._pullClipboardText().catch(e =>
      console.warn('Failed to pull clipboard text on prompt', e)
    );
  }

  private _requestAddServerConfirmation(
    event: CustomEvent<{accessKey: string}>
  ): void {
    const accessKey = event.detail.accessKey;
    console.debug('Add server confirmation requested from UI');
    this._confirmAddServer(accessKey).catch(err => {
      console.error('Failed to confirm add server.', err);
      this.showLocalizedError(err as Error);
    });
  }

  private _requestAddServer(event: CustomEvent<{accessKey: string}>): void {
    this.serverRepo
      .add(event.detail.accessKey)
      .catch(err => {
        this._changeToDefaultPageUi();
        this.showLocalizedError(err as Error);
      })
      .finally(() => {
        this.rootEl.closeAddServerDialog();
      });
  }

  private _requestIgnoreServer(event: CustomEvent<{accessKey: string}>): void {
    this.ignoredAccessKeys.add(event.detail.accessKey);
    this.rootEl.closeAddServerDialog();
  }

  private async _connectServer(
    event: CustomEvent<{serverId: string}>
  ): Promise<void> {
    event.stopImmediatePropagation(); // As in original
    const serverId = event.detail.serverId;
    if (!serverId) throw new Error('Connect event missing serverId');

    if (
      this._throttleServerConnectionChange(
        serverId,
        DEFAULT_SERVER_CONNECTION_THROTTLE_MS
      )
    )
      return;

    const server = this._getServerByIdOrThrow(serverId);
    console.log(`Connecting to server ${server.id}`);
    this._updateServerListItemUi(serverId, {
      connectionState: ServerConnectionState.CONNECTING,
    });

    try {
      await server.connect();
      this._updateServerListItemUi(serverId, {
        connectionState: ServerConnectionState.CONNECTED,
        address: server.address, // Update address if it changed (e.g. dynamic IP)
      });
      console.log(`Connected to server ${server.id}`);
      this.rootEl.showToast(
        this.localize('server-connected', 'serverName', server.name)
      );
      this._maybeShowAutoConnectDialog();
    } catch (e: any) {
      this._updateServerListItemUi(serverId, {
        connectionState: ServerConnectionState.DISCONNECTED,
      });
      console.error(`Could not connect to server ${server.id}:`, e);
      if (
        e instanceof errors.ProxyConnectionFailure &&
        e.cause instanceof errors.SystemConfigurationException
      ) {
        const confirmationMessage = `${this.localize('outline-services-installation-confirmation')}\n\n--------------------\n${e.toString()}`;
        if (await this._showConfirmationDialog(confirmationMessage)) {
          await this._installVpnService();
          return; // Attempt to install, then user might retry connection
        }
      }
      this.showLocalizedError(e);
    }
  }

  private async _disconnectServer(
    event: CustomEvent<{serverId: string}>
  ): Promise<void> {
    event.stopImmediatePropagation();
    const serverId = event.detail.serverId;
    if (!serverId) throw new Error('Disconnect event missing serverId');

    if (
      this._throttleServerConnectionChange(
        serverId,
        DEFAULT_SERVER_CONNECTION_THROTTLE_MS
      )
    )
      return;

    const server = this._getServerByIdOrThrow(serverId);
    console.log(`Disconnecting from server ${server.id}`);
    this._updateServerListItemUi(serverId, {
      connectionState: ServerConnectionState.DISCONNECTING,
    });

    try {
      await server.disconnect();
      this._updateServerListItemUi(serverId, {
        connectionState: ServerConnectionState.DISCONNECTED,
      });
      // Defer address update to allow animation to finish, as in original.
      setTimeout(() => {
        this._updateServerListItemUi(serverId, {address: server.address});
      }, SERVER_CONNECTION_INDICATOR_DURATION_MS);
      console.log(`Disconnected from server ${server.id}`);
      this.rootEl.showToast(
        this.localize('server-disconnected', 'serverName', server.name)
      );
    } catch (e: any) {
      // If disconnect fails, assume it's still connected (or was never properly disconnected by platform)
      this._updateServerListItemUi(serverId, {
        connectionState: ServerConnectionState.CONNECTED,
      });
      this.showLocalizedError(e);
      console.warn(`Could not disconnect from server ${server.id}:`, e.name);
    }
  }

  private async _forgetServer(
    event: CustomEvent<{serverId: string}>
  ): Promise<void> {
    event.stopImmediatePropagation();
    const serverId = event.detail.serverId;
    const server = this.serverRepo.getById(serverId); // OK if undefined here, will be handled
    if (!server) {
      console.error(`ForgetServer: No server with id ${serverId}`);
      this.showLocalizedError(new Error('Server not found for forgetting.')); // Or a specific error type
      return;
    }

    try {
      // Attempt to disconnect if running, but proceed with forget even if disconnect fails.
      if (await server.checkRunning()) {
        // Pass a minimal event-like object for _disconnectServer
        await this._disconnectServer({detail: {serverId}} as CustomEvent<{
          serverId: string;
        }>);
      }
    } catch (e) {
      console.warn(
        `Failed to disconnect server ${serverId} before forgetting:`,
        e
      );
      // Continue with forget operation
    }
    this.serverRepo.forget(serverId); // This will trigger onServerForgotten event
  }

  private _renameServer(
    event: CustomEvent<{serverId: string; newName: string}>
  ): void {
    this.serverRepo.rename(event.detail.serverId, event.detail.newName); // Triggers onServerRenamed
  }

  // Model Event Handlers (from EventQueue)
  private _onServerAdded(event: events.ServerAdded): void {
    console.debug(`Server ${event.server.id} added via event queue.`);
    this._syncServersToUi();
    this._changeToDefaultPageUi();
    this.rootEl.showToast(
      this.localize('server-added', 'serverName', event.server.name)
    );
  }

  private _onServerForgotten(event: events.ServerForgotten): void {
    console.debug(`Server ${event.server.id} forgotten via event queue.`);
    this._syncServersToUi(); // Update UI list
    this.rootEl.showToast(
      this.localize('server-forgotten', 'serverName', event.server.name),
      10000, // duration
      this.localize('undo-button-label'), // button text
      () => {
        this.serverRepo.undoForget(event.server.id);
      } // button handler
    );
  }

  private _onServerForgetUndone(event: events.ServerForgetUndone): void {
    console.debug(`Server forget undone for ${event.server.id}`);
    this._syncServersToUi();
    this.rootEl.showToast(
      this.localize('server-forgotten-undo', 'serverName', event.server.name)
    );
  }

  private _onServerRenamed(event: events.ServerRenamed): void {
    console.debug(`Server ${event.server.id} renamed via event queue.`);
    this._updateServerListItemUi(event.server.id, {name: event.server.name});
    this.rootEl.showToast(this.localize('server-rename-complete'));
  }

  private _onServerConnected(event: events.ServerConnected): void {
    console.debug(`Server ${event.serverId} connected via event queue.`);
    this._updateServerListItemUi(event.serverId, {
      connectionState: ServerConnectionState.CONNECTED,
    });
  }

  private _onServerDisconnected(event: events.ServerDisconnected): void {
    console.debug(`Server ${event.serverId} disconnected via event queue.`);
    try {
      this._updateServerListItemUi(event.serverId, {
        connectionState: ServerConnectionState.DISCONNECTED,
      });
    } catch (e) {
      // This can happen if the server was forgotten just before the disconnect event lands.
      console.warn(
        'Server card not found after disconnection event, assuming forgotten:',
        e
      );
    }
  }

  private _onServerDisconnecting(event: events.ServerDisconnecting): void {
    console.debug(`Server ${event.serverId} disconnecting via event queue.`);
    this._updateServerListItemUi(event.serverId, {
      connectionState: ServerConnectionState.DISCONNECTING,
    });
  }

  private _onServerReconnecting(event: events.ServerReconnecting): void {
    console.debug(`Server ${event.serverId} reconnecting via event queue.`);
    this._updateServerListItemUi(event.serverId, {
      connectionState: ServerConnectionState.RECONNECTING,
    });
  }

  // Settings and Other App Logic Handlers
  private _setAppLanguage(event: CustomEvent<{languageCode: string}>): void {
    const languageCode = event.detail.languageCode;
    window.localStorage.setItem('overrideLanguage', languageCode); // Persist user choice
    this.rootEl.setLanguage(languageCode); // Update UI language
    this._changeToDefaultPageUi();
  }

  private _onSetAppearanceRequested(
    event: CustomEvent<{appearance: Appearance}>
  ): void {
    const newAppearance = event.detail.appearance;
    this.settings.set(SettingsKey.APPEARANCE, newAppearance);
    this._setAppearance(newAppearance);
  }

  private _setAppearance(appearance: Appearance): void {
    const rootHtmlElement =
      (this.rootEl.getAppRootElement()?.parentNode as HTMLElement) ||
      this.document.documentElement;
    const isSystemDark =
      this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)')
        .matches ?? false;

    let applyDarkTheme: boolean;
    if (appearance === Appearance.DARK) {
      applyDarkTheme = true;
    } else if (appearance === Appearance.LIGHT) {
      applyDarkTheme = false;
    } else {
      // Appearance.SYSTEM or default
      applyDarkTheme = isSystemDark;
    }

    if (applyDarkTheme) {
      rootHtmlElement.classList.add('dark');
    } else {
      rootHtmlElement.classList.remove('dark');
    }
  }

  private _ackPrivacyTerms(): void {
    this.rootEl.hideServersView(false); // Show servers view
    this.rootEl.closePrivacyDialog();
    this.rootEl.openAddServerDialog(); // Show add server dialog after privacy ack
    this.settings.set(SettingsKey.PRIVACY_ACK, 'true');
  }

  private _autoConnectDialogDismissed(): void {
    this.settings.set(SettingsKey.AUTO_CONNECT_DIALOG_DISMISSED, 'true');
    this.rootEl.closeAutoConnectDialog();
  }

  private _onUpdateDownloaded(): void {
    this.rootEl.showToast(this.localize('update-downloaded'), 60000); // 1 minute duration
  }

  // Helper Methods
  private async _pullClipboardText(): Promise<void> {
    try {
      const text = await this.clipboard.getContents();
      await this._handleClipboardText(text);
    } catch (e) {
      console.warn(
        'Cannot read clipboard, system may lack clipboard support or permission denied.',
        e
      );
    }
  }

  private async _handleClipboardText(text: string): Promise<void> {
    if (!text) return;
    const sanitizedText = text.substring(0, 1000).trim(); // Max length and trim
    try {
      // Attempt to confirm and add server, possibly opening dialog.
      // Pass true for fromClipboard to apply specific logic.
      await this._confirmAddServer(sanitizedText, true);
    } catch (e) {
      // Don't show error to user for clipboard, as it has high false positive rate.
      console.debug('Clipboard text was not a valid server to add:', e);
    }
  }

  private async _confirmAddServer(
    accessKey: string,
    fromClipboard = false
  ): Promise<void> {
    const unwrappedKey = unwrapInvite(accessKey);

    if (fromClipboard && !(this.rootEl as any).isAddServerDialogOpen?.()) {
      // Need a way to check this on AppRootAPI
      if (this.ignoredAccessKeys.has(unwrappedKey)) {
        console.debug(
          'Ignoring access key from clipboard (previously ignored)'
        );
        return;
      }
      // Original logic: "Non-Invite https:// keys should be pasted in explicitly."
      // This means if it's a direct ss:// link (not wrapped in https://invite...#ss://),
      // and it came from clipboard, and add dialog is not open, we might ignore.
      // However, ss:// is an OutlineAccessKey, so it *should* be parsed.
      // The check `accessKey.startsWith('https://')` was on the *original* accessKey.
      // If `unwrappedKey` is different from `accessKey`, it implies it was an invite.
      // If they are the same and it's `ss://` or `ssconf://`, it's a direct key.
      if (
        unwrappedKey === accessKey &&
        (accessKey.startsWith('http://') || accessKey.startsWith('https://'))
      ) {
        // This condition suggests an HTTP/S URL that wasn't an invite.
        // The original code only ignored `https://` not `http://` this way.
        // And `isOutlineAccessKey` would be false for these anyway if not an invite.
        // Re-evaluating the original intent: if it's just a generic https URL, ignore.
        // If it IS an invite link, `unwrapInvite` would extract the ss:// key.
        // So, if `unwrappedKey` is still an https url, it means it wasn't an ss-invite.
        if (
          unwrappedKey.startsWith('https://') &&
          !isOutlineAccessKey(unwrappedKey)
        ) {
          console.debug('Ignoring generic https:// URL from clipboard.');
          return;
        }
      }
    }

    try {
      await config.parseAccessKey(unwrappedKey); // Validate key structure
      // If valid, open dialog with the key (AppRoot method)
      this.rootEl.openAddServerDialog(unwrappedKey);
    } catch (e: any) {
      if (!fromClipboard && e instanceof errors.ServerAlreadyAdded) {
        // If adding manually (not clipboard) and server exists, show error and close dialog.
        this.rootEl.closeAddServerDialog();
        this.showLocalizedError(e);
        return; // Don't re-throw
      }
      throw e; // Re-throw for other validation errors or if from clipboard
    }
  }

  private _arePrivacyTermsAcked(): boolean {
    try {
      return this.settings.get(SettingsKey.PRIVACY_ACK, 'false') === 'true';
    } catch (e) {
      console.error(
        'Could not read privacy acknowledgement setting, assuming not acknowledged:',
        e
      );
      return false;
    }
  }

  private _displayPrivacyView(): void {
    this.rootEl.hideServersView(true); // Hide servers view
    this.rootEl.openPrivacyDialog();
    this.rootEl.closeAddServerDialog(); // Ensure add server dialog is not open
  }

  private async _installVpnService(): Promise<void> {
    this.rootEl.showToast(this.localize('outline-services-installing'), 0); // Indefinite toast
    try {
      await this.installer.installVpn();
      this.rootEl.showToast(this.localize('outline-services-installed'));
    } catch (e: any) {
      const err = e.errorCode ? errors.fromErrorCode(e.errorCode) : e;
      console.error('Failed to set up Outline VPN:', err);
      if (err instanceof errors.UnexpectedPluginError) {
        this.rootEl.showToast(
          this.localize('outline-services-installation-failed')
        );
      } else {
        this.showLocalizedError(err);
      }
    }
  }

  private _maybeShowAutoConnectDialog(): void {
    let dismissed = false;
    try {
      dismissed =
        this.settings.get(
          SettingsKey.AUTO_CONNECT_DIALOG_DISMISSED,
          'false'
        ) === 'true';
    } catch (e) {
      console.error(
        'Failed to read auto-connect dialog status, assuming not dismissed:',
        e
      );
    }
    if (!dismissed) {
      this.rootEl.openAutoConnectDialog();
    }
  }

  private _makeServerListItem(server: Server): ServerListItem {
    return {
      disabled: false, // This might be dynamic based on some conditions in future
      errorMessageId: server.errorMessageId,
      name: server.name,
      address: server.address,
      id: server.id,
      connectionState: ServerConnectionState.DISCONNECTED, // Initial default state
    };
  }

  private _throttleServerConnectionChange(
    serverId: string,
    timeMs: number
  ): boolean {
    if (this.serverConnectionChangeTimeouts.has(serverId)) return true; // Already throttled

    const timeoutId = setTimeout(() => {
      this.serverConnectionChangeTimeouts.delete(serverId);
    }, timeMs);
    this.serverConnectionChangeTimeouts.set(serverId, timeoutId);
    return false;
  }

  private _syncServersToUi(): void {
    this.rootEl.servers = this.serverRepo
      .getAll()
      .map(this._makeServerListItem.bind(this));
    // After updating the list, re-sync individual connectivity states
    this._syncConnectivityStateToAllServers();
  }

  private _syncConnectivityStateToAllServers(): void {
    this.serverRepo.getAll().forEach(server => {
      this._syncServerConnectivityState(server).catch(e => {
        console.error(`Error syncing connectivity for server ${server.id}:`, e);
      });
    });
  }

  private async _syncServerConnectivityState(server: Server): Promise<void> {
    try {
      const isRunning = await server.checkRunning();
      this._updateServerListItemUi(server.id, {
        connectionState: isRunning
          ? ServerConnectionState.CONNECTED
          : ServerConnectionState.DISCONNECTED,
        address: server.address, // Ensure address is current
        errorMessageId: server.errorMessageId, // Sync error message too
      });
    } catch (e) {
      console.error(
        `Failed to sync server connectivity state for ${server.id}:`,
        e
      );
      // Optionally, reflect this error state in the UI for this server
      this._updateServerListItemUi(server.id, {
        connectionState: ServerConnectionState.DISCONNECTED, // Assume disconnected on error
        // Consider adding a temporary error message or status here
      });
    }
  }

  private _registerUrlInterceptionListener(
    urlInterceptor: UrlInterceptor
  ): void {
    urlInterceptor.registerListener(async (url: string) => {
      const unwrappedUrl = unwrapInvite(url);
      if (!isOutlineAccessKey(unwrappedUrl)) {
        console.debug('Ignoring intercepted non-Outline URL:', url);
        return;
      }
      try {
        await this._confirmAddServer(unwrappedUrl);
      } catch (err: any) {
        this._showLocalizedErrorInDefaultPage(err);
      }
    });
  }

  private _changeToDefaultPageUi(): void {
    this.rootEl.changePage(DEFAULT_PAGE); // Uses AppRoot's DEFAULT_PAGE constant
  }

  private _getServerByIdOrThrow(serverId: string): Server {
    const server = this.serverRepo.getById(serverId);
    if (!server) {
      throw new Error(`Could not find server with ID ${serverId}`);
    }
    return server;
  }

  private _updateServerListItemUi(
    id: string,
    propertiesToUpdate: Partial<ServerListItem>
  ): void {
    // Create a new list for Lit to observe the change.
    this.rootEl.servers = this.rootEl.servers.map(
      (serverItem: ServerListItem) => {
        if (serverItem.id === id) {
          return {...serverItem, ...propertiesToUpdate};
        }
        return serverItem;
      }
    );
  }

  private _isWindows(): boolean {
    // Original check was !('cordova' in window). This is more specific to Electron on Windows.
    // For broader non-Cordova desktop, this might need adjustment.
    // For now, keeping it consistent with electron builds being non-cordova.
    return this.platform === 'electron'; // Assuming platform is 'electron' for Windows/Linux/macOS desktop builds
  }

  // UI Dialogs (Confirmation, Error Details)
  private async _showConfirmationDialog(message: string): Promise<boolean> {
    // In a real app, rootEl would provide a method to show a styled confirmation dialog.
    // e.g., return await this.rootEl.showConfirmationDialog(message);
    return Promise.resolve(
      this.document.defaultView?.confirm(message) ?? false
    );
  }

  private _showErrorCauseDialog(error: Error | undefined): void {
    if (!error) return;
    const makeErrorString = (err: unknown, indent = ''): string => {
      if (!err) return `${indent}No further details.`;
      let msg = `${indent}${String(err)}`;
      if (
        typeof err === 'object' &&
        err !== null &&
        'cause' in err &&
        (err as {cause: unknown}).cause
      ) {
        msg += `\n${indent}Cause: ${makeErrorString((err as {cause: unknown}).cause, `${indent}  `)}`;
      }
      return msg;
    };
    this.rootEl.showErrorDetails(makeErrorString(error));
  }
}
