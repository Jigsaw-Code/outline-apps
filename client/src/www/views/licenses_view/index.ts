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
import {customElement, state} from 'lit/decorators.js';

@customElement('licenses-view')
export class LicensesView extends LitElement {
  @state() private licensesText: string = '';
  @state() private licensesLoaded: boolean = false;

  static styles = css`
    :host {
      height: 100%;
      overflow-x: hidden;
      overflow-y: scroll;
      padding: 12px;
      width: 100%;
    }

    code {
      font-size: 0.7em;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    globalThis.addEventListener('location-changed', this.handleLocationChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    globalThis.removeEventListener(
      'location-changed',
      this.handleLocationChange
    );
  }

  render() {
    return html`<code>${this.licensesText}</code>`;
  }

  private handleLocationChange = async () => {
    if (
      this.licensesLoaded ||
      // TODO(daniellacosse): the polymer app root modifies the global object. this is bad.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).appRoot.page !== 'licenses'
    ) {
      return;
    }

    try {
      const response = await fetch('ui_components/licenses/licenses.txt');
      const responseText = await response.text();

      this.licensesText = responseText;
      this.licensesLoaded = true;
    } catch (error) {
      console.error('Could not load license.txt', error);
    }
  };
}
