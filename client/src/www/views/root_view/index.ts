import * as i18n from '@outline/infrastructure/i18n';
import {LitElement, html, css, PropertyValueMap} from 'lit';
import {customElement, property, state, query} from 'lit/decorators.js';

import {AddAccessKeyDialog} from './add_access_key_dialog';
import {
  DEFAULT_PAGE,
  LANGUAGES_AVAILABLE,
  DEFAULT_LANGUAGE,
  type LanguageDetail,
} from './constants';
import {ErrorDetailsDialog} from './error_details_dialog';
import {RootNavigation} from './root_navigation';
import {Server} from '../../model/server';
import {OutlineErrorReporter} from '../../shared/error_reporter';

import '../about_view';
import '../contact_view';
import '../language_view';
import '../licenses_view';
import '../appearance_view';
import '../servers_view';

import './root_header';
import './root_navigation';
import './root_toast';

import './add_access_key_dialog';
import './auto_connect_dialog';
import './error_details_dialog';
import './privacy_acknowledgement_dialog';

import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import '@material/web/list/list.js';
import '@material/web/list/list-item.js';
import {ContactView} from '../contact_view';

// Type Definitions
interface RouteInfo {
  path: string;
  page?: string;
}

interface LanguageSelectedEventDetail {
  languageId: string;
}
interface AddServerEventDetail {
  accessKey: string;
}

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      --app-toolbar-height: 56px;
      --app-toolbar-gutter: 0.5rem;
      --app-toolbar-button-gutter: 0.75rem;
      --app-header-height: var(--app-toolbar-height);
      --contact-view-gutter: calc(
        var(--app-toolbar-gutter) + var(--app-toolbar-button-gutter)
      );
      --contact-view-max-width: 400px;
      --light-green: #2fbea5;
      --medium-green: #009688;
      --dark-green: #263238;
      --light-gray: #ececec;
      --app-drawer-width: 280px;

      display: flex;
      flex-direction: column;
      min-height: 100vh;
      font-family: var(--outline-font-family, 'Roboto', sans-serif);
      color: var(--outline-text-color, #212121);
      background-color: var(--outline-background, #f5f5f5);
    }

    .app-layout {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    :host([dir='rtl']) .rtl-mirror {
      transform: scaleX(-1);
    }

    .page-container {
      flex: 1;
      overflow-y: auto;
      position: relative;
    }

    .page-container > * {
      display: none;
      width: 100%;
      height: 100%;
    }
    .page-container > [active] {
      display: block;
    }

    md-list-item,
    .custom-list-item {
      cursor: pointer;
      text-transform: capitalize;
      --md-list-item-label-text-font: var(
        --outline-font-family,
        'Roboto',
        sans-serif
      );
      --md-list-item-label-text-size: 16px;
      --md-list-item-selected-container-color: var(--light-gray);
      --md-list-item-selected-label-text-color: var(--medium-green);
    }
    md-list-item:not([selected]),
    .custom-list-item:not([selected]) {
      --md-list-item-label-text-color: var(--outline-text-color);
      opacity: 0.8;
    }

    .nav-hr {
      border: none;
      height: 1px;
      background-color: #e0e0e0;
      margin: 8px 16px;
    }

    @media (max-height: 480px) {
      :host {
        --app-drawer-width: 250px;
      }
    }
  `;

  // data
  @property({type: String}) language: string = this._computeInitialLanguage();
  @property({type: Boolean}) useKeyIfMissing = true;
  @property({type: String}) appVersion = '';
  @property({type: String}) appBuild = '0';
  @property({type: Object}) errorReporter?: OutlineErrorReporter;
  @property({type: String}) rootPath = '';
  @property({type: Array}) servers: Server[] = [];
  @property({type: String}) platform: string = this._determinePlatform();
  @property({type: Boolean}) appearanceSelectionAvailable = false;

  @state() private _page: string = DEFAULT_PAGE;
  @state() private _route: RouteInfo = {
    path: `/${DEFAULT_PAGE}`,
    page: DEFAULT_PAGE,
  };
  @state() private _localizedStrings: Record<string, string> = {};
  @state() private _toastText = '';
  @state() private _toastButtonText?: string;
  @state() private _toastButtonHandler?: () => void;
  @state() private _toastUrl?: URL;
  @state() private _toastDuration = 3000;

  @query('#navigation') private _navigation?: RootNavigation;
  // @query('#toast') private _toast?: HTMLElement & {
  //   labelText?: string;
  //   timeoutMs?: number;
  //   open?: () => void;
  //   show?: () => void;
  //   close: (reason?: string) => void;
  //   addActionButton?: (text: string, handler: () => void) => void;
  // };

  @query('add-access-key-dialog')
  private _addAccessKeyDialog?: AddAccessKeyDialog;
  @query('error-details-dialog')
  private _errorDetailsDialog?: ErrorDetailsDialog;
  @query('contact-view') private _contactView?: ContactView;
  @query('#helpAnchor') private _helpAnchor?: HTMLAnchorElement;

  get pageTitleMessageId(): string | undefined {
    if (this._page === DEFAULT_PAGE || !this._page) {
      return;
    }

    return `${this._page}-page-title`;
  }

  _computeSupportSiteUrl(baseUrl: string): string {
    const languageCode = LANGUAGES_AVAILABLE[this.language]?.supportId;
    const parsedUrl = new URL(baseUrl);

    if (languageCode) {
      parsedUrl.searchParams.set('hl', languageCode);
    }

    return parsedUrl.toString();
  }

  get isHome(): boolean {
    return this._page === DEFAULT_PAGE;
  }

  get isDesktop(): boolean {
    return this.platform === 'osx' || this.platform === 'electron';
  }

  get _languagesAvailableForPicker(): LanguageDetail[] {
    return Object.values(LANGUAGES_AVAILABLE).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  get _useAltAccessMessage(): boolean {
    return (
      this.language === 'fa' &&
      this.platform !== 'ios' &&
      this.platform !== 'osx'
    );
  }

  // lifecycle
  async connectedCallback() {
    super.connectedCallback();
    await this._setInitialLanguage();
    window.addEventListener('hashchange', this._handleHashChange);
    this._handleHashChange();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('hashchange', this._handleHashChange);
  }

  protected async updated(
    changedProperties: PropertyValueMap<unknown> | Map<PropertyKey, unknown>
  ) {
    if (changedProperties.has('language')) {
      await this._setLanguage(this.language);
    }

    if (changedProperties.has('_page') && this._navigation?.open) {
      this._navigation.open = false;
    }
  }

  // platform
  private _determinePlatform(): string {
    if (window.cordova) {
      return window.cordova.platformId;
    }

    if (
      typeof window.process !== 'undefined' &&
      window.process.versions &&
      window.process.versions.electron
    ) {
      return 'electron';
    }

    return 'browser';
  }

  // language
  private _computeInitialLanguage(): string {
    const preferredLanguages = i18n.getBrowserLanguages();
    const overrideLanguage = localStorage.getItem('overrideLanguage');
    if (overrideLanguage) {
      preferredLanguages.unshift(new i18n.LanguageCode(overrideLanguage));
    }
    const matcher = new i18n.LanguageMatcher(
      i18n.languageList(Object.keys(LANGUAGES_AVAILABLE)),
      new i18n.LanguageCode(DEFAULT_LANGUAGE)
    );
    return matcher.getBestSupportedLanguage(preferredLanguages).string();
  }

  private async _setInitialLanguage() {
    await this._loadLanguage(this.language);
    this._updatePageLanguageDirection(this.language);
  }

  private async _setLanguage(languageCode: string) {
    await this._loadLanguage(languageCode);
    this._updatePageLanguageDirection(languageCode);
  }

  private async _loadLanguage(languageCode: string) {
    let langToLoad = languageCode;
    if (!LANGUAGES_AVAILABLE[langToLoad]) {
      console.warn(
        `Language ${langToLoad} not found, falling back to ${DEFAULT_LANGUAGE}`
      );
      langToLoad = DEFAULT_LANGUAGE;
      if (this.language !== langToLoad) {
        this.language = langToLoad;
        return;
      }
      if (
        !Object.keys(this._localizedStrings).length ||
        this._localizedStrings.app_name === undefined
      ) {
        await this._loadLanguage(langToLoad);
        return;
      }
      return;
    }

    const url = `${this.rootPath}messages/${langToLoad}.json`;
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`Failed to load ${url}: ${response.statusText}`);
      this._localizedStrings = await response.json();
      this.dispatchEvent(
        new CustomEvent('app-resources-loaded', {
          bubbles: true,
          composed: true,
          detail: {language: langToLoad},
        })
      );
    } catch (error) {
      console.error(`Could not load language ${langToLoad}:`, error);
      if (langToLoad !== DEFAULT_LANGUAGE) {
        this.language = DEFAULT_LANGUAGE;
      } else {
        this._localizedStrings = {};
      }
    }
    this.requestUpdate();
  }

  private _updatePageLanguageDirection(languageCode: string) {
    const direction = LANGUAGES_AVAILABLE[languageCode]?.dir || 'ltr';
    document.documentElement.setAttribute('dir', direction);
    this.setAttribute('dir', direction);
  }

  localize(key: string, ...args: (string | number)[]): string {
    let message = this._localizedStrings[key];
    if (message === undefined) {
      return this.useKeyIfMissing ? key : `[${key}]`;
    }
    args.forEach((arg, index) => {
      message = message.replace(
        new RegExp(`\\$${index + 1}`, 'g'),
        String(arg)
      );
    });
    return message;
  }

  // routing
  private _handleHashChange() {
    const hash = window.location.hash.slice(1);
    const path = hash || `/${DEFAULT_PAGE}`;
    const pageFromRoute = path.startsWith('/')
      ? path.substring(1)
      : DEFAULT_PAGE;

    let newPage = pageFromRoute;

    if (newPage === this._page && this._route.path === path) {
      return;
    }

    if (newPage === 'help') {
      this._openHelpPage();
      this._navigateToPath(`/${DEFAULT_PAGE}`, true);
      return;
    }

    if (newPage === 'quit') {
      this.dispatchEvent(
        new CustomEvent('quit-pressed', {bubbles: true, composed: true})
      );
      return;
    }

    const knownPages = [
      'home',
      'contact',
      'about',
      'language',
      'licenses',
      'appearance',
    ];
    if (!knownPages.includes(newPage)) {
      console.warn(`Unknown page "${newPage}", redirecting to default.`);
      newPage = DEFAULT_PAGE;
      this._navigateToPath(`/${newPage}`, true);
      return;
    }

    this._page = newPage;
    this._route = {path, page: newPage};

    if (this._contactView && newPage !== 'contact') {
      this._contactView.reset?.();
    }
  }

  private _navigateToPath(path: string, replace = false) {
    const newHash = `#${path}`;
    if (replace) {
      window.history.replaceState(null, '', newHash);
      if (window.location.hash === newHash) {
        this._handleHashChange();
      }
    } else {
      if (window.location.hash !== newHash) {
        window.location.hash = newHash;
      } else {
        this._handleHashChange();
      }
    }
  }

  changePage(page: string) {
    if (this._page === page) {
      console.debug('already on page', page);
      return;
    }
    this._navigateToPath(`/${page}`);
  }

  private _goBack() {
    if (this._page === 'contact') {
      this._contactView?.reset?.();
    }
    window.history.back();
  }

  // ui
  openDrawer() {
    if (this._navigation) {
      this._navigation.open = true;
    }
  }

  closeDrawer() {
    if (this._navigation) {
      this._navigation.open = false;
    }
  }

  showToast(
    text: string
    // duration = 3000,
    // buttonText?: string,
    // buttonHandler?: () => void,
    // buttonUrl?: string
  ) {
    // const show = () => {
    //   this._toastText = text;
    //   this._toastDuration = duration;
    //   this._toastButtonText = buttonText;
    //   this._toastButtonHandler = buttonHandler;
    //   try {
    //     this._toastUrl = buttonUrl ? new URL(buttonUrl) : undefined;
    //   } catch (e) {
    //     console.error('Invalid URL for toast action:', buttonUrl, e);
    //     this._toastUrl = undefined;
    //   }
    //   if (this._toast) {
    //     // Assuming a custom toast element API. Adapt as needed.
    //     this._toast.labelText = this._toastText;
    //     this._toast.timeoutMs =
    //       this._toastDuration > 0 ? this._toastDuration : -1; // -1 for indefinite
    //     // Example of programmatically adding an action to a custom toast
    //     if (
    //       typeof this._toast.addActionButton === 'function' &&
    //       this._toastButtonText
    //     ) {
    //       const handler =
    //         this._toastButtonHandler ||
    //         (this._toastUrl
    //           ? () => {
    //               const anchor = document.createElement('a');
    //               anchor.href = this._toastUrl!.href;
    //               anchor.target = '_blank';
    //               anchor.click();
    //             }
    //           : undefined);
    //       if (handler) {
    //         this._toast.addActionButton(this._toastButtonText, handler);
    //       }
    //     }
    //     if (typeof this._toast.show === 'function') this._toast.show();
    //     else if (typeof this._toast.open === 'function') this._toast.open();
    //   }
    // };
    // if (this._toast && (this._toast as any).open) {
    //   this._toast.close();
    // } else {
    //   show();
    // }

    // TODO: toast primitive
    alert(text);
  }

  showContactSuccessToast() {
    this.changePage(DEFAULT_PAGE);
    this.showToast(this.localize('feedback-thanks'));
  }

  showContactErrorToast() {
    this.showToast(this.localize('error-feedback-submission'));
  }

  showErrorDetails(errorDetails: object) {
    if (this._errorDetailsDialog) {
      this._errorDetailsDialog.errorDetails = JSON.stringify(errorDetails);
      this._errorDetailsDialog.open = true;
    }
  }

  promptAddServer(_event?: CustomEvent<AddServerEventDetail>) {
    if (this._addAccessKeyDialog) {
      this._addAccessKeyDialog.open = true;
    }
  }

  private _openHelpPage() {
    const helpUrl = this._computeSupportSiteUrl(this.localize('help-page-url'));

    if (this._helpAnchor) {
      this._helpAnchor.href = helpUrl;
      if (this.platform === 'ios' || this.platform === 'android') {
        window.open(this._helpAnchor.href, '_system');
      } else {
        this._helpAnchor.click();
      }
    } else {
      window.open(
        helpUrl,
        this.platform === 'ios' || this.platform === 'android'
          ? '_system'
          : '_blank'
      );
    }
  }

  // events
  private _onNavClick(page: string) {
    this.changePage(page);
    this.closeDrawer();
  }

  private _onQuitClick() {
    this.dispatchEvent(
      new CustomEvent('quit-pressed', {bubbles: true, composed: true})
    );
    this.closeDrawer();
  }

  private _onHelpNavClick() {
    this._openHelpPage();
    this.closeDrawer();
  }

  private _onLanguageSelectedInView(
    e: CustomEvent<LanguageSelectedEventDetail>
  ) {
    this.language = e.detail.languageId;
    this.changePage(DEFAULT_PAGE);
  }

  // render
  render() {
    const privacyPageUrl = this._computeSupportSiteUrl(
      'https://support.google.com/outline/answer/15331222'
    );

    return html`
      <root-navigation
        id="drawer"
        .localize=${this.localize.bind(this)}
        .page=${this._page}
        ?show-quit-button=${this.isDesktop}
        .data-collection-page-url=${this._computeSupportSiteUrl(
          'https://support.google.com/outline/answer/15331222'
        )}
        ?appearance-selection-available=${this.appearanceSelectionAvailable}
        @nav-drawer-item-selected=${(e: CustomEvent<{page: string}>) =>
          this._onNavClick(e.detail.page)}
        @nav-drawer-quit=${this._onQuitClick}
        @nav-drawer-help=${this._onHelpNavClick}
      >
      </root-navigation>
      <a
        id="helpAnchor"
        style="display:none;"
        target="_blank"
        rel="noopener noreferrer"
      ></a>

      <div class="app-layout">
        <root-header-element
          .localize=${this.localize.bind(this)}
          .page-title-key=${this.pageTitleMessageId}
          ?show-back-button=${!this.isHome}
          ?show-add-button=${this.isHome}
          @menu-button-clicked=${this.openDrawer}
          @back-button-clicked=${this._goBack}
          @add-button-clicked=${this.promptAddServer}
        ></root-header-element>

        <main class="page-container">
          <servers-view
            name="home"
            ?active=${this.isHome}
            .servers=${this.servers}
            .localize=${this.localize.bind(this)}
            ?should-show-access-key-wiki-link=${this._useAltAccessMessage}
            @add-server=${this.promptAddServer}
          ></servers-view>
          <contact-view
            name="contact"
            id="contactView"
            ?active=${this._page === 'contact'}
            .localize=${this.localize.bind(this)}
            .languageCode=${LANGUAGES_AVAILABLE[this.language]?.supportId}
            .errorReporter=${this.errorReporter}
            @contact-success=${this.showContactSuccessToast}
            @contact-error=${this.showContactErrorToast}
          ></contact-view>
          <about-view
            name="about"
            ?active=${this._page === 'about'}
            .localize=${this.localize.bind(this)}
            .rootPath=${this.rootPath}
            .version=${this.appVersion}
            .build=${this.appBuild}
          ></about-view>
          <language-view
            name="language"
            ?active=${this._page === 'language'}
            .selectedLanguageId=${this.language}
            .languages=${this._languagesAvailableForPicker}
            .localize=${this.localize.bind(this)}
            @language-selected=${this._onLanguageSelectedInView}
          ></language-view>
          <licenses-view
            name="licenses"
            dir="ltr"
            ?active=${this._page === 'licenses'}
            .localize=${this.localize.bind(this)}
            .rootPath=${this.rootPath}
          ></licenses-view>
          <appearance-view
            name="appearance"
            ?active=${this._page === 'appearance'}
            .localize=${this.localize.bind(this)}
            .settings=${{}}
            .eventReporter=${{}}
          ></appearance-view>
        </main>
      </div>

      <root-toast id="toast"></root-toast>

      <add-access-key-dialog
        .localize=${this.localize.bind(this)}
      ></add-access-key-dialog>
      <error-details-dialog
        .localize=${this.localize.bind(this)}
      ></error-details-dialog>
      <privacy-acknowledgement-dialog
        .localize=${this.localize.bind(this)}
        .privacyPageUrl=${privacyPageUrl}
      ></privacy-acknowledgement-dialog>
      <auto-connect-dialog
        .localize=${this.localize.bind(this)}
      ></auto-connect-dialog>
    `;
  }
}
