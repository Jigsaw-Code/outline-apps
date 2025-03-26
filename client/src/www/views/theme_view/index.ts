/*
 * Copyright 2024 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {LitElement, html, css, nothing} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {ThemePreference} from '../../app/settings';

export type ThemeDef = {
  id: ThemePreference;
  name: string;
  icon: string;
};

@customElement('theme-view')
export class ThemeView extends LitElement {
  @property({type: Array}) themes: ThemeDef[] = [
    {id: ThemePreference.SYSTEM, name: 'System', icon: 'brightness_auto'},
    {id: ThemePreference.LIGHT, name: 'Light', icon: 'light_mode'},
    {id: ThemePreference.DARK, name: 'Dark', icon: 'dark_mode'},
  ];
  @property({type: String}) selectedThemeId: string = ThemePreference.SYSTEM;
  @property({type: Object}) localize: (key: string) => string = msg => msg;

  // Set the theme names using localization
  connectedCallback() {
    super.connectedCallback();
    // Update theme names with localized strings
    this.themes = [
      {
        id: ThemePreference.SYSTEM,
        name: this.localize('theme-system') || "System",
        icon: 'brightness_auto',
      },
      {
        id: ThemePreference.LIGHT,
        name: this.localize('theme-light') || "Light",
        icon: 'light_mode',
      },
      {
        id: ThemePreference.DARK,
        name: this.localize('theme-dark') || "Dark",
        icon: 'dark_mode',
      },
    ];
  }

  static styles = css`
    :host {
      height: 100%;
      width: 100%;
      background-color: var(--outline-card-background);
      color: var(--outline-text-color);
      display: block;
    }

    md-list {
      background-color: var(--outline-card-background);
      --md-list-container-color: var(--outline-card-background);
      color: var(--outline-text-color);
      padding: 8px 0;
    }

    md-list-item {
      cursor: pointer;
      position: relative;
      --md-list-item-label-text-color: var(--outline-text-color);
      --md-list-item-headline-color: var(--outline-text-color);
      --md-list-item-supporting-text-color: var(--outline-text-color);
      color: var(--outline-text-color) !important;
      margin: 4px 0;
    }

    /* Important direct override for theme text - needed for dark mode */
    md-list-item span,
    md-list-item div,
    md-list-item::before,
    md-list-item::after {
      color: var(--outline-text-color) !important;
    }

    md-list-item.selected {
      --md-list-item-label-text-color: var(--outline-primary);
      --md-list-item-headline-color: var(--outline-primary);
      background-color: rgba(var(--outline-primary-rgb, 0, 0, 0), 0.1);
    }

    md-list-item.selected md-icon {
      color: var(--outline-primary);
    }

    md-icon {
      color: var(--outline-text-color);
      font-size: 24px;
    }

    /* Explicitly set text color for list items */
    md-list-item::part(label),
    md-list-item::part(supporting-text),
    md-list-item::part(headline) {
      color: var(--outline-text-color);
    }

    md-list-item.selected::part(label),
    md-list-item.selected::part(supporting-text),
    md-list-item.selected::part(headline) {
      color: var(--outline-primary);
    }

    /* Override Material Web styling to ensure proper text visibility */
    ::slotted(*) {
      color: var(--outline-text-color) !important;
    }
  `;

  render() {
    return html`
      <md-list>
        ${this.themes.map(
          ({id, name, icon}) => html`
            <md-list-item
              class=${classMap({selected: this.selectedThemeId === id})}
              data-value="${id}"
              @click="${this.handleThemeSelection}"
              style="color: var(--outline-text-color) !important;"
            >
              <md-icon
                slot="start"
                style="color: ${this.selectedThemeId === id
                  ? 'var(--outline-primary)'
                  : 'var(--outline-text-color)'} !important;"
                >${icon}</md-icon
              >
              <md-ripple></md-ripple>
              <span style="color: var(--outline-text-color) !important;"
                >${name}</span
              >
              ${this.selectedThemeId === id
                ? html`<md-icon
                    slot="end"
                    style="color: var(--outline-primary) !important;"
                    >check</md-icon
                  >`
                : nothing}
            </md-list-item>
          `
        )}
      </md-list>
    `;
  }

  private handleThemeSelection({target}: Event) {
    const element = target as HTMLElement;
    const closestListItem = element.closest('md-list-item');

    if (closestListItem) {
      const themeValue = closestListItem.getAttribute('data-value');
      if (themeValue) {
        this.selectedThemeId = themeValue;
        this.dispatchEvent(
          new CustomEvent('SetThemeRequested', {
            bubbles: true,
            composed: true,
            detail: {
              themePreference: themeValue,
            },
          })
        );
      }
    }
  }
}
