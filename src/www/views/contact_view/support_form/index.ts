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

import {html, css, LitElement, TemplateResult, nothing, PropertyValues} from 'lit';
import {createRef, Ref, ref} from 'lit/directives/ref.js';
import {live} from 'lit/directives/live.js';
import {customElement, property, state} from 'lit/decorators.js';
import '@material/mwc-button';
import '@material/mwc-select';
import '@material/mwc-textarea';
import '@material/mwc-textfield';
import {CardType} from '../../shared/card';
import {AppType} from '../app_type';
import {TextField} from '@material/mwc-textfield';
import {SelectedDetail} from '@material/mwc-menu/mwc-menu-base';
import {Localizer} from 'src/infrastructure/i18n';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Interface for tracking form data. */
export declare interface FormValues {
  email?: string;
  subject?: string;
  description?: string;
  accessKeySource?: string;
  cloudProvider?: string;
}

/** Interface for valid form data. */
export declare interface ValidFormValues extends FormValues {
  email: string;
  subject: string;
  description: string;
}

declare interface CloudProviderOption {
  value: string;
  label: string;
}

@customElement('support-form')
export class SupportForm extends LitElement {
  static styles = [
    css`
      :host {
        font-family: var(--outline-font-family);
      }

      outline-card {
        min-width: 100%;
      }

      mwc-select {
        width: 100%;
      }

      mwc-textarea,
      mwc-textfield {
        display: flex;
        margin: var(--outline-slim-gutter) 0;
      }

      p {
        color: var(--outline-label-color);
        font-size: 0.8rem;
        text-align: end;
      }
    `,
  ];

  /** The default maximum character length of input fields. */
  private static readonly DEFAULT_MAX_LENGTH_INPUT = 225;
  /** The maximum character length of the "Description" field. */
  private static readonly MAX_LENGTH_DESCRIPTION = 131072;

  private static readonly CLOUD_PROVIDERS = ['aws', 'digitalocean', 'gcloud'];

  @property({type: Function}) localize: Localizer = msg => msg;
  @property({type: Boolean}) disabled = false;
  @property({type: String}) variant: AppType = AppType.CLIENT;
  @property({type: Object}) values: FormValues = {};

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
    const fieldNodes = this.formRef.value.querySelectorAll<FormControl>('*[name]');
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

  private handleTextInput(e: Event) {
    const key: keyof FormValues = (e.target as TextField).name as keyof FormValues;
    const value = (e.target as TextField).value;
    this.values[key] = value;
    this.checkFormValidity();
  }

  private get renderCloudProviderInputField(): TemplateResult | typeof nothing {
    if (this.variant !== AppType.MANAGER) return nothing;

    const providers = SupportForm.CLOUD_PROVIDERS.map((provider): CloudProviderOption => {
      return {value: provider, label: this.localize(`support-form-cloud-provider-${provider}`)};
    });
    /** We should sort the providers by their labels, which may be localized. */
    providers.sort(({label: labelA}, {label: labelB}) => {
      if (labelA < labelB) {
        return -1;
      } else if (labelA === labelB) {
        return 0;
      } else {
        return 1;
      }
    });
    providers.push({value: 'other', label: this.localize('support-form-cloud-provider-other')});

    return html`
      <mwc-select
        name="cloudProvider"
        .label=${this.localize('support-form-cloud-provider')}
        .value=${live(this.values.cloudProvider ?? '')}
        .disabled=${this.disabled}
        required
        outlined
        @selected=${(e: CustomEvent<SelectedDetail<number>>) => {
          if (e.detail.index !== -1) {
            this.values.cloudProvider = providers[e.detail.index].value;
          }
        }}
        @blur=${this.checkFormValidity}
      >
        ${providers.map(({value, label}) => html` <mwc-list-item value="${value}">${label}</mwc-list-item> `)}
      </mwc-select>
    `;
  }

  private get renderAccessKeySourceInputField(): TemplateResult | typeof nothing {
    if (this.variant !== AppType.CLIENT) return nothing;

    return html`
      <mwc-textfield
        name="accessKeySource"
        .label=${this.localize('support-form-access-key-source')}
        .value=${live(this.values.accessKeySource ?? '')}
        .maxLength=${SupportForm.DEFAULT_MAX_LENGTH_INPUT}
        .disabled=${this.disabled}
        required
        outlined
        @input=${this.handleTextInput}
        @blur=${this.checkFormValidity}
      ></mwc-textfield>
    `;
  }

  render() {
    return html`
      <form ${ref(this.formRef)} @submit=${this.submit}>
        <outline-card .type=${CardType.Elevated}>
          <mwc-textfield
            name="email"
            type="email"
            .label=${this.localize('support-form-email')}
            .value=${live(this.values.email ?? '')}
            .maxLength=${SupportForm.DEFAULT_MAX_LENGTH_INPUT}
            autoValidate
            .validationMessage=${this.localize('support-form-email-invalid')}
            .disabled=${this.disabled}
            required
            outlined
            @input=${this.handleTextInput}
            @blur=${this.checkFormValidity}
          ></mwc-textfield>

          ${this.renderCloudProviderInputField} ${this.renderAccessKeySourceInputField}

          <mwc-textfield
            name="subject"
            .label=${this.localize('support-form-subject')}
            .value=${live(this.values.subject ?? '')}
            .maxLength=${SupportForm.DEFAULT_MAX_LENGTH_INPUT}
            .disabled=${this.disabled}
            required
            outlined
            @input=${this.handleTextInput}
            @blur=${this.checkFormValidity}
          ></mwc-textfield>
          <mwc-textarea
            name="description"
            .label=${this.localize('support-form-description')}
            .value=${live(this.values.description ?? '')}
            rows="5"
            .maxLength=${SupportForm.MAX_LENGTH_DESCRIPTION}
            .disabled=${this.disabled}
            required
            outlined
            @input=${this.handleTextInput}
            @blur=${this.checkFormValidity}
          >
          </mwc-textarea>

          <p>* = ${this.localize('support-form-required-field')}</p>

          <span slot="card-actions">
            <mwc-button .label=${this.localize('cancel')} .disabled=${this.disabled} @click=${this.cancel}></mwc-button>
            <mwc-button
              type="submit"
              .label=${this.localize('submit')}
              .disabled=${!this.valid || this.disabled}
              @click=${this.submit}
            ></mwc-button>
          </span>
        </outline-card>
      </form>
    `;
  }
}
