/*
  Copyright 2025 The Outline Authors

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import * as i18n from '@outline/infrastructure/i18n';
import {LitElement, html, css, PropertyValues} from 'lit';
import {property, query, state, customElement} from 'lit/decorators.js';

import '../about_view';
import '../appearance_view';
import '../contact_view';
import '../language_view';
import '../licenses_view';
import '../servers_view';
import './add_access_key_dialog';
import './auto_connect_dialog';
import './error_details_dialog';
import './privacy_acknowledgement_dialog';
import './root_header';
import './root_navigation';
import '@material/web/all.js';
import '@polymer/app-route/app-location.js';
import '@polymer/app-route/app-route.js';
import '@polymer/iron-pages/iron-pages.js';
import '@polymer/paper-button/paper-button.js';
import '@polymer/paper-icon-button/paper-icon-button.js';
import '@polymer/paper-toast/paper-toast.js';
import '@polymer/polymer/lib/legacy/polymer.dom.js';
import '@polymer/polymer/polymer-legacy.js';
import 'element-internals-polyfill';

import {
  LANGUAGES_AVAILABLE,
  PRIVACY_POLICY_URL,
  TOAST_TIMEOUT_MS,
  TOAST_RENDER_DEFER_MS,
} from './constants';
import {Appearance} from '../../app/settings';
import {OutlineErrorReporter} from '../../shared/error_reporter';
import {ServerListItem} from '../servers_view';

interface DialogElement extends HTMLElement {
  open: boolean;
}

interface ErrorDialogElement extends DialogElement {
  errorDetails: string;
}

interface ContactViewElement extends HTMLElement {
  reset: () => void;
}

interface PaperToastElement extends HTMLElement {
  opened: boolean;
  text: string;
  duration: number;
  open: () => void;
  close: () => void;
}

@customElement('root-view')
export class RootView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      color: var(--outline-text-color);
      background-color: var(--outline-background-color);
      font-family: var(--outline-font-family);
    }

    iron-pages {
      display: flex;
      flex: 1;
      background-color: var(--outline-background-color);
      color: var(--outline-text-color);
    }

    appearance-view {
      background-color: var(--outline-background-color);
      color: var(--outline-text-color);
    }

    a {
      color: var(--outline-highlight-color);
      text-decoration: underline;
    }

    paper-button {
      min-width: 0;
      margin: 0;
    }

    paper-toast {
      --paper-toast-background-color: var(--outline-card-background-color);
      align-items: center;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    }

    paper-toast paper-button {
      color: var(--outline-green-light);
      text-align: center;
      margin-left: 12px;
    }
  `;

  @property({type: String}) platform = '';
  @property({type: String}) appVersion = '0.0.0-debug';
  @property({type: String}) appBuild = '0';
  @property({type: Object}) errorReporter: OutlineErrorReporter;
  @property({type: String}) rootPath = '';
  @property({type: Array}) servers: ServerListItem[] = [];
  @property({type: String}) selectedAppearance: Appearance = Appearance.SYSTEM;

  @state() private _page = 'home';
  @state() private toastUrl = '';
  @state() private resources: {[key: string]: string} = {};

  @query('#toast') private toast!: PaperToastElement;
  @query('#toastButton') private toastButton!: HTMLElement & {
    _handler?: () => void;
  };
  @query('#toastUrl') private toastAnchor!: HTMLAnchorElement;
  @query('#addServerView') private addServerView!: DialogElement;
  @query('#errorDetailsView') private errorDetailsView!: ErrorDialogElement;
  @query('#contactView') private contactView!: ContactViewElement;

  get page() {
    return this._page;
  }

  set page(newPage: string) {
    globalThis.location.hash = `/${newPage}`;

    this.contactView?.reset();
  }

  get languageCode() {
    const preferredLanguages = i18n.getBrowserLanguages();
    const overrideLanguage = localStorage.getItem('overrideLanguage');

    if (overrideLanguage) {
      preferredLanguages.unshift(new i18n.LanguageCode(overrideLanguage));
    }

    const matcher = new i18n.LanguageMatcher(
      i18n.languageList(Object.keys(LANGUAGES_AVAILABLE)),
      new i18n.LanguageCode('en')
    );

    return matcher.getBestSupportedLanguage(preferredLanguages).string();
  }

  get dir() {
    return LANGUAGES_AVAILABLE[this.languageCode]?.dir ?? 'ltr';
  }

  get darkMode() {
    return this.selectedAppearance === Appearance.DARK;
  }

  private get privacyPolicyUrl() {
    const parsedUrl = new URL(PRIVACY_POLICY_URL);
    const supportLangCode = LANGUAGES_AVAILABLE[this.languageCode]?.supportId;

    if (supportLangCode) {
      parsedUrl.searchParams.set('language', supportLangCode);
    }

    return parsedUrl.toString();
  }

  private get availableLanguages() {
    return Object.values(LANGUAGES_AVAILABLE).sort((a, b) =>
      a.name > b.name ? 1 : -1
    );
  }

  private get pageTitleMessageId() {
    return this.page === 'home' ? '' : `${this.page}-page-title`;
  }

  private get showBackButton() {
    return this.page !== 'home';
  }

  private get showAddButton() {
    return this.page === 'home';
  }

  private get showQuitButton() {
    return this.platform === 'osx' || this.platform === 'Electron';
  }

  private get useAltAccessMessage() {
    return this.languageCode === 'fa' && this.platform !== 'ios';
  }

  async connectedCallback() {
    super.connectedCallback();

    globalThis.addEventListener('hashchange', this.changePage);

    if (typeof globalThis.cordova === 'undefined') {
      this.platform = 'Electron';
    } else {
      this.platform = globalThis.cordova.platformId;
    }

    if (!globalThis.location.hash) {
      globalThis.history.replaceState({}, '', '#/home');
    }

    this.changePage();
  }

  protected async willUpdate(changedProperties: PropertyValues) {
    if (changedProperties.has('languageCode')) {
      const url = `${this.rootPath}messages/${this.languageCode}.json`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        this.resources[this.languageCode] = await response.json();
        this.dispatchEvent(
          new CustomEvent('app-localize-resources-loaded', {
            bubbles: true,
            composed: true,
          })
        );
      } catch (e) {
        console.error(`Failed to load resources from ${url}`, e);
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    globalThis.removeEventListener('hashchange', this.changePage);
  }

  render() {
    return html`
      <app-header-layout fullbleed>
        <root-header
          slot="header"
          .localize=${this.localize}
          title=${this.localize(this.pageTitleMessageId)}
          ?show-back-button=${this.showBackButton}
          ?show-add-button=${this.showAddButton}
        ></root-header>

        <iron-pages .selected=${this.page} attr-for-selected="name">
          <servers-view
            name="home"
            ?dark-mode=${this.darkMode}
            .servers=${this.servers}
            .localize=${this.localize}
            ?should-show-access-key-wiki-link=${this.useAltAccessMessage}
            @add-server=${() => (this.addServerView.open = true)}
          ></servers-view>
          <contact-view
            name="contact"
            id="contactView"
            .localize=${this.localize}
            language-code=${this.languageCode}
            .error-reporter=${this.errorReporter}
            @success=${this.toastContactSuccess}
            @error=${this.toastContactFailure}
          ></contact-view>
          <about-view
            name="about"
            ?dark-mode=${this.darkMode}
            .localize=${this.localize}
            root-path=${this.rootPath}
            version=${this.appVersion}
            .build=${this.appBuild}
          ></about-view>
          <language-view
            name="language"
            selected-language-id=${this.languageCode}
            .languages=${this.availableLanguages}
          ></language-view>
          <licenses-view
            name="licenses"
            dir="ltr"
            .localize=${this.localize}
            root-path=${this.rootPath}
          ></licenses-view>
          <appearance-view
            name="appearance"
            selected-appearance=${this.selectedAppearance}
            .localize=${this.localize}
          ></appearance-view>
        </iron-pages>
      </app-header-layout>

      <root-navigation
        .localize=${this.localize}
        id="drawer"
        ?show-quit=${this.showQuitButton}
        data-collection-page-url=${this.privacyPolicyUrl}
      ></root-navigation>

      <add-access-key-dialog
        id="addServerView"
        .localize=${this.localize}
      ></add-access-key-dialog>

      <error-details-dialog
        id="errorDetailsView"
        .localize=${this.localize}
      ></error-details-dialog>

      <privacy-acknowledgement-dialog
        id="privacyView"
        .localize=${this.localize}
        privacy-page-url=${this.privacyPolicyUrl}
      ></privacy-acknowledgement-dialog>

      <auto-connect-dialog
        id="autoConnectDialog"
        .localize=${this.localize}
      ></auto-connect-dialog>

      <paper-toast id="toast" class="fit-bottom" no-cancel-on-esc-key>
        <paper-button
          id="toastButton"
          @click=${this.invokeToastHandler}
        ></paper-button>
        <a hidden id="toastUrl" href=${this.toastUrl}></a>
      </paper-toast>
    `;
  }

  private readonly localize: i18n.Localizer = (
    key: string,
    ...args: string[]
  ) => {
    if (!key) {
      return '';
    }

    const template = this.resources[key];

    if (template) {
      return template.replace(/\$(\d)/g, (_, index) => args[index - 1] || '');
    }

    return key;
  };

  showErrorDetails(errorDetails: string) {
    this.errorDetailsView.errorDetails = errorDetails;
    this.errorDetailsView.open = true;
  }

  changePage() {
    this.page = globalThis.location.hash.substring(2) || 'home';
  }

  showToast(
    text: string,
    duration?: number,
    buttonText?: string,
    buttonHandler?: () => void,
    url?: string
  ) {
    if (this.toast.opened) {
      this.toast.close();
    }

    setTimeout(() => {
      this.toast.text = text;
      this.toast.duration = duration || TOAST_TIMEOUT_MS;

      if (buttonText) {
        this.toastButton.hidden = false;
        this.toastButton.textContent = buttonText;

        if (buttonHandler) {
          this.toastButton._handler = buttonHandler;
        } else {
          this.toastUrl = url ?? '';
          this.toastButton._handler = () => this.toastAnchor.click();
        }
      } else {
        this.toastButton.hidden = true;
      }

      this.toast.open();
    }, TOAST_RENDER_DEFER_MS);
  }

  toastContactSuccess() {
    this.page = 'home';

    this.showToast(this.localize('feedback-thanks'));
  }

  toastContactFailure() {
    this.showToast(this.localize('error-feedback-submission'));
  }

  invokeToastHandler() {
    if (!this.toastButton._handler) {
      return;
    }

    this.toast.close();

    const handler = this.toastButton._handler;
    delete this.toastButton._handler;
    handler();
  }
}
