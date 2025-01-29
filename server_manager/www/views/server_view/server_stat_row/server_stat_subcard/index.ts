import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('server-stat-subcard')
export class ServerStatSubcard extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: sans-serif;
      border-radius: 8px;
      background-color: #36454f;
      color: white;
      padding: 16px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      width: 100%;
      max-width: 400px;
      box-sizing: border-box;
    }

    .highlight {
      background-color: #50c878;
      color: black;
      padding: 4px 8px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 8px;
      font-weight: bold;
    }

    .title {
      font-size: 1rem;
      margin-bottom: 4px;
      word-wrap: break-word;
    }

    .subtitle {
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      gap: 8px;
      word-wrap: break-word;
    }
    .subtitle > span:first-child {
      flex-grow: 1; /* Allow text to take available space*/
    }

    .icon {
      width: 20px;
      height: auto;
      vertical-align: middle;
      flex-shrink: 0;
    }

    @media (max-width: 600px) {
      .subtitle {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
      .icon {
        width: 16px;
      }
    }
  `;

  @property({type: String}) highlightText = '';
  @property({type: String}) titleText = '';
  @property({type: String}) subtitleText = '';
  @property({type: String}) icon = '';

  render() {
    return html`
      <article>
        ${this.highlightText
          ? html`<mark class="highlight">${this.highlightText}</mark>`
          : ''}
        <h2 class="title">${this.titleText}</h2>
        <p class="subtitle">
          <span>${this.subtitleText}</span>
          ${this.icon
            ? html`<span class="icon" role="img" aria-label="Icon"
                >${this.icon}</span
              >`
            : ''}
        </p>
      </article>
    `;
  }
}
