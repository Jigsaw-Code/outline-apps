import {html, css, LitElement, unsafeCSS} from 'lit';
import {customElement, property, queryAssignedNodes, state} from 'lit/decorators.js';

/** The card style types available. */
export enum CardType {
  Elevated = 'elevated',
  Outlined = 'outlined',
}

@customElement('outline-card')
export class Card extends LitElement {
  static styles = [
    css`
      :host {
        display: inline-block;
        font-family: var(--outline-font-family);
      }

      :host([type='${unsafeCSS(CardType.Elevated)}']) {
        background: var(--outline-card-background);
        border-radius: var(--outline-corner);
        box-shadow: var(--outline-elevation);
      }

      :host([type='${unsafeCSS(CardType.Outlined)}']) {
        border: var(--outline-hairline);
      }

      article {
        padding: var(--outline-gutter);
      }

      footer {
        background: var(--outline-card-footer);
        border-top: var(--outline-hairline);
        box-sizing: border-box;
        padding: var(--outline-mini-gutter) var(--outline-gutter);
        text-align: end;
      }
    `,
  ];

  @property({type: String, reflect: true})
  type: CardType = CardType.Outlined;

  @queryAssignedNodes({slot: 'card-actions', flatten: true})
  private cardActionItems!: Array<Node>;

  @state()
  private hasActions = false;

  private onCardActionsSlotChange() {
    this.hasActions = !!this.cardActionItems.length;
  }

  render() {
    return html`
      <article>
        <slot></slot>
      </article>
      <footer ?hidden=${!this.hasActions}>
        <slot name="card-actions" @slotchange=${this.onCardActionsSlotChange}></slot>
      </footer>
    `;
  }
}
