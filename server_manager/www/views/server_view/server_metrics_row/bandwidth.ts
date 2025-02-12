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

import {formatBytes, getDataFormattingParams} from '../../../data_formatting';

import '../icon_tooltip';
import './index';
import '@material/mwc-icon';

export interface ServerMetricsBandwidthRegion {
  bytes: number;
  asn: string;
  asOrg?: string;
  countryFlag: string;
}

@customElement('server-metrics-bandwidth-row')
export class ServerMetricsBandwidthRow extends LitElement {
  @property({type: String}) language: string = 'en';
  @property({type: Object}) localize: (key: string) => string;
  @property({type: Number}) totalBytes: number;
  @property({type: Number}) limitBytes: number;
  @property({type: Number}) limitThreshold: number = 0.8;
  @property({type: Boolean}) hasDataLimits: boolean = false;
  @property({type: Number}) currentBytes: number;
  @property({type: Number}) peakBytes: number;
  @property({type: String}) peakTimestamp: string;
  @property({type: Array}) locations: Array<ServerMetricsBandwidthRegion>;

  @property({type: Boolean, reflect: true})
  get bandwidthLimitWarning() {
    return this.bandwidthPercentage >= this.limitThreshold;
  }

  get bandwidthPercentage() {
    return this.totalBytes / this.limitBytes;
  }

