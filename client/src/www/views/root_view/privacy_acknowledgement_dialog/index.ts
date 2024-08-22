import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import privacyLock from '../../../assets/privacy-lock.png';

@customElement('privacy-acknowledgement-dialog')
export class PrivacyAcknowledgementDialog extends LitElement {
  @property({type: Function}) localize!: (key: string) => string;
  @property({type: Boolean}) open: boolean = false;

  static styles = css`
    :host {
      --md-sys-color-primary: var(--outline-primary);
      --md-sys-shape-corner-extra-large: 2px;
      --md-sys-shape-corner-full: 2px;
    }

    md-dialog {
      --md-dialog-container-color: var(--outline-dark-primary);
      --md-dialog-supporting-text-color: var(--outline-white);

      text-align: center;
    }

    img {
      width: 112px;
      height: 158px;
    }

    fieldset {
      border: none;
      display: flex;
      justify-content: center;
      text-transform: uppercase;
    }
  `;

  render() {
    return html`
      <md-dialog
        .open=${this.open}
        @cancel=${(event: Event) => event.preventDefault()}
        quick
      >
        <article slot="content">
          <section>
            <img alt="privacy lock" src="${privacyLock}" />
          </section>
          <section>
            <h2>${this.localize('privacy-title')}</h2>
          </section>
          <section>${this.localize('privacy-text')}</section>
        </article>
        <fieldset slot="actions">
          <md-text-button
            @click="${() =>
              window.open(
                'https://support.getoutline.org/s/article/Data-collection',
                '_blank'
              )}"
          >
            ${this.localize('learn-more')}
          </md-text-button>
          <md-filled-button @click="${this.handleAcknowledgement}">
            ${this.localize('got-it')}
          </md-filled-button>
        </fieldset>
      </md-dialog>
    `;
  }

  private handleAcknowledgement() {
    this.dispatchEvent(new CustomEvent('PrivacyTermsAcked'));
  }
}
