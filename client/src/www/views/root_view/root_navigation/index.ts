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

import {Localizer} from '@outline/infrastructure/i18n';
import {LitElement, html, css, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';

import navigationLogo from '../../../assets/logo-nav.png';

@customElement('root-navigation')
export class RootNavigation extends LitElement {
  @property({type: Function}) localize: Localizer = msg => msg;

  @property({type: Boolean}) open: boolean;
  @property({type: Boolean}) showQuit: boolean;
  @property({type: String}) align: 'left' | 'right';
  @property({type: String}) dataCollectionPageUrl: string;

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
      position: absolute;
      transition:
        transform 0.3s ease,
        visibility 0.3s ease;
      width: 250px;
      will-change: transform;
      visibility: hidden;
    }

    nav.left {
      left: 0;
      transform: translateX(-100%);
    }

    nav.right {
      right: 0;
      transform: translateX(100%);
    }

    .open nav {
      transform: translateX(0);
      visibility: visible;
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

    md-list-item > a {
      color: inherit;
      display: block;
      height: 100%;
      text-decoration: none;
      width: 100%;
    }

    .selected {
      --md-list-item-label-text-color: var(--outline-primary);
    }

    .selected md-icon {
      color: var(--outline-primary);
    }

    ul {
      border-top: 1px solid var(--outline-light-gray);
      display: block;
      list-style-type: none;
      margin-bottom: 124px;
      margin: 0;
      padding: 0;
    }

    li {
      color: var(--outline-medium-gray);
      cursor: pointer;
      display: block;
      font-family: var(--outline-font-family);
      padding: 8px 16px;
      transition: visibility 0.3s ease;
    }

    li > a {
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
      <div class="backdrop" @click=${this.close}></div>
      <nav
        class=${classMap({
          left: this.align === 'left',
          right: this.align === 'right',
        })}
      >
        <header>
          <img src="${navigationLogo}" alt="Outline navigation logo" />
        </header>
        <md-list>
          <!-- 
            current behavior is such that you can't actually see 
            the navbar unless you're on the servers page - no need for selection logic
          -->
          <md-list-item
            class="selected"
            @click=${() => this.changePage('home')}
          >
            <md-ripple></md-ripple>
            <md-icon slot="start">home</md-icon>
            ${this.localize('servers-menu-item')}
          </md-list-item>
          <md-list-item @click=${() => this.changePage('contact')}>
            <md-ripple></md-ripple>
            <md-icon slot="start">feedback</md-icon>
            ${this.localize('contact-page-title')}
          </md-list-item>
          <md-list-item @click=${() => this.changePage('about')}>
            <md-ripple></md-ripple>
            <md-icon slot="start">info</md-icon>
            ${this.localize('about-page-title')}
          </md-list-item>
          <md-list-item>
            <md-ripple></md-ripple>
            <md-icon slot="start">help</md-icon>
            <a href="https://support.getoutline.org">
              ${this.localize('help-page-title')}
            </a>
          </md-list-item>
          <md-list-item @click=${() => this.changePage('language')}>
            <md-ripple></md-ripple>
            <md-icon slot="start">language</md-icon>
            ${this.localize('change-language-page-title')}
          </md-list-item>
          ${this.showQuit
            ? html`<md-list-item @click=${this.quit}>
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
            <a href="${this.dataCollectionPageUrl}">
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
          <li @click=${() => this.changePage('licenses')}>
            ${this.localize('licenses-page-title')}
          </li>
        </ul>
      </nav>
    </div>`;
  }

  private close() {
    this.dispatchEvent(
      new CustomEvent('HideNavigation', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private changePage(page: string) {
    this.dispatchEvent(
      new CustomEvent('ChangePage', {
        detail: {page},
        bubbles: true,
        composed: true,
      })
    );
  }

  private quit() {
    this.dispatchEvent(
      new CustomEvent('QuitPressed', {
        bubbles: true,
        composed: true,
      })
    );
  }
}
