import {LitElement, html, css, nothing} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {SHADOWSOCKS_URI} from 'ShadowsocksConfig';

@customElement('add-access-key-dialog')
export class AddAccessKeyDialog extends LitElement {
  @property({type: Function}) localize!: (
    key: string,
    ...args: string[]
  ) => string;
  @property({type: Boolean}) open: boolean;

  @state() accessKey: string | null;

  static styles = css`
    :host {
      --md-sys-color-primary: var(--outline-primary);
      --md-sys-shape-corner-extra-large: 12px;

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

    a {
      color: var(--outline-primary);
    }
  `;

  render() {
    return html`<md-dialog .open="${this.open}">
      <header slot="headline">
        ${this.hasValidAccessKey
            ? 'Access key detected'
            : 'Add server access key'
        }
      </header>
      <article slot="content">
        <section>
            ${this.hasValidAccessKey
              ? 'Please confirm that you want to add this access key.'
              : 'Paste the access key you want to add here.'}
        </section>
        <section>
          <md-filled-text-field
            @input=${this.handleAccessKeyEdit}
            .error=${this.hasDefinedButInvalidAccessKey}
            error-text="Invalid access key."
            rows="5"
            type="textarea"
            value=${this.accessKey}
          ></md-filled-text-field>
        </section>
        ${
          !this.hasValidAccessKey 
            ? html`<section style="color:gray;">Need a new access key? Create one at <a>our website</a>.</section>` 
            : nothing
        }
      </article>
      <footer slot="actions">
        <md-text-button @click=${this.handleAccessKeyCancel}
          >Cancel
        </md-text-button>
        <md-filled-button @click=${this.handleAccessKeyCreate} ?disabled=${!this.hasValidAccessKey}
          >Confirm</md-filled-button
        >
      </footer>
    </md-dialog>`;
  }

  private get hasValidAccessKey() {
    try {
      SHADOWSOCKS_URI.parse(this.accessKey);
      return true;
    } catch {}

    try {
      const url = new URL(this.accessKey);
      return url.protocol === 'ssconf:';
    } catch {}

    return false;
  }

  private get hasDefinedButInvalidAccessKey() {
    return this.accessKey && !this.hasValidAccessKey;
  }

  private handleAccessKeyEdit(event: InputEvent) {
    this.accessKey = (event.target as HTMLInputElement).value;
  }

  private handleAccessKeyCreate() {
    this.accessKey = null;

    this.dispatchEvent(
      new CustomEvent('AddServerRequested', {
        detail: {accessKey: this.accessKey},
        composed: true,
        bubbles: true,
      })
    );
  }

  private handleAccessKeyCancel() {
    this.accessKey = null;

    this.dispatchEvent(
      new CustomEvent('AddServerRequested', {
        detail: {accessKey: this.accessKey},
        composed: true,
        bubbles: true,
      })
    );
  }
}
