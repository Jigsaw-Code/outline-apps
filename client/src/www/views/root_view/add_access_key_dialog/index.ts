import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {SHADOWSOCKS_URI} from 'ShadowsocksConfig';

@customElement('add-access-key-dialog')
export class AddAccessKeyDialog extends LitElement {
  @property({type: Function}) localize!: (
    key: string,
    ...args: string[]
  ) => string;
  @property({type: Boolean}) open: boolean;
  @property({type: String}) accessKey: string | null;

  static styles = css`
    :host {
      --md-sys-color-primary: var(--outline-primary);
      --md-sys-shape-corner-extra-large: 2px;
      --md-sys-shape-corner-full: 2px;

      width: 100%;
      height: 100%;
    }

    md-dialog {
      min-width: 300px;
    }

    section {
      margin-bottom: 12px;
    }

    a {
      color: var(--outline-primary);
    }

    md-filled-text-field {
      --md-filled-text-field-input-text-font: 'Menlo', monospace;

      width: 100%;
    }

    fieldset {
      border: none;
      text-transform: uppercase;
    }
  `;

  render() {
    return html`<md-dialog
      .open="${this.open}"
      @cancel=${this.handleCancel}
      quick
    >
      <header slot="headline">Add VPN access key</header>
      <article slot="content">
        <section style="color:gray;">
          Need a new access key? Create one at <a>our website</a>.
        </section>
        <section>
          <md-filled-text-field
            @input=${this.handleEdit}
            .error=${this.accessKey && !this.hasValidAccessKey}
            error-text="Invalid access key."
            label="Paste access key here"
            rows="5"
            type="textarea"
            value=${this.accessKey}
          ></md-filled-text-field>
        </section>
      </article>
      <fieldset slot="actions">
        <md-text-button @click=${this.handleCancel}>Cancel</md-text-button>
        <md-filled-button
          @click=${this.handleConfirm}
          ?disabled=${!this.hasValidAccessKey}
          >Confirm</md-filled-button
        >
      </fieldset>
    </md-dialog>`;
  }

  private get hasValidAccessKey() {
    try {
      SHADOWSOCKS_URI.parse(this.accessKey);
      return true;
    } catch {
      // do nothing
    }

    try {
      const url = new URL(this.accessKey);
      return url.protocol === 'ssconf:';
    } catch {
      // do nothing
    }

    return false;
  }

  private handleEdit(event: InputEvent) {
    this.accessKey = (event.target as HTMLInputElement).value;
  }

  private handleConfirm() {
    this.dispatchEvent(
      new CustomEvent('AddServerRequested', {
        detail: {accessKey: this.accessKey},
        composed: true,
        bubbles: true,
      })
    );

    this.accessKey = null;
  }

  private handleCancel(event: Event) {
    event.preventDefault();

    this.dispatchEvent(
      new CustomEvent('IgnoreServerRequested', {
        detail: {accessKey: this.accessKey},
        composed: true,
        bubbles: true,
      })
    );

    this.accessKey = null;
  }
}
