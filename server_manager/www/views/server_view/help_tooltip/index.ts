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

import '@material/mwc-icon';

// TODO: this tooltip is implemented by javascript and not css due to api limitations in our current version of Electron.
// Once electron is updated, we should switch to the Popover API for better style control.
@customElement('help-tooltip')
export class HelpTooltip extends LitElement {
  @property({type: String}) text: string;

  @state() tooltip: HTMLElement | null = null;
  @query('mwc-icon') icon: HTMLElement;

  static styles = css`
    :host {
      --help-tooltip-icon-size: 1.85rem;

      cursor: help;
      position: relative;
      display: inline-flex;
    }

    mwc-icon {
      --mdc-icon-size: var(--help-tooltip-icon-size);
    }
  `;

  render() {
    return html`
      <mwc-icon
        @mouseenter=${this.insertTooltip}
        @mouseout=${this.removeTooltip}
        >help</mwc-icon
      >
    `;
  }

  insertTooltip() {
    this.tooltip = document.createElement('span');
    this.tooltip.innerHTML = this.text;
    this.tooltip.style.cssText = `
      display: inline-block;
      background-color: hsl(0, 0%, 94%);
      border-radius: 0.3rem;
      color: hsl(0, 0%, 20%);
      font-family: 'Inter', system-ui;
      max-width: 320px;
      left: ${this.icon.getBoundingClientRect().left}px;
      top: ${this.icon.getBoundingClientRect().bottom}px;
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
