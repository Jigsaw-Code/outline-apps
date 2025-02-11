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

import {LitElement, css, html} from 'lit';
import {customElement, state, query, property} from 'lit/decorators.js';

import '@material/mwc-icon-button';

// TODO: this tooltip is implemented by javascript and not css due to api limitations in our current version of Electron.
// Once electron is updated, we should switch to the Popover API for better style control.
@customElement('icon-tooltip')
export class IconTooltip extends LitElement {
  @property({type: String}) text: string;
  @property({type: String}) icon: string = 'help';

  @state() tooltip: HTMLElement | null = null;
  @query('mwc-icon-button') iconElement: HTMLElement;

  static styles = css`
    :host {
      --icon-tooltip-icon-size: 1.85rem;
      --icon-tooltip-icon-color: hsla(140, 3%, 77%, 1);

      color: var(--icon-tooltip-icon-color);
    }

    mwc-icon-button {
      --mdc-icon-size: var(--help-tooltip-icon-size);
    }
  `;

  render() {
    return html`
      <mwc-icon-button
        @click=${this.insertTooltip}
        @blur=${this.removeTooltip}
        icon=${this.icon}
      >
      </mwc-icon-button>
    `;
  }

  insertTooltip() {
    if (!this.text) {
      return;
    }

    this.tooltip = document.createElement('span');
    this.tooltip.innerHTML = this.text;
    this.tooltip.style.cssText = `
      display: inline-block;
      background-color: hsl(0, 0%, 94%);
      border-radius: 0.3rem;
      color: hsl(0, 0%, 20%);
      font-family: 'Inter', system-ui;
      max-width: 320px;
      left: ${this.iconElement.getBoundingClientRect().left}px;
      top: ${this.iconElement.getBoundingClientRect().bottom}px;
      padding: 0.3rem;
      position: fixed;
      white-space: pre-line;
      width: max-content;
      word-wrap: break-word;
      z-index: 1000;
    `;

    document.body.appendChild(this.tooltip);
  }

  removeTooltip() {
    this.tooltip?.remove();
    this.tooltip = null;
  }
}
