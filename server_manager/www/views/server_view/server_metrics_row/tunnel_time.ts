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

import '../help_tooltip';
import './index';
import '@material/mwc-icon';

interface ServerMetricsTunnelTimeAsn {
  tunnelTimeHours: number;
  asn: string;
  asOrg?: string;
  countryFlag: string;
}

@customElement('server-metrics-tunnel-time-row')
export class ServerMetricsTunnelTimeRow extends LitElement {
  @property({type: String}) language: string = 'en';
  @property({type: String}) title: string;
  @property({type: String}) tooltip: string;
  @property({type: Number}) totalTunnelTimeHours: number;
  @property({type: String}) tunnelTimeAsnTitle: string;
  @property({type: Array}) tunnelTimeAsns: Array<ServerMetricsTunnelTimeAsn>;

  static styles = css`
    :host {
      --server-metrics-tunnel-time-row-icon-size: 1.38rem;

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

    help-tooltip {
      --help-tooltip-icon-size: var(--server-metrics-tunnel-time-row-icon-size);
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

  render() {
    return html`
      <server-metrics-row
        .subcards=${this.tunnelTimeAsns.map(asn => ({
          title: asn.asOrg,
          subtitle: asn.asn,
          highlight: this.formatHourValueAndUnit(asn.tunnelTimeHours),
          icon: asn.countryFlag,
        }))}
        .subtitle=${this.tunnelTimeAsnTitle}
      >
        <div class="main-container">
          <div class="title-container">
            <mwc-icon>timer</mwc-icon>
            <h2 class="title">${unsafeHTML(this.title)}</h2>
            ${this.tooltip
              ? html`<help-tooltip>${this.tooltip}</help-tooltip>`
              : nothing}
          </div>
          <div class="tunnel-time-container">
            <span class="tunnel-time-value"
              >${this.formatHourValue(this.totalTunnelTimeHours)}</span
            >
            <span class="tunnel-time-unit"
              >${this.formatHourUnits(this.totalTunnelTimeHours)}</span
            >
          </div>
        </div>
      </server-metrics-row>
    `;
  }

  private formatHourValueAndUnit(hours: number) {
    return new Intl.NumberFormat(this.language, {
      style: 'unit',
      unit: 'hour',
      unitDisplay: 'long',
    }).format(hours);
  }

  private formatHourUnits(hours: number) {
    const formattedValue = this.formatHourValue(hours);
    const formattedValueAndUnit = this.formatHourValueAndUnit(hours);

    return formattedValueAndUnit
      .split(formattedValue)
      .find(_ => _)
      .trim();
  }

  private formatHourValue(hours: number) {
    return new Intl.NumberFormat(this.language, {
      unit: 'hour',
    }).format(hours);
  }
}
