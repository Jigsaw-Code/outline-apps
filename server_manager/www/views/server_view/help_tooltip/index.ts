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
import {customElement} from 'lit/decorators.js';

import '@material/mwc-icon';

// TODO: this tooltip is naive - we should switch to the Popover API once we upgrade Electron
@customElement('help-tooltip')
export class HelpTooltip extends LitElement {
  static styles = css`
    :host {
      --help-tooltip-background: hsl(0, 0%, 94%);
      --help-tooltip-border-radius: 0.3rem;
      --help-tooltip-padding: 0.3rem;
      --help-tooltip-text-color: hsl(0, 0%, 20%);
      --help-tooltip-max-width: 320px;
      --help-tooltip-icon-size: 1.85rem;

      --mdc-icon-size: var(--help-tooltip-icon-size);

      cursor: help;
      position: relative;
      display: inline-flex;
    }

    .tooltip {
      background-color: var(--help-tooltip-background);
      border-radius: var(--help-tooltip-border-radius);
      color: var(--help-tooltip-text-color);
      font-family: var(--info-font-family);
      left: 50%;
      max-width: var(--help-tooltip-max-width);
      padding: var(--help-tooltip-padding);
      position: absolute;
      top: 150%;
      transform: translateX(-50%);
      visibility: hidden;
      white-space: pre-line;
      width: max-content;
      word-wrap: break-word;
    }

    :host(:hover) .tooltip {
      visibility: visible;
      opacity: 1;
    }
  `;

  render() {
    return html`
      <mwc-icon>help</mwc-icon>
      <span class="tooltip"><slot></slot></span>
    `;
  }
}
