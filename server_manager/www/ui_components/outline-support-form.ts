/**
 * Copyright 2023 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import '@material/mwc-button';
import '@material/mwc-select';
import '@material/mwc-textarea';
import '@material/mwc-textfield';
import {SelectedDetail} from '@material/mwc-menu/mwc-menu-base';
import {TextArea} from '@material/mwc-textarea';
import {TextField} from '@material/mwc-textfield';
import '@material/web/checkbox/checkbox';
import {MdCheckbox} from '@material/web/checkbox/checkbox';

import {Localizer} from '@outline/infrastructure/i18n';
import {html, css, LitElement, PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {live} from 'lit/directives/live.js';
import {createRef, Ref, ref} from 'lit/directives/ref.js';

import {COMMON_STYLES} from './cloud-install-styles';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Interface for tracking form data. */
export declare interface FormValues {
  email: string;
  subject: string;
  description: string;
  cloudProvider: string;
  outreachConsent: boolean;
}

declare interface CloudProviderOption {
  value: string;
  label: string;
}

@customElement('outline-support-form')
export class OutlineSupportForm extends LitElement {
  static styles = [
    COMMON_STYLES,
    css`
      :host {
        --mdc-theme-primary: var(--primary-green);
        --md-sys-color-primary: var(--primary-green);
        --md-sys-color-on-surface-variant: rgba(0, 0, 0, 0.54);
      }

      mwc-select {
        width: 100%;
      }

      mwc-textarea,
      mwc-textfield {
        display: flex;
        margin: 0.75rem 0;
      }

      label {
        align-items: center;
        color: hsl(0, 0%, 45%);
        display: inline-flex;
      }

      label md-checkbox {
        flex-shrink: 0;
      }

      p {
        color: hsl(0, 0%, 45%);
        font-size: 0.8rem;
        text-align: end;
      }

      .actions {
        display: flex;
        justify-content: end;
      }
    `,
  ];

  /** The default maximum character length of input fields. */
  private static readonly DEFAULT_MAX_LENGTH_INPUT = 225;
  /** The maximum character length of the "Description" field. */
  private static readonly MAX_LENGTH_DESCRIPTION = 131072;
  /** The number of visible text lines for the "Description" field. */
  private static readonly MAX_ROWS_DESCRIPTION = 8;

  private static readonly CLOUD_PROVIDERS = ['aws', 'digitalocean', 'gcloud'];

  @property({type: Function}) localize: Localizer = msg => msg;
  @property({type: Boolean}) disabled = false;
  @property({type: Object}) values: Partial<FormValues> = {};

  private readonly formRef: Ref<HTMLFormElement> = createRef();
  @state() valid = false;

  override updated(changedProperties: PropertyValues<this>) {
    super.updated(changedProperties);

    if (changedProperties.has('values')) {
      queueMicrotask(() => this.checkFormValidity());
    }
  }

  /** Checks the entire form's validity state. */
  private checkFormValidity() {
    const fieldNodes =
      this.formRef.value.querySelectorAll<FormControl>('*[name]');
    this.valid = Array.from(fieldNodes).every(field => field.validity.valid);
  }

  /** Cancels the form. */
  private cancel(e: PointerEvent) {
    e.stopPropagation();

    const event = new CustomEvent<boolean>('cancel', {detail: true});
    this.dispatchEvent(event);
  }

  /** Submits the form. */
  private submit(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();

    const event = new CustomEvent<boolean>('submit', {detail: true});
    this.dispatchEvent(event);
  }

  private handleInput(e: InputEvent) {
    const target = e.target as HTMLInputElement;
    const key = target.name as keyof FormValues;
    if (target instanceof TextField || target instanceof TextArea) {
      const key = target.name as keyof FormValues;
      const {value} = target;
      (this.values as Record<string, string>)[key] = value;
    } else if (target instanceof MdCheckbox) {
      const {checked: value} = target as MdCheckbox;
      (this.values as Record<string, boolean>)[key] = value;
    } else {
      throw new Error(`Cannot handle unknown form field: ${key}`);
    }
    this.checkFormValidity();
  }

  render() {
    const providers = OutlineSupportForm.CLOUD_PROVIDERS.map(
      (provider): CloudProviderOption => {
        return {
          value: provider,
          label: this.localize(`support-form-cloud-provider-${provider}`),
        };
      }
    );
    /** We should sort the providers by their labels, which may be localized. */
    providers.sort((a, b) => a.label.localeCompare(b.label));
    providers.push({value: 'other', label: this.localize('feedback-other')});

    return html`
      <form ${ref(this.formRef)} @submit=${this.submit}>
        <mwc-textfield
          name="email"
          type="email"
          .label=${this.localize('support-form-email')}
          .value=${live(this.values.email ?? '')}
          .maxLength=${OutlineSupportForm.DEFAULT_MAX_LENGTH_INPUT}
          autoValidate
          .validationMessage=${this.localize('support-form-email-invalid')}
          .disabled=${this.disabled}
          required
          @input=${this.handleInput}
          @blur=${this.checkFormValidity}
        ></mwc-textfield>

        <mwc-select
          name="cloudProvider"
          .label=${this.localize('support-form-cloud-provider')}
          .value=${live(this.values.cloudProvider ?? '')}
          .disabled=${this.disabled}
          required
          @selected=${(e: CustomEvent<SelectedDetail<number>>) => {
            if (e.detail.index !== -1) {
              this.values.cloudProvider = providers[e.detail.index].value;
            }
          }}
          @blur=${this.checkFormValidity}
        >
          ${providers.map(
            ({value, label}) => html`
              <mwc-list-item value="${value}">${label}</mwc-list-item>
            `
          )}
        </mwc-select>

        <mwc-textfield
          name="subject"
          .label=${this.localize('support-form-subject')}
          .value=${live(this.values.subject ?? '')}
          .maxLength=${OutlineSupportForm.DEFAULT_MAX_LENGTH_INPUT}
          .disabled=${this.disabled}
          required
          @input=${this.handleInput}
          @blur=${this.checkFormValidity}
        ></mwc-textfield>
        <mwc-textarea
          name="description"
          .label=${this.localize('support-form-description')}
          .value=${live(this.values.description ?? '')}
          .rows=${OutlineSupportForm.MAX_ROWS_DESCRIPTION}
          .maxLength=${OutlineSupportForm.MAX_LENGTH_DESCRIPTION}
          .disabled=${this.disabled}
          required
          @input=${this.handleInput}
          @blur=${this.checkFormValidity}
        >
        </mwc-textarea>

        <label>
          <md-checkbox
            touch-target="wrapper"
            name="outreachConsent"
            .value=${live(this.values.outreachConsent ?? false)}
            @input=${this.handleInput}
          ></md-checkbox>
          ${this.localize('support-form-outreach-consent')}
        </label>

        <p>* = ${this.localize('support-form-required-field')}</p>

        <span class="actions">
          <mwc-button
            .label=${this.localize('cancel')}
            .disabled=${this.disabled}
            @click=${this.cancel}
          ></mwc-button>
          <mwc-button
            type="submit"
            .label=${this.localize('feedback-submit')}
            .disabled=${!this.valid || this.disabled}
            @click=${this.submit}
          ></mwc-button>
        </span>
      </form>
    `;
  }
}
