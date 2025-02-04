import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import '@material/mwc-icon';

@customElement('info-tooltip')
export class InformationTooltip extends LitElement {
  @property({type: String}) text: string;

  static styles = css`
    :host {
      --info-tooltip-icon-size: 1.85rem;

      --mdc-icon-size: var(--info-tooltip-icon-size);
    }

    .tooltip-container {
      display: flex;
      cursor: help;
    }
  `;

  render() {
    return html`<div class="tooltip-container">
      <!-- 
        TODO: Absolute positioning doesn't work in all contexts, including parents with overflow: hidden and CSS Grid.
        In order to style the tooltip text, we need to use the Popover API, which is not supported in the current version
        of Electron we ship. Once we upgrade Electron V25, we can then update this tooltip to use the Popover API.
      -->
      <mwc-icon title=${this.text}>info</mwc-icon>
    </div>`;
  }
}
