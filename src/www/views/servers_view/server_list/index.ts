/*
  Copyright 2021 The Outline Authors
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

import '../server_list_item/server_card';
import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('server-list')
export class ServerList extends LitElement {
  @property() localize: (messageID: string) => string;
  @property() serverItems: ServerListItem[];
  @property() itemTemplate: (server: ServerListItem, localize: (messageID: string) => string) => LitElement;

  static styles = css`
    ul,
    li {
      all: initial;
    }

    :host {
      display: block;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
    }
  `;

  render() {
    return html`
      <ul>
        ${this.serverItems.map(
          server =>
            html`
              <li>${this.itemTemplate(server, this.localize)}</li>
            `
        )}
      </ul>
    `;
  }
}
