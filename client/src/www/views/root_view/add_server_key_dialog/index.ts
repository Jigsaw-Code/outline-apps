import {LitElement, html, css} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {SHADOWSOCKS_URI} from 'ShadowsocksConfig';

@customElement('add-server-key-dialog')
export class AddServerKeyDialog extends LitElement {
  @property({type: Function}) localize!: (
    key: string,
    ...args: string[]
  ) => string;
  @property({type: Boolean}) open: boolean;

  @state() private editedAccessKey: string | null;
  @state() private hasValidAccessKey: boolean;

  static styles = css`
    :host {
      --md-sys-color-primary: var(--outline-primary);

      width: 100%;
      height: 100%;
    }

    section {
      margin-bottom: 12px;
    }

    section md-filled-text-field {
      --md-filled-text-field-input-text-font: 'Menlo', monospace;

      width: 100%;
    }

    footer {
      font-family: var(--outline-font-family);
      font-size: 14px;
    }
  `;

  render() {
    const footerContents = this.hasValidAccessKey
      ? html`<md-text-button @click=${this.handleAccessKeyCancel}
            >${this.localize('server-add-ignore')}
          </md-text-button>
          <md-filled-button @click=${this.handleAccessKeyCreate}
            >${this.localize('server-add')}</md-filled-button
          >`
      : html`<slot name="accessMessage"></slot>`;

    return html`<md-dialog .open="${this.open}">
      <header slot="headline">
        ${this.localize(
          this.hasValidAccessKey
            ? 'server-access-key-detected'
            : 'server-add-access-key'
        )}
      </header>
      <article slot="content">
        <section>
          ${this.localize(
            this.hasValidAccessKey
              ? 'server-detected'
              : 'server-add-instructions'
          )}
        </section>
        <section>
          <md-filled-text-field
            @input=${this.handleAccessKeyEdit}
            label=${this.localize(
              'server-access-key-label',
              'ssProtocol',
              'ss://'
            )}
            type="textarea"
            rows="5"
          >
            <md-icon slot="leading-icon">vpn_key</md-icon>
          </md-filled-text-field>
        </section>
      </article>
      <footer slot="actions">${footerContents}</footer>
    </md-dialog>`;
  }

  private handleAccessKeyEdit(event: InputEvent) {
    this.editedAccessKey = (event.target as HTMLInputElement).value;

    try {
      SHADOWSOCKS_URI.parse(this.editedAccessKey);
      this.hasValidAccessKey = true;
    } catch {
      this.hasValidAccessKey = false;
    }
  }

  private handleAccessKeyCreate() {
    this.dispatchEvent(
      new CustomEvent('AddServerRequested', {
        detail: {accessKey: this.editedAccessKey},
        composed: true,
        bubbles: true,
      })
    );
  }

  private handleAccessKeyCancel() {
    this.dispatchEvent(
      new CustomEvent('AddServerRequested', {
        detail: {accessKey: this.editedAccessKey},
        composed: true,
        bubbles: true,
      })
    );
  }
}
