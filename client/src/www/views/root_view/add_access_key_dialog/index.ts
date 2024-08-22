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

    section.help-text {
      color: var(--outline-medium-gray);
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
      <header slot="headline">
        ${this.localize('add-access-key-dialog-header')}
      </header>
      <article slot="content">
        <section
          class="help-text"
          .innerHTML=${this.localize('add-access-key-dialog-help-text')}
        ></section>
        <section>
          <md-filled-text-field
            .error=${this.accessKey && !this.hasValidAccessKey}
            @input=${this.handleEdit}
            error-text="${this.localize('add-access-key-dialog-error-text')}"
            label="${this.localize('add-access-key-dialog-label')}"
            rows="5"
            type="textarea"
            value=${this.accessKey}
          ></md-filled-text-field>
        </section>
      </article>
      <fieldset slot="actions">
        <md-text-button @click=${this.handleCancel}>
          ${this.localize('add-access-key-dialog-cancel')}
        </md-text-button>
        <md-filled-button
          @click=${this.handleConfirm}
          ?disabled=${!this.hasValidAccessKey}
          >${this.localize('add-access-key-dialog-confirm')}</md-filled-button
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
