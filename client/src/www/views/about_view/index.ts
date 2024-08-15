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

import {msg} from '@lit/localize';
import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import brandLogo from '../../assets/brand-logo.png';
import jigsawLogo from '../../assets/jigsaw-logo.png';

@customElement('about-view')
export class AboutView extends LitElement {
  @property({type: String}) version!: string;
  @property({type: String}) build!: string;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      width: 100%;
      height: 100%;
    }

    article {
      height: 100%;
      padding: 32px 24px 0 24px;
    }

    header .logo {
      width: 76px;
    }

    section {
      font-family: var(--outline-font-family);
    }

    section.version {
      color: var(--outline-medium-gray);
      font-size: 12px;
      margin: 8px auto;
    }

    section.description {
      color: var(--outline-off-black);
      text-align: left;
      font-size: 16px;
      line-height: 22px;
      margin: 32px auto;
    }

    a {
      color: var(--outline-primary);
      text-decoration: none;
    }

    footer {
      margin: 48px 0 36px 0;
      text-align: center;
    }

    footer .logo {
      width: 96px;
    }
  `;

  render() {
    return html`
      <article>
        <header>
          <img src="${brandLogo}" class="logo" alt="outline logo" />
        </header>
        <section class="version">
          ${msg(html`Version ${this.version} (${this.build})`)}
        </div>
        <section class="description">
          ${msg(
            html`Outline is a product by
              <a href="https://jigsaw.google.com">Jigsaw</a> that lets anyone
              create, run, and share access to their own VPN. Outline is
              designed to be resistant to blocking. Visit
              <a href="https://getoutline.org">getoutline.org</a> to learn how
              to get started.<br /><br />Outline is open source software powered
              by <a href="https://shadowsocks.org">Shadowsocks</a>. You can
              contribute to the code on
              <a href="https://github.com/jigsaw-Code/?q=outline">GitHub</a> and
              join the conversation on
              <a href="https://www.reddit.com/r/outlinevpn">Reddit</a>.`
          )}
        </div>
        <footer>
          <a href="https://jigsaw.google.com">
            <img src="${jigsawLogo}" class="logo" alt="jigsaw logo" />
          </a>
        </footer>
      </article>
    `;
  }
}
