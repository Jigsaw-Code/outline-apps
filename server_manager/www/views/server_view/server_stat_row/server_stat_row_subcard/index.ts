import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('server-stat-row-subcard')
export class ServerStatRowSubcard extends LitElement {
  static styles = css`
    :host {
      --server-stat-row-subcard-highlight-color: rgb(68, 107, 102);
      --server-stat-row-subcard-background: rgb(60, 70, 73);
      --server-stat-row-subcard-background-contrast: #2e3a3f;
      --server-stat-row-subcard-text-color: rgba(255, 255, 255, 0.87);
      --server-stat-row-subcard-border-color: rgba(255, 255, 255, 0.12);

      /*  Measurements */
      --server-stat-row-subcard-border-radius: 0.5rem;
      --server-stat-row-subcard-padding: 1rem;
      --server-stat-row-subcard-highlight-padding-vertical: 0.25rem;
      --server-stat-row-subcard-highlight-padding-horizontal: 0.5rem;
      --server-stat-row-subcard-highlight-margin-bottom: 0.5rem;
      --server-stat-row-subcard-title-margin-bottom: 0.25rem;
      --server-stat-row-subcard-subtitle-gap: 0.5rem;
      --server-stat-row-subcard-icon-width: 1.25rem;
      --server-stat-row-subcard-small-icon-width: 1rem;
      --server-stat-row-subcard-container-query-breakpoint: 250px;
      --server-stat-row-subcard-subtitle-small-gap: 0.25rem;
      --server-stat-row-subcard-media-query-breakpoint: 600px;

      display: block;
      border-radius: var(--server-stat-row-subcard-border-radius);
      background-color: var(--server-stat-row-subcard-background-contrast);
      color: var(--server-stat-row-subcard-text-color);
      padding: var(--server-stat-row-subcard-padding);

      width: 100%;
      box-sizing: border-box;
      container-type: inline-size;
      container-name: collapse;
    }

    .highlight {
      background-color: var(--server-stat-row-subcard-highlight-color);
      color: var(--server-stat-row-subcard-text-color);
      padding: var(--server-stat-row-subcard-highlight-padding-vertical)
        var(--server-stat-row-subcard-highlight-padding-horizontal);
      border-radius: var(--server-stat-row-subcard-border-radius);
      border: 2px solid rgb(88, 197, 173);
      font-family: system-ui;
      display: inline-block;
      margin-bottom: var(--server-stat-row-subcard-highlight-margin-bottom);
    }

    .title {
      all: initial;
      font-family: system-ui;
      display: block;
      color: var(--server-stat-row-subcard-text-color);

      font-size: 1rem;
      margin-bottom: var(--server-stat-row-subcard-title-margin-bottom);
      word-wrap: break-word;
    }

    .subtitle {
      all: initial;
      font-family: system-ui;
      font-size: 0.9rem;
      align-items: center;
      color: var(--server-stat-row-subcard-text-color);
      gap: var(--server-stat-row-subcard-subtitle-gap);
      word-wrap: break-word;
      font-weight: bold;
    }
    .subtitle > span:first-child {
      flex-grow: 1;
    }

    @container collapse (max-width: var(--server-stat-row-subcard-container-query-breakpoint)) {
      .subtitle {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--server-stat-row-subcard-subtitle-small-gap);
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
            ? html`<span role="img" aria-label="Icon">${this.icon}</span>`
            : ''}
        </p>
      </article>
    `;
  }
}
