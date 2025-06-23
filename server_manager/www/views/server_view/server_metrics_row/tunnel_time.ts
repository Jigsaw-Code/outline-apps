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

import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {unsafeHTML} from 'lit/directives/unsafe-html.js';

import type {ServerMetricsData} from './index';
import '../icon_tooltip';
import './index';
import '@material/mwc-icon';

const SECONDS_IN_HOUR = 60 * 60;

export interface ServerMetricsTunnelTimeLocation {
  seconds: number;
  asn: string;
  asOrg?: string;
  countryFlag: string;
}

@customElement('server-metrics-tunnel-time-row')
export class ServerMetricsTunnelTimeRow extends LitElement {
  @property({type: String}) language: string = 'en';
  @property({type: Object}) localize: (...keys: string[]) => string;
  @property({type: Object}) metrics: ServerMetricsData;
  @property({type: Array})
  locations: Array<ServerMetricsTunnelTimeLocation>;

  static styles = css`
    :host {
      --server-metrics-tunnel-time-row-icon-size: 1rem;
      --server-metrics-tunnel-time-row-icon-button-size: 1.3rem;

      --server-metrics-tunnel-time-row-font-family: 'Inter', system-ui;
      --server-metrics-tunnel-time-row-title-color: hsla(0, 0%, 100%, 0.7);
      --server-metrics-tunnel-time-row-title-container-gap: 0.25rem;
      --server-metrics-tunnel-time-row-title-font-size: 1rem;
      --server-metrics-tunnel-time-row-padding: 0.9rem 1.3rem;

      --server-metrics-tunnel-time-row-value-container-margin-top: 0.75rem;

      --server-metrics-tunnel-time-row-value-font-size: 2.25rem;
      --server-metrics-tunnel-time-row-value-font-family: 'Roboto', system-ui;
      --server-metrics-tunnel-time-row-value-label-font-size: 0.825rem;
      --server-metrics-tunnel-time-row-value-label-margin-left: 0.2rem;
    }

    .main-container {
      padding: var(--server-metrics-tunnel-time-row-padding);
    }

    .title-container {
      display: flex;
      align-items: center;
      gap: var(--server-metrics-tunnel-time-row-title-container-gap);
    }

    .title {
      all: initial;
      display: inline-block;
      font-family: var(--server-metrics-tunnel-time-row-font-family);
      font-weight: 400;
      font-size: var(--server-metrics-tunnel-time-row-title-font-size);
      color: var(--server-metrics-tunnel-time-row-title-color);
    }

    icon-tooltip {
      --icon-tooltip-icon-size: var(--server-metrics-tunnel-time-row-icon-size);
      --icon-tooltip-button-size: var(
        --server-metrics-tunnel-time-row-icon-button-size
      );
    }

    mwc-icon {
      --mdc-icon-size: var(--server-metrics-tunnel-time-row-icon-size);
    }

    .tunnel-time-container {
      margin-top: var(
        --server-metrics-tunnel-time-row-value-container-margin-top
      );
    }

    .tunnel-time-value {
      font-family: var(--server-metrics-tunnel-time-row-value-font-family);
      font-size: var(--server-metrics-tunnel-time-row-value-font-size);
    }

    .tunnel-time-unit {
      color: var(--server-metrics-tunnel-time-row-title-color);
      font-family: var(--server-metrics-tunnel-time-row-font-family);
      font-size: var(--server-metrics-tunnel-time-row-value-label-font-size);
      margin-left: var(
        --server-metrics-tunnel-time-row-value-label-margin-left
      );
    }
  `;

  get formatter() {
    return new Intl.NumberFormat(this.language, {
      style: 'unit',
      unit: 'hour',
      unitDisplay: 'long',
    });
  }

  render() {
    return html`
      <server-metrics-row
        .subcards=${this.locations.map(asn => {
          if (!asn.asOrg) {
            return {
              title: 'Unknown',
              highlight: this.formatter.format(asn.seconds / SECONDS_IN_HOUR),
            };
          }

          return {
            title: asn.asOrg,
            subtitle: asn.asn,
            highlight: this.formatter.format(asn.seconds / SECONDS_IN_HOUR),
            icon: asn.countryFlag,
          };
        })}
        .subtitle=${this.localize(
          'server-view-server-metrics-tunnel-time-as-breakdown',
          'openItalics',
          '<i>',
          'closeItalics',
          '</i>'
        )}
      >
        <div class="main-container">
          <div class="title-container">
            <mwc-icon>timer</mwc-icon>
            <h2 class="title">
              ${unsafeHTML(
                this.localize(
                  'server-view-server-metrics-tunnel-time-title',
                  'openItalics',
                  '<i>',
                  'closeItalics',
                  '</i>'
                )
              )}
            </h2>
            <icon-tooltip
              text="${this.localize(
                'server-view-server-metrics-tunnel-time-tooltip'
              )}"
            ></icon-tooltip>
          </div>
          <div class="tunnel-time-container">
            ${this.metrics.tunnelTime
              ? html`<span class="tunnel-time-value"
                    >${this.formatSecondsValue(
                      this.metrics.tunnelTime.seconds
                    )}</span
                  >
                  <span class="tunnel-time-unit"
                    >${this.formatSecondsUnits(
                      this.metrics.tunnelTime.seconds
                    )}</span
                  >`
              : html`<span class="tunnel-time-value">-</span>`}
          </div>
        </div>
      </server-metrics-row>
    `;
  }

  // TODO: move to formatter library
  private formatSecondsUnits(seconds: number) {
    return this.formatter
      .formatToParts(seconds / SECONDS_IN_HOUR)
      .find(({type}) => type === 'unit').value;
  }

  private formatSecondsValue(seconds: number) {
    return this.formatter
      .formatToParts(seconds / SECONDS_IN_HOUR)
      .filter(
        ({type}) =>
          type === 'integer' ||
          type === 'decimal' ||
          type === 'group' ||
          type === 'fraction'
      )
      .reduce((string, {value}) => string + value, '');
  }
}
