import {LitElement, html, css, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import '@material/mwc-icon';

import './server_stat_row_subcard';
import type {ServerStatRowSubcard} from './server_stat_row_subcard';

@customElement('server-stat-row')
export class ServerStatRow extends LitElement {
  static styles = css`
    :host {
      --server-stat-row-background: hsl(200, 15%, 18%);
      --server-stat-row-text-color: hsla(0, 0%, 100%, 0.87);
      --server-stat-row-title-color: hsla(0, 0%, 100%, 0.7);
      --server-stat-row-tooltip-background: hsl(0, 0%, 94%);
      --server-stat-row-tooltip-text-color: hsl(0, 0%, 20%);
      --server-stat-row-header-bottom-border: 1px solid hsla(0, 0%, 100%, 0.5);
      --server-stat-row-title-icon-size: 1.5rem;
      --server-stat-row-tooltip-icon-size: 1rem;
      --server-stat-row-h1-font-size: 1.3rem;
      --server-stat-row-total-value-font-size: 3rem;
      --server-stat-row-h2-font-size: 1rem;
      --server-stat-row-tooltip-width: 120px;
      --server-stat-row-tooltip-padding: 5px;
      --server-stat-row-tooltip-border-radius: 6px;
      --server-stat-row-tooltip-arrow-size: 5px;
      --server-stat-row-padding: 1rem;
      --server-stat-row-header-margin-bottom: 1rem;
      --server-stat-row-header-padding-bottom: 0.5rem;
      --server-stat-row-title-container-gap: 0.5rem;
      --server-stat-row-total-value-gap: 0.5rem;
      --server-stat-row-total-value-margin-right: 0.25rem;
      --server-stat-row-h2-margin-top: 1.25rem;
      --server-stat-row-h2-margin-bottom: 1rem;
      --server-stat-row-subcards-gap: 0.75rem;
      --server-stat-row-subcards-min-width: 12.5rem;

      display: block;
      font-family: 'Roboto', system-ui;
      font-weight: 400;
      width: 100%;
      box-sizing: border-box;
      background-color: var(--server-stat-row-background);
      color: var(--server-stat-row-text-color);
    }

    main {
      padding: var(--server-stat-row-padding);
      border-bottom: var(--server-stat-row-header-bottom-border);
    }

    .title {
      display: inline-block;
      font-size: var(--server-stat-row-h1-font-size);
      font-weight: normal;
      color: var(--server-stat-row-title-color);
      margin: 0;
    }

    .title-value {
      font-size: var(--server-stat-row-total-value-font-size);
    }

    .title-value-label {
      color: var(--server-stat-row-title-color);
      font-size: 1.1rem;
    }

    footer {
      padding: var(--server-stat-row-padding);
    }

    .subtitle {
      font-size: var(--server-stat-row-h2-font-size);
      font-weight: normal;
      color: var(--server-stat-row-title-color);
      margin: 0;
      padding-bottom: 0.5rem;
    }

    .subcards-container {
      display: grid;
      grid-template-columns: repeat(
        auto-fit,
        minmax(var(--server-stat-row-subcards-min-width), 1fr)
      );
      gap: var(--server-stat-row-subcards-gap);
    }

    .tooltip {
      cursor: pointer;
      position: relative;
      display: inline-block;
    }

    .tooltip .tooltiptext {
      visibility: hidden;
      width: var(--server-stat-row-tooltip-width);
      background-color: var(--server-stat-row-tooltip-background);
      color: var(--server-stat-row-tooltip-text-color);
      text-align: center;
      padding: var(--server-stat-row-tooltip-padding);
      border-radius: var(--server-stat-row-tooltip-border-radius);
      word-wrap: break-word;
      position: absolute;
      top: 150%;
      left: 50%;
      transform: translateX(-50%);
      white-space: pre-line;
    }

    .tooltip:hover .tooltiptext {
      visibility: visible;
      opacity: 1;
    }

    .tooltip .tooltiptext::after {
      content: ' ';
      position: absolute;
      bottom: 100%; /* At the top of the tooltip */
      left: 50%;
      transform: translateX(-50%);
      border-width: var(--server-stat-row-tooltip-arrow-size);
      border-style: solid;
      border-color: transparent transparent
        var(--server-stat-row-tooltip-background) transparent;
    }
  `;

  @property({type: String}) title = '';
  @property({type: String}) titleValue = '';
  @property({type: String}) titleValueLabel = '';
  @property({type: String}) subtitle = '';
  @property({type: Array}) subcards: Array<Partial<ServerStatRowSubcard>> = [];
  @property({type: String}) tooltip = '';
  @property({type: String}) titleIcon = '';

  render() {
    return html`
      <section>
        <main>
          <div class="title-container">
            ${this.titleIcon
              ? html`<mwc-icon>${this.titleIcon}</mwc-icon>`
              : ''}
            <h1 class="title">${this.title}</h1>
            <div class="tooltip">
              <mwc-icon>info</mwc-icon>
              <span class="tooltiptext">${this.tooltip}</span>
            </div>
          </div>
          ${this.titleValue
            ? html`
                <div class="title-value-container">
                  <span class="title-value">${this.titleValue}</span>
                  <span class="title-value-label">${this.titleValueLabel}</span>
                </div>
              `
            : nothing}
        </main>

        <footer>
          ${this.subtitle
            ? html`<h2 class="subtitle">${this.subtitle}</h2>`
            : nothing}

          <div class="subcards-container">
            ${this.subcards.map(
              ({highlight, title, subtitle, icon}) => html`
                <server-stat-row-subcard
                  highlight="${highlight}"
                  title="${title}"
                  subtitle="${subtitle}"
                  icon="${icon}"
                ></server-stat-row-subcard>
              `
            )}
          </div>
        </footer>
      </section>
    `;
  }
}
