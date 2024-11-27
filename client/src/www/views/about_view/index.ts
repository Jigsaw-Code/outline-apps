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

import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import outlineLogo from '../../assets/brand-logo.png';
import jigsawLogo from '../../assets/jigsaw-logo.png';

@customElement('about-view')
export class AboutView extends LitElement {
  @property({type: Function}) localize!: (
    key: string,
    ...args: string[]
  ) => string;
  @property({type: String}) version!: string;
  @property({type: String}) build!: string;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      font-family: var(--outline-font-family);
      height: 100%;
      justify-content: space-between;
      margin: 0 auto;
      max-width: 600px;
      text-align: center;
      width: 100%;
    }

    article {
      height: 100%;
      padding: 32px 24px 0 24px;
    }

    header img {
      width: 76px;
    }

    header h2 {
      color: var(--outline-medium-gray);
      font-size: 12px;
      margin: 8px auto;
    }

    section {
      color: var(--outline-off-black);
      font-size: 16px;
      line-height: 22px;
      margin: 32px auto;
      text-align: left;
    }

    a {
      color: var(--outline-primary);
      text-decoration: none;
    }

    footer {
      margin: 48px 0 36px 0;
      text-align: center;
    }

    footer img {
      width: 120px;
    }
  `;

  render() {
    return html`
      <article>
        <header>
          <img src="${outlineLogo}" alt="outline logo" />
          <h2>
            ${this.localize('version', 'appVersion', this.version)}
            (${this.build})
          </h2>
        </header>
        <section
          .innerHTML=${this.localize(
            'about-outline',
            'jigsawUrl',
            'https://jigsaw.google.com',
            'outlineUrl',
            'https://getoutline.org',
            'shadowsocksUrl',
            'https://shadowsocks.org',
            'gitHubUrl',
            'https://github.com/jigsaw-Code/?q=outline',
            'redditUrl',
            'https://www.reddit.com/r/outlinevpn'
          )}
        ></section>
        <footer>
          <a href="https://jigsaw.google.com">
            <img src="${jigsawLogo}" alt="jigsaw logo" />
          </a>
        </footer>
      </article>
    `;
  }
}
