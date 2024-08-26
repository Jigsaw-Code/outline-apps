/*
  Copyright 2024 The Outline Authors
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

import {LitElement, html, css, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';

import navigationLogo from '../../../assets/logo-nav.png';

@customElement('root-navigation')
export class RootNavigation extends LitElement {
  @property({type: Function}) localize!: (
    key: string,
    ...args: string[]
  ) => string;

  @property({type: Boolean}) open: boolean;
  @property({type: Boolean}) showQuit: boolean;

  static styles = css`
    :host {
      --md-list-container-color: var(--outline-white);
    }

    .container {
      height: 100vh;
      left: 0;
      pointer-events: none;
      position: fixed;
      top: 0;
      width: 100vw;
    }

    .open.container {
      pointer-events: auto;
    }

    nav {
      background-color: var(--outline-white);
      display: block;
      height: 100vh;
      overflow-y: scroll;
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      width: 250px;
      will-change: transform;
    }

    .open nav {
      transform: translateX(0);
    }

    header {
      background-color: var(--outline-dark-primary);
      position: sticky;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 124px;
      z-index: 1;
    }

    header img {
      width: 76px;
    }

    md-list-item {
      cursor: pointer;
    }

    ul {
      all: initial;
      border-top: 1px solid var(--outline-light-gray);
      display: block;
      margin-bottom: 124px;
    }

    li {
      all: initial;
      color: var(--outline-medium-gray);
      display: block;
      font-family: var(--outline-font-family);
      padding: 8px 16px;
    }

    a {
      text-decoration: none;
      color: var(--outline-medium-gray);
    }

    .backdrop {
      background-color: var(--outline-elevation-color);
      height: 100%;
      left: 0;
      opacity: 0;
      pointer-events: none;
      position: absolute;
      top: 0;
      transition: opacity 0.3s ease;
      width: 100%;
    }

    .open .backdrop {
      opacity: 1;
      pointer-events: auto;
    }
  `;

  render() {
    return html`<div
      class="${classMap({
        container: true,
        open: this.open,
      })}"
    >
      <div class="backdrop" @click=${this.handleClose}></div>
      <nav>
        <header>
          <img src="${navigationLogo}" alt="Outline navigation logo" />
        </header>
        <md-list>
          <md-list-item @click=${() => this.handlePageChange('servers')}>
            <md-ripple></md-ripple>
            <md-icon slot="start">home</md-icon>
            ${this.localize('servers-menu-item')}
          </md-list-item>
          <md-list-item @click=${() => this.handlePageChange('contact')}>
            <md-ripple></md-ripple>
            <md-icon slot="start">perm_phone_msg</md-icon>
            ${this.localize('contact-page-title')}
          </md-list-item>
          <md-list-item @click=${() => this.handlePageChange('about')}>
            <md-ripple></md-ripple>
            <md-icon slot="start">info</md-icon>
            ${this.localize('about-page-title')}
          </md-list-item>
          <md-list-item
            @click=${() => window.open('https://support.getoutline.org')}
          >
            <md-ripple></md-ripple>
            <md-icon slot="start">help</md-icon>
            ${this.localize('help-page-title')}
          </md-list-item>
          <md-list-item @click=${() => this.handlePageChange('language')}>
            <md-ripple></md-ripple>
            <md-icon slot="start">language</md-icon>
            ${this.localize('change-language-page-title')}
          </md-list-item>
          ${this.showQuit
            ? html`<md-list-item>
                <md-ripple></md-ripple>
                <md-icon slot="start">exit_to_app</md-icon>
                ${this.localize('quit')}
              </md-list-item>`
            : nothing}
        </md-list>
        <ul>
          <li>
            <a href="https://www.google.com/policies/privacy/">
              ${this.localize('privacy')}
            </a>
          </li>
          <li>
            <a href="https://support.getoutline.org/s/article/Data-collection">
              ${this.localize('data-collection')}
            </a>
          </li>
          <li>
            <a
              href="https://s3.amazonaws.com/outline-vpn/static_downloads/Outline-Terms-of-Service.html"
            >
              ${this.localize('terms')}
            </a>
          </li>
          <li @click=${() => this.handlePageChange('licenses')}>
            ${this.localize('licenses-page-title')}
          </li>
        </ul>
      </nav>
    </div>`;
  }

  private handleClose() {
    this.dispatchEvent(
      new CustomEvent('HideNavigation', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handlePageChange(page: string) {
    this.dispatchEvent(
      new CustomEvent('ChangePage', {
        detail: {page},
        bubbles: true,
        composed: true,
      })
    );
  }
}
