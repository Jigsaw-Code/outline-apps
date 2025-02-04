import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import '@material/mwc-icon';

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
    }

    .tooltip-container {
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

    .tooltip-container:hover .tooltip {
      visibility: visible;
      opacity: 1;
    }
  `;

  render() {
    return html`<div class="tooltip-container">
      <mwc-icon>info</mwc-icon>
      <span class="tooltip">${this.text}</span>
    </div>`;
  }
}
