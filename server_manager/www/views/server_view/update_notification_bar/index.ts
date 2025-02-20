/**
 * Copyright 2025 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {LitElement, html, css, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import '@material/mwc-icon';

@customElement('update-notification-bar')
export class UpdateNotificationBar extends LitElement {
  @property({type: Object}) localize: (messageId: string) => string;
  @property({type: String}) link: string;
  @property({type: String}) icon = 'info';

  static styles = css`
    :host {
      --update-notification-bar-max-width: 1920px;
      --update-notification-bar-background: hsla(42, 100%, 71%, 1);
      --update-notification-bar-text-color: hsla(0, 0%, 0%, 1);
      --update-notification-bar-padding: 1rem;
      --update-notification-bar-gap: 1rem;
      --update-notification-bar-content-icon-size: 1.5rem;
      --update-notification-bar-content-gap: 1rem;
      --update-notification-bar-link-icon-size: 1rem;
      --update-notification-bar-link-gap: 0.25rem;
      --update-notification-bar-font-family: 'Roboto', system-ui;

      background-color: var(--update-notification-bar-background);
      box-sizing: border-box;
      color: var(--update-notification-bar-text-color);
      display: flex;
      font-family: var(--update-notification-bar-font-family);
      padding: var(--update-notification-bar-padding);
      width: 100%;
    }

    aside {
      align-items: center;
      display: inline-flex;
      gap: var(--update-notification-bar-gap);
      justify-content: space-between;
      margin: 0 auto;
      max-width: var(--update-notification-bar-max-width);
      width: 100%;
    }

    .content {
      align-items: center;
      display: flex;
      gap: var(--update-notification-bar-content-gap);
    }

    mwc-icon {
      flex-shrink: 0;
    }

    .content > mwc-icon {
      --mdc-icon-size: var(--update-notification-bar-content-icon-size);
    }

    .message {
      flex-grow: 1;
      margin-right: var(--update-notification-bar-gap);
    }

    a {
      align-items: center;
      color: var(--update-notification-bar-text-color);
      cursor: pointer;
      display: inline-flex;
      gap: var(--update-notification-bar-link-gap);
      font-weight: bold;
      text-decoration: none;
      white-space: nowrap;
    }

    a > span {
      text-decoration: underline;
    }

    a > mwc-icon {
      --mdc-icon-size: var(--update-notification-bar-link-icon-size);
    }

    /* TODO(#2384): replace with a container query once we upgrade electron */
    @media (max-width: 900px) {
      aside {
        flex-direction: column;
      }
      .message {
        margin-right: 0;
      }
    }
  `;

  render() {
    return html`
      <aside>
        <div class="content">
          <mwc-icon>${this.icon}</mwc-icon>
          <span class="message"
            >${this.localize(
              'server-view-update-notification-bar-message'
            )}</span
          >
        </div>
        ${this.link
          ? html`<a href="${this.link}" target="_blank"
              ><span
                >${this.localize(
                  'server-view-update-notification-bar-link'
                )}</span
              >
              <mwc-icon>open_in_new</mwc-icon></a
            >`
          : nothing}
      </aside>
    `;
  }
}
