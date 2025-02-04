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
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

import '../info_tooltip';
import '@material/mwc-icon';

import './server_metrics_row_subcard';
import type {ServerMetricsRowSubcard} from './server_metrics_row_subcard';

@customElement('server-metrics-row')
export class ServerMetricsRow extends LitElement {
  @property({type: Array}) subcards?: Array<Partial<ServerMetricsRowSubcard>>;
  @property({type: String}) subtitle?: string;
  @property({type: String}) title: string;
  @property({type: String}) titleIcon?: string;
  @property({type: String}) tooltip?: string;
  @property({type: String}) value: string;
  @property({type: String}) valueLabel?: string;

  static styles = css`
    :host {
      --server-metrics-row-background: hsl(200, 15%, 18%);
      --server-metrics-row-font-family: 'Inter', system-ui;
      --server-metrics-row-icon-size: 1.85rem;
      --server-metrics-row-padding: 1.25rem 2rem;
      --server-metrics-row-text-color: hsla(0, 0%, 100%, 0.8);

      --server-metrics-row-title-color: hsla(0, 0%, 100%, 0.7);
      --server-metrics-row-value-container-margin-top: 1rem;
      --server-metrics-row-title-container-gap: 0.35rem;
      --server-metrics-row-title-font-size: 1.3rem;

      --server-metrics-row-value-font-size: 3rem;
      --server-metrics-row-value-font-family: 'Roboto', system-ui;
      --server-metrics-row-value-label-font-size: 1.1rem;
      --server-metrics-row-value-label-margin-left: 0.25rem;

      --server-metrics-row-footer-top-border: 1px solid hsla(0, 0%, 100%, 0.35);

      --server-metrics-row-subtitle-font-size: 1rem;
      --server-metrics-row-subtitle-margin-bottom: 1rem;

      --server-metrics-row-subcards-gap: 0.75rem;
      --server-metrics-row-subcards-min-width: 320px;
    }

    section {
      background-color: var(--server-metrics-row-background);
      box-sizing: border-box;
      color: var(--server-metrics-row-text-color);
      display: block;
      font-family: 'iRoboto', system-u;
      width: 100%;
    }

    .title-and-value-container {
      padding: var(--server-metrics-row-padding);
    }

    .title-container {
      display: flex;
      align-items: center;
      gap: var(--server-metrics-row-title-container-gap);
    }

    .title {
      all: initial;
      display: inline-block;
      font-family: var(--server-metrics-row-font-family);
      font-weight: 400;
      font-size: var(--server-metrics-row-title-font-size);
      color: var(--server-metrics-row-title-color);
    }

    mwc-icon {
      font-size: var(--server-metrics-row-icon-size);
    }

    .value-container {
      margin-top: var(--server-metrics-row-value-container-margin-top);
    }

    .value {
      font-family: var(--server-metrics-row-value-font-family);
      font-size: var(--server-metrics-row-value-font-size);
    }

    .value-label {
      color: var(--server-metrics-row-title-color);
      font-family: var(--server-metrics-row-font-family);
      font-size: var(--server-metrics-row-value-label-font-size);
      margin-left: var(--server-metrics-row-value-label-margin-left);
    }

    aside {
      border-top: var(--server-metrics-row-footer-top-border);
      padding: var(--server-metrics-row-padding);
    }

    .subtitle {
      all: initial;
      color: var(--server-metrics-row-title-color);
      display: inline-block;
      font-family: var(--server-metrics-row-font-family);
      font-size: var(--server-metrics-row-subtitle-font-size);
      margin-bottom: var(--server-metrics-row-subtitle-margin-bottom);
    }

    .subcards-container {
      display: grid;
      gap: var(--server-metrics-row-subcards-gap);
      grid-template-columns: repeat(
        auto-fit,
        minmax(var(--server-metrics-row-subcards-min-width), 1fr)
      );
    }
  `;

  render() {
    return html`
      <section>
        <div class="title-and-value-container">
          <div class="title-container">
            ${this.titleIcon
              ? html`<mwc-icon>${this.titleIcon}</mwc-icon>`
              : nothing}
            <h2 class="title">${unsafeHTML(this.title)}</h2>
            ${this.tooltip
              ? html`<info-tooltip text=${this.tooltip}></info-tooltip>`
              : nothing}
          </div>
          <div class="value-container">
            <span class="value">${this.value}</span>
            <span class="value-label">${this.valueLabel}</span>
          </div>
        </div>

        ${this.subcards && this.subcards.length
          ? html`
              <aside>
                ${this.subtitle
                  ? html`<h3 class="subtitle">${unsafeHTML(this.subtitle)}</h3>`
                  : nothing}

                <div class="subcards-container">
                  ${this.subcards.map(
                    ({highlight, title, subtitle, icon}) => html`
                      <server-metrics-row-subcard
                        highlight="${highlight}"
                        title="${title}"
                        subtitle="${subtitle}"
                        icon="${icon}"
                      ></server-metrics-row-subcard>
                    `
                  )}
                </div>
              </aside>
            `
          : nothing}
      </section>
    `;
  }
}
