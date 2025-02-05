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
import {customElement, property} from 'lit/decorators.js';

import '@material/mwc-icon';

// TODO: this tooltip is naive - we should switch to the Popover API once we upgrade Electron
@customElement('info-tooltip')
export class InformationTooltip extends LitElement {
  @property({type: String}) text: string;

  static styles = css`
    :host {
      --server-metrics-row-tooltip-background: hsl(0, 0%, 94%);
      --server-metrics-row-tooltip-border-radius: 0.3rem;
      --server-metrics-row-tooltip-padding: 0.3rem;
      --server-metrics-row-tooltip-text-color: hsl(0, 0%, 20%);
      --server-metrics-row-tooltip-max-width: 320px;

      --info-tooltip-icon-size: 1.85rem;

      --mdc-icon-size: var(--info-tooltip-icon-size);

      cursor: help;
      position: relative;
      display: inline-flex;
    }

    .tooltip {
      background-color: var(--server-metrics-row-tooltip-background);
      border-radius: var(--server-metrics-row-tooltip-border-radius);
      color: var(--server-metrics-row-tooltip-text-color);
      font-family: var(--server-metrics-row-font-family);
      left: 50%;
      max-width: var(--server-metrics-row-tooltip-max-width);
      padding: var(--server-metrics-row-tooltip-padding);
      position: absolute;
      top: 150%;
      transform: translateX(-50%);
      visibility: hidden;
      white-space: pre-line;
      width: max-content;
      word-wrap: break-word;
    }

    :host:hover .tooltip {
      visibility: visible;
      opacity: 1;
    }
  `;

  render() {
    return html`
      <mwc-icon>info</mwc-icon>
      <span class="tooltip">${this.text}</span>
    `;
  }
}