  static styles = css`
    :host {
      --server-metrics-bandwidth-row-icon-size: 1.38rem;

      --server-metrics-bandwidth-row-font-family: 'Inter', system-ui;
      --server-metrics-bandwidth-row-title-color: hsla(0, 0%, 100%, 0.7);
      --server-metrics-bandwidth-row-title-container-gap: 0.25rem;
      --server-metrics-bandwidth-row-title-font-size: 1rem;
      --server-metrics-bandwidth-row-padding: 0.9rem 1.3rem;

      --server-metrics-bandwidth-row-value-container-margin-top: 0.75rem;

      --server-metrics-bandwidth-row-value-font-size: 2.25rem;
      --server-metrics-bandwidth-row-value-font-family: 'Roboto', system-ui;
      --server-metrics-bandwidth-row-value-label-font-size: 0.825rem;
      --server-metrics-bandwidth-row-value-label-margin-left: 0.2rem;

      --server-metrics-bandwidth-row-meter-size: 0.6rem;

      --server-metrics-bandwidth-row-meter-background-color: hsla(
        0,
        0%,
        85%,
        1
      );

      --server-metrics-bandwidth-row-meter-color: hsla(167, 57%, 61%, 0.88);
      --server-metrics-bandwidth-row-meter-text-color: hsl(0, 0%, 79%);

      --server-metrics-bandwidth-row-meter-warning-color: hsla(
        42,
        100%,
        63%,
        1
      );

      --server-metrics-bandwidth-row-bandwidth-progress-container-gap: 0.5rem;
      --server-metrics-bandwidth-row-current-and-peak-border: 1px solid
        hsla(0, 0%, 100%, 0.35);
      --server-metrics-bandwidth-row-current-and-peak-container-gap: 0.9rem;
      --server-metrics-bandwidth-row-current-and-peak-value-font-size: 1.5rem;
      --server-metrics-bandwidth-row-current-and-peak-inner-container-gap: 0.25rem;
      --server-metrics-bandwidth-row-peak-timestamp-text-color: hsla(
        0,
        0%,
        100%,
        0.5
      );
    }

    .main-container {
      display: flex;
      gap: 1rem;
    }

    .title-and-bandwidth-container,
    .current-and-peak-container {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      padding: var(--server-metrics-bandwidth-row-padding);
    }

    .title-container {
      display: flex;
      align-items: center;
      gap: var(--server-metrics-bandwidth-row-title-container-gap);
    }

    .title {
      all: initial;
      display: inline-block;
      font-family: var(--server-metrics-bandwidth-row-font-family);
      font-weight: 400;
      font-size: var(--server-metrics-bandwidth-row-title-font-size);
      color: var(--server-metrics-bandwidth-row-title-color);
    }

    mwc-icon {
      --mdc-icon-size: var(--server-metrics-bandwidth-row-icon-size);
    }

    icon-tooltip {
      --icon-tooltip-icon-size: var(--server-metrics-tunnel-time-row-icon-size);
    }

    .bandwidth-container {
      margin-top: var(
        --server-metrics-bandwidth-row-value-container-margin-top
      );
    }

    .bandwidth-percentage {
      font-family: var(--server-metrics-bandwidth-row-value-font-family);
      font-size: var(--server-metrics-bandwidth-row-value-font-size);
    }

    :host([bandwidthLimitWarning]) .bandwidth-percentage {
      color: var(--server-metrics-bandwidth-row-meter-warning-color);
    }

    .bandwidth-fraction {
      color: var(--server-metrics-bandwidth-row-title-color);
      font-family: var(--server-metrics-bandwidth-row-font-family);
      font-size: var(--server-metrics-bandwidth-row-value-label-font-size);
      margin-left: var(--server-metrics-bandwidth-row-value-label-margin-left);
    }

    .bandwidth-progress-container {
      display: flex;
      align-items: center;
      gap: var(--server-metrics-bandwidth-row-value-container-margin-top);

      /* TODO: use calc() here. compensates for the height offset when the warning icon is displayed */
      padding: 0.825rem 0;
    }

    progress {
      display: block;
      appearance: none;
      height: var(--server-metrics-bandwidth-row-meter-size);
      margin-bottom: var(--server-metrics-bandwidth-row-meter-gap);
      width: 100%;
    }

    progress[value]::-webkit-progress-bar {
      /* crops the progress value so it doesn't render outside the container's border-radius */
      overflow: hidden;
      background: var(--server-metrics-bandwidth-row-meter-background-color);
      border-radius: var(--server-metrics-bandwidth-row-meter-size);
    }

    progress[value]::-webkit-progress-value {
      background: var(--server-metrics-bandwidth-row-meter-color);
      border-radius: var(--server-metrics-bandwidth-row-meter-size);
    }

    .bandwidth-progress-container icon-tooltip {
      display: none;

      --icon-tooltip-icon-color: var(
        --server-metrics-bandwidth-row-meter-warning-color
      );
    }

    :host([bandwidthLimitWarning]) progress[value]::-webkit-progress-value {
      background: var(--server-metrics-bandwidth-row-meter-warning-color);
    }

    :host([bandwidthLimitWarning]) .bandwidth-progress-container {
      padding: 0;
    }

    :host([bandwidthLimitWarning]) .bandwidth-progress-container icon-tooltip {
      display: block;
    }

    .current-and-peak-container {
      gap: var(--server-metrics-bandwidth-row-current-and-peak-container-gap);
      border-left: var(--server-metrics-bandwidth-row-current-and-peak-border);
    }

    .current-container,
    .peak-container {
      display: flex;
      flex-direction: column;
      gap: var(--server-metrics-bandwidth-row-value-container-margin-top);
    }

    .current-value,
    .peak-value {
      font-family: var(--server-metrics-bandwidth-row-value-font-family);
      font-size: var(
        --server-metrics-bandwidth-row-current-and-peak-value-font-size
      );
    }

    .current-unit,
    .peak-unit {
      color: var(--server-metrics-bandwidth-row-title-color);
      font-family: var(--server-metrics-bandwidth-row-font-family);
      font-size: var(--server-metrics-bandwidth-row-value-label-font-size);
    }

    .current-title,
    .peak-title {
      color: var(--server-metrics-bandwidth-row-title-color);
      font-family: var(--server-metrics-bandwidth-row-font-family);
      font-size: var(--server-metrics-bandwidth-row-value-label-font-size);
    }

    .peak-timestamp {
      color: var(--server-metrics-bandwidth-row-peak-timestamp-text-color);
      font-family: var(--server-metrics-bandwidth-row-font-family);
      font-size: var(--server-metrics-bandwidth-row-value-label-font-size);
      font-style: italic;
    }

    /* TODO: switch to container query once we upgrade Electron */
    @media (max-width: 720px) {
      .main-container {
        flex-direction: column;
        gap: 0;
      }

      .current-and-peak-container {
        padding-top: 0;
        border: none;
      }
    }
  `;

