/*
  Copyright 2020 The Outline Authors

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

import '@polymer/polymer/polymer-legacy.js';
import '@polymer/polymer/lib/legacy/polymer.dom.js';
import '@polymer/app-layout/app-drawer/app-drawer.js';
import '@polymer/app-layout/app-header/app-header.js';
import '@polymer/app-layout/app-header-layout/app-header-layout.js';
import '@polymer/app-layout/app-toolbar/app-toolbar.js';
import '@polymer/app-route/app-location.js';
import '@polymer/app-route/app-route.js';
import '@polymer/iron-icons/iron-icons.js';
import '@polymer/iron-pages/iron-pages.js';
import '@polymer/paper-button/paper-button.js';
import '@polymer/paper-card/paper-card.js';
import '@polymer/paper-dialog/paper-dialog.js';
import '@polymer/paper-dropdown-menu/paper-dropdown-menu.js';
import '@polymer/paper-icon-button/paper-icon-button.js';
import '@polymer/paper-input/paper-input.js';
import '@polymer/paper-input/paper-textarea.js';
import '@polymer/paper-item/paper-item.js';
import '@polymer/paper-item/paper-icon-item.js';
import '@polymer/paper-listbox/paper-listbox.js';
import '@polymer/paper-toast/paper-toast.js';

import 'outline-i18n/index.js';
import './about-view.js';
import './add-server-view.js';
import './feedback-view.js';
import './language-view.js';
import './licenses-view.js';
import './outline-icons.js';
import './privacy-view.js';
import './server-connection-viz.js';
import './server-list.js';
import './servers-view.js';
import './server-rename-dialog.js';
import './user-comms-dialog.js';

import {AppLocalizeBehavior} from '@polymer/app-localize-behavior/app-localize-behavior.js';
import {PaperMenuButton} from '@polymer/paper-menu-button/paper-menu-button.js';
import {mixinBehaviors} from '@polymer/polymer/lib/legacy/class.js';
import {html} from '@polymer/polymer/lib/utils/html-tag.js';
import {PolymerElement} from '@polymer/polymer/polymer-element.js';

// Workaround:
// https://github.com/PolymerElements/paper-menu-button/issues/101#issuecomment-297856912
PaperMenuButton.prototype.properties.restoreFocusOnClose.value = false;

export class AppRoot extends mixinBehaviors
([AppLocalizeBehavior], PolymerElement) {
  static get template() {
    return html`
    <style>
      :host {
        --app-toolbar-height: 40px;
        --light-green: #2fbea5;
        --medium-green: #009688;
        --dark-green: #263238;
        --light-gray: #ececec;
        --paper-dialog-button-color: var(--medium-green);
        --app-drawer-width: 280px;
        display: flex;
        flex-direction: column;
      }

      app-header {
        height: 56px;
      }

      app-toolbar {
        height: var(--app-toolbar-height);
        color: #fff;
        padding: 8px;
        background: var(--dark-green);
        text-align: center;
        display: flex;
        justify-content: space-between;
      }

      app-toolbar [main-title] {
        flex: 2 1 100%;
      }

      app-toolbar img {
        height: 19px;
        margin-top: 2px;
      }

      app-toolbar paper-icon-button {
        /* make the ink color (used for tap animations) actually visible */
        --paper-icon-button-ink-color: #eff;
      }

      #app-toolbar-left,
      #app-toolbar-right {
        flex: 1;
        min-width: 40px;
      }

      iron-pages {
        display: flex;
        flex: 1;
      }

      #drawer-nav {
        padding: 0;
      }

      /* rtl:begin:ignore */
      #drawer-nav paper-icon-item {
        cursor: pointer;
        font-size: 16px;
        --paper-item-selected: {
          color: var(--medium-green);
          background-color: var(--light-gray);
          font-weight: normal;
        }
      }

      #drawer-nav paper-icon-item:focus::before,
      #drawer-nav paper-icon-item:focus::after {
        color: var(--medium-green);
        background-color: var(--light-gray);
      }
      /* rtl:end:ignore */

      /* Manually reverse icons that require mirroring in RTL languages. */
      :host(:dir(rtl)) #feedback-icon,
      :host(:dir(rtl)) #backBtn {
        transform: scaleX(-1);
      }

      #logo-nav {
        background-color: var(--dark-green);
        text-align: center;
        height: 120px;
      }

      #logo {
        width: 60px;
        height: 60px;
        margin-top: 30px;
      }

      .nav-hr {
        background-color: #e0e0e0;
        height: 1px;
        margin: 0;
        border-width: 0px;
      }

      #drawer-nav paper-icon-item .item-label {
        float: left;
      }

      #drawer-nav paper-icon-item:not(.iron-selected) {
        opacity: 0.8;
      }

      #drawer-nav paper-item {
        min-height: 32px;
      }

      .last-menu-item {
        margin-bottom: 12px;
      }

      .border-top {
        border-top: 1px solid #e0e0e0;
        padding-top: 12px;
      }

      paper-item > :first-child {
        color: rgba(0, 0, 0, 0.54);
        font-size: 14px;
        text-decoration: none;
        width: 100%;
        cursor: pointer;
      }

      paper-toast {
        --paper-toast-background-color: var(--dark-green);
        align-items: center;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
      }

      paper-toast paper-button {
        color: var(--light-green);
        text-align: center;
        /* Prevent the button getting too close to the toast's text. */
        margin-left: 12px;
      }

      @media (max-height: 480px) {
        :host {
          --app-drawer-width: 250px;
        }
        #drawer-nav paper-icon-item {
          min-height: 42px;
        }
      }
      @media (min-height: 600px) {
        #logo-nav {
          height: 180px;
        }
        #logo {
          width: 68px;
          height: 68px;
          margin-top: 56px;
        }
        #drawer-nav paper-item {
          min-height: 48px;
        }
      }
    </style>
    <app-location route="{{route}}" url-space-regex="^/index.html" use-hash-as-path=""></app-location>
    <app-route route="{{route}}" pattern="/:page" data="{{routeData}}"></app-route>

    <privacy-view id="privacyView" root-path="[[rootPath]]" localize="[[localize]]" hidden=""></privacy-view>

    <app-header-layout fullbleed="">
      <app-header slot="header" fixed="">
        <app-toolbar>
          <div id="app-toolbar-left">
            <paper-icon-button id="menuBtn" hidden\$="[[shouldShowBackButton]]" icon="menu" on-tap="openDrawer"></paper-icon-button>
            <paper-icon-button id="backBtn" hidden\$="[[!shouldShowBackButton]]" icon="arrow-back" on-tap="_goBack"></paper-icon-button>
          </div>
          <div main-title="" class\$="[[page]]">
            <img src\$="[[rootPath]]assets/outline-client-logo.svg" hidden\$="[[!shouldShowAppLogo]]">
            <div hidden\$="[[shouldShowAppLogo]]">[[localize(pageTitleKey)]]</div>
          </div>
          <div id="app-toolbar-right">
            <paper-icon-button id="addBtn" icon="add" on-tap="promptAddServer" hidden\$="[[!shouldShowAddButton]]"></paper-icon-button>
          </div>
        </app-toolbar>
      </app-header>

      <iron-pages id="pages" selected="[[page]]" attr-for-selected="name">
        <servers-view name="servers" id="serversView" servers="{{servers}}" root-path="[[rootPath]]" localize="[[localize]]"></servers-view>
        <feedback-view name="feedback" id="feedbackView" localize="[[localize]]"></feedback-view>
        <about-view name="about" id="aboutView" localize="[[localize]]" root-path="[[rootPath]]" version="[[appVersion]]"></about-view>
        <language-view name="language" id="aboutView" selected-language="[[language]]" languages="[[_getLanguagesAvailableValues(LANGUAGES_AVAILABLE)]]"></language-view>
        <!-- Do not mirror licenses text, as it is not localized. -->
        <licenses-view name="licenses" id="licensesView" dir="ltr" localize="[[localize]]" root-path="[[rootPath]]"></licenses-view>
      </iron-pages>
    </app-header-layout>

    <app-drawer slot="drawer" id="drawer" swipe-open="" transition-duration="350">
      <!--
        Notice that transition-duration="350"? That magic number is very sensitive!

        ************************** CHANGE. AT. YOUR. PERIL. **************************

        Want to know why? You really don't. But I'll tell you anyway.

        ************************* WARNING: INSANITY AHEAD!!! *************************

        When you tap a nav item in this drawer, it triggers a tap event on the paper-listbox
        which in turn triggers our closeDrawer() function (see \`on-tap="closeDrawer"\` below).

        So far so good. Here's where things get interesting.

        The "Submit Feedback" nav item in the drawer happens to be positioned right above the
        email input in the feedback page. When you tap the Submit Feedback nav item, if we
        close the drawer too quickly, it's possible for the touch event to (first fire on the
        the nav item, as expected, but then erroneously) propagate down to the email input that is
        positioned right underneath the spot that was just tapped. This causes the email input to
        get incorrectly focused and the virtual keyboard to slide out! If I take out the
        \`transition-duration="350"\` above, I can reproduces this 100% of the time on my iPhone 7
        running iOS 10.3.3. (It has not yet been observed on macOS or Android.)

        To prevent this from happening, we can't close the drawer too quickly. As long as we slow
        down the transition-duration from the default 200ms to ~350ms, we prevent the tap from
        erroneously propagating down to the email input underneath, and no wacky phantom focus
        ensues.

        And in case you're wondering, simply calling event.stopPropagation() after we call
        this.\$.drawer.close() in drawer-nav's on-tap listener does not fix this, if we leave
        the transition duration set to the 200ms default.

        <poop-with-flies-dot-gif/>
      -->

      <div id="logo-nav">
        <img src\$="[[rootPath]]assets/logo-nav.png" alt="logo" id="logo">
      </div>
      <hr class="nav-hr">
      <paper-listbox id="drawer-nav" selected="{{routeData.page}}" attr-for-selected="name" on-tap="closeDrawer">
        <paper-icon-item name="servers">
          <iron-icon icon="outline-icons:outline" slot="item-icon"></iron-icon>
          <span class="item-label">[[localize('servers-menu-item')]]</span>
        </paper-icon-item>
        <paper-icon-item name="feedback">
          <iron-icon id="feedback-icon" icon="feedback" slot="item-icon"></iron-icon>
          [[localize('feedback-page-title')]]
        </paper-icon-item>
        <paper-icon-item name="about">
          <iron-icon icon="info" slot="item-icon"></iron-icon>
          [[localize('about-page-title')]]
        </paper-icon-item>
        <paper-icon-item name="help">
          <a href="https://s3.amazonaws.com/outline-vpn/index.html#/support" id="helpAnchor" hidden=""></a>
          <iron-icon icon="help" slot="item-icon"></iron-icon>
          [[localize('help-page-title')]]
        </paper-icon-item>
        <paper-icon-item name="language" class\$="[[_computeIsLastVisibleMenuItem(shouldShowQuitButton)]]">
          <iron-icon icon="language" slot="item-icon"></iron-icon>
          [[localize('change-language-page-title')]]
        </paper-icon-item>
        <paper-icon-item name="quit" class="last-menu-item" hidden\$="[[!shouldShowQuitButton]]">
          <iron-icon icon="cancel" slot="item-icon"></iron-icon>
          [[localize('quit')]]
        </paper-icon-item>
        <paper-item class="border-top">
          <a href="https://www.google.com/policies/privacy/">[[localize('privacy')]]</a>
        </paper-item>
        <paper-item>
          <a href="https://s3.amazonaws.com/outline-vpn/index.html#/en/support/dataCollection">[[localize('data-collection')]]</a>
        </paper-item>
        <paper-item>
          <a href="https://s3.amazonaws.com/outline-vpn/static_downloads/Outline-Terms-of-Service.html">[[localize('terms')]]</a>
        </paper-item>
        <paper-item name="licenses">
          <span>[[localize('licenses-page-title')]]</span>
        </paper-item>
      </paper-listbox>
    </app-drawer>

    <paper-toast id="toast" class="fit-bottom" no-cancel-on-esc-key="">
      <paper-button id="toastButton" on-tap="_callToastHandler"></paper-button>
      <a hidden="" id="toastUrl" href="[[toastUrl]]"></a>
    </paper-toast>

    <add-server-view id="addServerView" localize="[[localize]]"></add-server-view>

    <!-- Modal dialogs must be placed outside of app-header-layout, see
    https://github.com/PolymerElements/paper-dialog/issues/152 and
    https://github.com/PolymerElements/app-layout/issues/295
    Once those are fixed we can consider moving this into server-card.html -->
    <server-rename-dialog id="serverRenameDialog" root-path="[[rootPath]]" localize="[[localize]]"></server-rename-dialog>
    `;
  }

  static get is() {
    return 'app-root';
  }

  static get properties() {
    return {
      DEFAULT_PAGE: {
        type: String,
        readonly: true,
        value: 'servers',
      },
      DEFAULT_LANGUAGE: {
        type: String,
        readonly: true,
        value: 'en',
      },
      LANGUAGES_AVAILABLE: {
        type: Object,
        readonly: true,
        value: {
          am: {id: 'am', name: 'አማርኛ', dir: 'ltr'},
          ar: {id: 'ar', name: 'العربية', dir: 'rtl'},
          bg: {id: 'bg', name: 'Български', dir: 'ltr'},
          ca: {id: 'ca', name: 'Català', dir: 'ltr'},
          cs: {id: 'cs', name: 'Česky', dir: 'ltr'},
          da: {id: 'da', name: 'Dansk', dir: 'ltr'},
          de: {id: 'de', name: 'Deutsch', dir: 'ltr'},
          el: {id: 'el', name: 'Ελληνικά', dir: 'ltr'},
          en: {id: 'en', name: 'English', dir: 'ltr'},
          'es-419': {id: 'es-419', name: 'Español', dir: 'ltr'},
          fa: {id: 'fa', name: 'فارسی', dir: 'rtl'},
          fi: {id: 'fi', name: 'Suomi', dir: 'ltr'},
          fil: {id: 'fil', name: 'Wikang Filipino', dir: 'ltr'},
          fr: {id: 'fr', name: 'Français', dir: 'ltr'},
          he: {id: 'he', name: 'עברית', dir: 'rtl'},
          hi: {id: 'hi', name: 'हिन्दी', dir: 'ltr'},
          hr: {id: 'hr', name: 'Hrvatski', dir: 'ltr'},
          hu: {id: 'hu', name: 'Magyar', dir: 'ltr'},
          id: {id: 'id', name: 'Bahasa Indonesia', dir: 'ltr'},
          it: {id: 'it', name: 'Italiano', dir: 'ltr'},
          ja: {id: 'ja', name: '日本語', dir: 'ltr'},
          kk: {id: 'kk', name: 'Қазақ тілі', dir: 'ltr'},
          km: {id: 'km', name: 'ភាសាខ្មែរ', dir: 'ltr'},
          ko: {id: 'ko', name: '한국어', dir: 'ltr'},
          lt: {id: 'lt', name: 'Lietuvių', dir: 'ltr'},
          lv: {id: 'lv', name: 'Latviešu', dir: 'ltr'},
          my: {id: 'my', name: 'မြန်မာစာ', dir: 'ltr'},
          nl: {id: 'nl', name: 'Nederlands', dir: 'ltr'},
          no: {id: 'no', name: 'Norsk (bokmål / riksmål)', dir: 'ltr'},
          pl: {id: 'pl', name: 'Polski', dir: 'ltr'},
          'pt-BR': {id: 'pt-BR', name: 'Português', dir: 'ltr'},
          ro: {id: 'ro', name: 'Română', dir: 'ltr'},
          ru: {id: 'ru', name: 'Русский', dir: 'ltr'},
          sk: {id: 'sk', name: 'Slovenčina', dir: 'ltr'},
          sl: {id: 'sl', name: 'Slovenščina', dir: 'ltr'},
          sr: {id: 'sr', name: 'Српски', dir: 'ltr'},
          'sr-Latn': {id: 'sr-Latn', name: 'Srpski', dir: 'ltr'},
          sv: {id: 'sv', name: 'Svenska', dir: 'ltr'},
          th: {id: 'th', name: 'ไทย', dir: 'ltr'},
          tr: {id: 'tr', name: 'Türkçe', dir: 'ltr'},
          uk: {id: 'uk', name: 'Українська', dir: 'ltr'},
          ur: {id: 'ur', name: 'اردو', dir: 'rtl'},
          vi: {id: 'vi', name: 'Việtnam', dir: 'ltr'},
          'zh-CN': {id: 'zh-CN', name: '简体中文', dir: 'ltr'},
          'zh-TW': {id: 'zh-TW', name: '繁體中文‬‬‪‬', dir: 'ltr'},
        },
      },
      language: {
        type: String,
        readonly: true,
        computed: '_computeLanguage(LANGUAGES_AVAILABLE, DEFAULT_LANGUAGE)',
      },
      useKeyIfMissing: {
        type: Boolean,
        value: true,
      },
      appVersion: {
        type: String,
        readonly: true,
      },
      page: {
        type: String,
        readonly: true,
        computed: '_computePage(routeData.page, DEFAULT_PAGE)',
      },
      route: Object,
      routeData: Object,
      pageTitleKey: {
        type: String,
        computed: '_computePageTitleKey(page)',
      },
      rootPath: String,
      shouldShowBackButton: {
        type: Boolean,
        computed: '_computeShouldShowBackButton(page, DEFAULT_PAGE)',
      },
      shouldShowAddButton: {
        type: Boolean,
        computed: '_computeShouldShowAddButton(page)',
      },
      servers: {
        type: Array,
      },
      // Tells AppLocalizeBehavior to bubble its
      // app-localize-resources-loaded event, allowing us listen for it on
      // document rather than the (potentially to-be-created) <app-root>
      // element.
      bubbleEvent: {
        type: Boolean,
        value: true,
      },
      platform: {
        type: String,
        readonly: true,
      },
      shouldShowQuitButton: {
        type: Boolean,
        computed: '_computeShouldShowQuitButton(platform)',
        value: false,
      },
      shouldShowAppLogo: {
        type: Boolean,
        computed: '_computeShouldShowAppLogo(page)',
      },
      toastUrl: {
        type: String,
      },
    };
  }

  ready() {
    super.ready();
    this.setLanguage(this.language);

    // Workaround for paper-behaviors' craptastic keyboard focus detection:
    // https://github.com/PolymerElements/paper-behaviors/issues/80
    // Monkeypatch the faulty Polymer.IronButtonStateImpl._detectKeyboardFocus implementation
    // with a no-op for the three buttons where the focus styles are incorrectly applied most
    // often / where it looks most noticeably broken.
    function noop() {}
    var buttons = [this.$.menuBtn, this.$.backBtn, this.$.addBtn];
    for (var i = 0, button = buttons[i]; button; button = buttons[++i]) {
      button._detectKeyboardFocus = noop;
    }

    if (!Event.prototype.composedPath) {
      // Polyfill for composedPath. See https://dom.spec.whatwg.org/#dom-event-composedpath.
      // https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath#browser_compatibility
      Event.prototype.composedPath = function() {
        if (this.path) {
          return this.path;  // ShadowDOM v0 equivalent property.
        }
        var composedPath = [];
        var target = this.target;
        while (target) {
          composedPath.push(target);
          if (target.assignedSlot) {
            target = target.assignedSlot;
          } else if (target.nodeType === Node.DOCUMENT_FRAGMENT_NODE && target.host) {
            target = target.host;
          } else {
            target = target.parentNode;
          }
        }
        if (composedPath[composedPath.length - 1] === document) {
          composedPath.push(window);
        }
        return composedPath;
      };
    }

    if (window.hasOwnProperty('cordova')) {
      // Wait until Cordova is ready to access the device plugin. This listener will execute
      // synchronously if the 'deviceready' event has already fired.
      document.addEventListener('deviceready', function() {
        this.platform = device.platform;
      }.bind(this));
    } else {
      // If cordova is not defined, we're running in Electron.
      this.platform = 'Electron';
    }
  }

  setLanguage(languageCode) {
    const url = `${this.rootPath}messages/${languageCode}.json`;
    this.loadResources(url, languageCode);

    const direction = this.LANGUAGES_AVAILABLE[languageCode].dir;
    document.documentElement.setAttribute('dir', direction);
    this.$.drawer.align = direction == 'ltr' ? 'left' : 'right';

    this.language = languageCode;
  }

  openDrawer() {
    this.$.drawer.style.opacity = '1';
    this.$.drawer.open();
  }

  closeDrawer() {
    this.$.drawer.close();
  }

  showToast(text, duration, buttonText, buttonHandler, buttonUrl) {
    // If the toast is already open, first close it. We then always wait a
    // little before calling open in a this.async call. This ensures that:
    // 1. we are compliant with the material design spec
    //    (https://material.io/guidelines/components/snackbars-toasts.html
    //    "When a second snackbar is triggered while the first is displayed,
    //    the first should start the contraction motion downwards before the
    //    second one animates upwards")
    // 2. the requested toast is displayed for the full requested duration
    // 3. any still-visible virtual keyboard is hidden before showing the
    //    requested toast, otherwise it'd get positioned above the keyboard
    //    and stay there after the keyboard goes away.
    if (this.$.toast.opened) {
      this.$.toast.close();
    }
    this.async(function() {
      this.$.toast.text = text;
      this.$.toast.duration = duration || 3000;

      var button = this.$.toastButton;
      if (buttonText) {
        button.hidden = false;
        button.innerText = buttonText;

        // Button has either a handler or invokes a URL.
        if (buttonHandler) {
          button._handler = buttonHandler;
        } else {
          this.toastUrl = buttonUrl;
          button._handler = function() {
            this.$.toastUrl.click();
          }.bind(this);
        }
      } else {
        button.hidden = true;
      }
      this.$.toast.open();
    }, 350);
  }

  changePage(page) {
    if (this.page === page) {
      console.debug('already on page', page);
      return;
    }
    this.set('route.path', '/' + page);
  }

  _callToastHandler() {
    var toastButton = this.$.toastButton;
    var handler = toastButton._handler;
    if (!handler) return console.error('No toast handler found');
    // Close the toast and unbind the handler so there's no chance the
    // user can somehow trigger the same handler twice.
    this.$.toast.close();
    delete toastButton._handler;
    handler();
  }

  promptAddServer() {
    this.$.addServerView.openAddServerSheet();
  }

  _computeLanguage(availableLanguages, defaultLanguage) {
    const overrideLanguage = window.localStorage.getItem('overrideLanguage');
    const bestMatchingLanguage =
        OutlineI18n.getBestMatchingLanguage(Object.keys(availableLanguages));
    return overrideLanguage || bestMatchingLanguage || defaultLanguage;
  }

  _computePage(pageFromRoute, DEFAULT_PAGE) {
    if (this.page && pageFromRoute === this.page) {
      return this.page;
    } else if (pageFromRoute === 'help') {
      this._openHelpPage();  // Fall-through to navigate to the default page.
    } else if (pageFromRoute === 'quit') {
      this.fire('QuitPressed');
    } else if (pageFromRoute) {
      return pageFromRoute;
    }
    // No page found in the route (i.e. the url hash) means we are just starting up.
    // Set the route's page to the default page, and update the url hash to match.
    // Use history.replaceState to do this, otherwise Polymer will push a navigation
    // to the default page onto the history stack. Without this, you'd have to press
    // Android's system back button twice instead of once to get out of the app after
    // opening it.
    history.replaceState({}, '', '#/' + DEFAULT_PAGE);
    this.setProperties({
      'route.path': '/' + DEFAULT_PAGE,
      'routeData.page': DEFAULT_PAGE,
    });
    return DEFAULT_PAGE;
  }

  _computePageTitleKey(page) {
    return page + '-page-title';
  }

  _computeShouldShowBackButton(page, DEFAULT_PAGE) {
    return page !== DEFAULT_PAGE;
  }

  _computeShouldShowAddButton(page) {
    // Only show the add button if we're on the servers page.
    return page === 'servers';
  }

  _goBack() {
    // If there is a navigation on the webview's history stack, pop it off to go back.
    if (history.length > 1) {
      history.back();
      // Must fire 'location-changed' so app-location notices and updates the route state.
      window.dispatchEvent(new CustomEvent('location-changed'));
    }
  }

  _showDefaultPage() {
    this.changePage(this.DEFAULT_PAGE);
  }

  _openHelpPage() {
    // Anchor tags compete with the app-drawer for click events on iOS. This results in links
    // not opening most of the time. We resort to opening the link programmatically for all
    // platforms.
    if (this.platform === 'iOS') {
      window.open(this.$.helpAnchor.href);
    } else {
      // macOS does not respond to window.open and Windows opens a new browser window.
      // Simulate a click on the help anchor.
      this.$.helpAnchor.click();
    }
  }

  _computeShouldShowQuitButton(platform) {
    return platform === 'macOS' || platform === 'Electron';
  }

  _computeIsLastVisibleMenuItem(shouldShowQuitButton) {
    return shouldShowQuitButton ? '' : 'last-menu-item';
  }

  showServerRename(event) {
    this.$.serverRenameDialog.open(event.detail.serverName, event.detail.serverId);
  }

  _computeShouldShowAppLogo(page) {
    return page === 'servers';
  }

  _getLanguagesAvailableValues(languagesAvailable) {
    return Object.values(languagesAvailable).sort((a, b) => {
      return a.name > b.name ? 1 : -1;
    });
  }
}
customElements.define(AppRoot.is, AppRoot);