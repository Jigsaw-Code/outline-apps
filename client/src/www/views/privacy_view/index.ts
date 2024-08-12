import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import '@material/mwc-button';

@customElement('privacy-view')
export class PrivacyView extends LitElement {
  @property({type: Function}) localize!: (key: string) => string; // Define the localize function type
  @property({type: String}) rootPath!: string;

  static styles = css`
  :host {
    background: #fff;
    width: 100%;
    height: 100vh;
    font-family: var(--outline-font-family);
    z-index: 1000; /* Give this a high z-index so it overlays the UI. */
  }
  #container {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    text-align: center;
    background: var(--dark-green);
    color: rgba(255, 255, 255, 0.87);
    width: 100%;
    height: 100%;
  }
  #header {
    align-self: center;
    margin: 96px auto 0 auto;
  }
  #privacy-lock {
    width: 112px;
    height: 158px;
  }
  #footer-container {
    text-align: center;
  }
  #footer {
    padding: 0 12px;
    width: 276px;
    margin: 24px auto;
  }
  #footer h3 {
    font-size: 20px;
    font-weight: 500;
    line-height: 28px;
    margin: 24px 0 0 0;
  }
  #footer p {
    font-size: 14px;
    line-height: 20px;
    margin: 24px 0 0 0;
    color: rgba(255, 255, 255, 0.54);
  }
  #button-container {
    display: flex;
    justify-content: space-between;
    margin: 48px 0 0 0;
  }
  #button-container a {
    text-decoration: none;
  }
  .faded {
    color: rgba(255, 255, 255, 0.54);
  }
  @media (max-height: 600px) {
    #header {
      margin: 48px auto 0 auto;
    }
    #privacy-lock {
      width: 90px;
      height: 127px;
    }
    #button-container {
      margin: 24px 0 0 0;
    }
  }
  @media (min-width: 768px) {
    #header {
      margin: 144px auto 0 auto;
    }
    #privacy-lock {
      width: 168px;
      height: 237px;
    }
    #footer {
      margin: 48px auto;
      width: 552px;
    }
    #footer h3 {
      font-size: 28px;
      line-height: 40px;
    }
    #footer p,
    #button-container {
      font-size: 22px;
      line-height: 30px;   

    }
  }
`;

  _privacyTermsAcked() {
    this.dispatchEvent(new CustomEvent('PrivacyTermsAcked'));
  }

  render() {
    return html`
      <div id="container">
        <div id="header">
          <img
            id="privacy-lock"
            src="${this.rootPath}assets/privacy-lock.png"
          />
        </div>
        <div id="footer-container">
          <div id="footer">
            <h3>${this.localize('privacy-title')}</h3>
            <p class="faded">${this.localize('privacy-text')}</p>
            <div id="button-container">
              <a
                href="https://support.getoutline.org/s/article/Data-collection"
              >
                <mwc-button
                  outlined
                  label="${this.localize('learn-more')}"
                  class="faded"
                ></mwc-button>
              </a>
              <mwc-button
                unelevated
                label="${this.localize('got-it')}"
                @click="${this._privacyTermsAcked}"
              ></mwc-button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