  render() {
    return html`
      <server-metrics-row
        .subcards=${this.locations.map(asn => ({
          title: asn.asOrg,
          subtitle: asn.asn,
          highlight: formatBytes(asn.bytes, this.language),
          icon: asn.countryFlag,
        }))}
        .subtitle=${this.localize(
          'server-view-server-metrics-bandwidth-as-breakdown'
        )}
      >
        <div class="main-container">
          <div class="title-and-bandwidth-container">
            <div class="title-container">
              <mwc-icon>data_usage</mwc-icon>
              <h2 class="title">
                ${unsafeHTML(
                  this.localize('server-view-server-metrics-bandwidth-title')
                )}
              </h2>
              <icon-tooltip
                text="${this.localize(
                  'server-view-server-metrics-bandwidth-tooltip'
                )}"
              ></icon-tooltip>
            </div>
            <div class="bandwidth-container">
              <span class="bandwidth-percentage"
                >${this.formatPercentage(this.bandwidthPercentage)}</span
              >
              <span class="bandwidth-fraction"
                >${formatBytes(this.totalBytes, this.language)}
                /${formatBytes(this.limitBytes, this.language)}</span
              >
              <span class="bandwidth-progress-container">
                <progress
                  max=${this.limitBytes}
                  value=${this.totalBytes}
                ></progress>
                <icon-tooltip
                  text="${this.hasDataLimits
                    ? ''
                    : this.localize(
                        'server-view-server-metrics-bandwidth-limit-tooltip'
                      )}"
                  icon="warning"
                ></icon-tooltip>
              </span>
            </div>
          </div>
          <div class="current-and-peak-container">
            <div class="current-container">
              <span class="current-value-and-unit">
                <span class="current-value"
                  >${this.formatBandwidthValue(this.currentBytes)}</span
                >
                <span class="current-unit"
                  >${this.formatBandwidthUnit(this.currentBytes)}</span
                >
              </span>
              <span class="current-title"
                >${this.localize(
                  'server-view-server-metrics-bandwidth-usage'
                )}</span
              >
            </div>
            <div class="peak-container">
              <span class="peak-value-and-unit">
                <span class="peak-value"
                  >${this.formatBandwidthValue(this.peakBytes)}</span
                >
                <span class="peak-unit"
                  >${this.formatBandwidthUnit(this.peakBytes)}</span
                >
                ${this.peakTimestamp
                  ? html`<span class="peak-timestamp"
                      >(${this.peakTimestamp})</span
                    >`
                  : nothing}
              </span>
              <span class="peak-title"
                >${unsafeHTML(
                  this.localize(
                    'server-view-server-metrics-bandwidth-usage-max'
                  )
                )}</span
              >
            </div>
          </div>
        </div>
      </server-metrics-row>
    `;
  }

  // TODO: move to formatter library
  private formatPercentage(percentage: number) {
    return Intl.NumberFormat(this.language, {
      style: 'percent',
      minimumFractionDigits: 0,
    }).format(percentage);
  }

  private formatBandwidthUnit(bytesPerSecond: number) {
    return (
      this.formatBandwidthParts(bytesPerSecond)
        .find(({type}) => type === 'unit')
        .value // Special case for "byte", since we'd rather be consistent with "KB", etc.  "byte" is
        // presumably used due to the example in the Unicode standard,
        // http://unicode.org/reports/tr35/tr35-general.html#Example_Units
        .replace(/bytes?/, ' B')
    );
  }

  private formatBandwidthValue(bytesPerSecond: number) {
    return this.formatBandwidthParts(bytesPerSecond)
      .filter(
        ({type}) =>
          type === 'integer' ||
          type === 'decimal' ||
          type === 'group' ||
          type === 'fraction'
      )
      .reduce((string, {value}) => string + value, '');
  }

  private formatBandwidthParts(bytesPerSecond: number) {
    const {value, unit, decimalPlaces} =
      getDataFormattingParams(bytesPerSecond);

    return new Intl.NumberFormat(this.language, {
      style: 'unit',
      unit: `${unit}-per-second`,
      maximumFractionDigits: decimalPlaces,
    }).formatToParts(value);
  }
}
