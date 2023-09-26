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

import {html, css, LitElement, TemplateResult, nothing} from 'lit';
import {createRef, Ref, ref} from 'lit/directives/ref.js';
import {live} from 'lit/directives/live.js';
import {customElement, property, state} from 'lit/decorators.js';
import '@material/mwc-button';
import '@material/mwc-select';
import '@material/mwc-textarea';
import '@material/mwc-textfield';
import {CardType} from '../../shared/card';
import {IssueType} from '../issue_type';
import {AppType} from '../app_type';
import {TextField} from '@material/mwc-textfield';
import {SelectedDetail} from '@material/mwc-menu/mwc-menu-base';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Interface for tracking form data. */
export declare interface FormValues {
  email?: string;
  subject?: string;
  description?: string;
  source?: string;
  cloudProvider?: string;
}

@customElement('support-form')
export class SupportForm extends LitElement {
  static styles = [
    css`
      :host {
        font-family: var(--outline-font-family);
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

  private static readonly CLOUD_PROVIDERS = new Map([
    ['aws', 'Amazon Web Services'],
    ['digitalocean', 'DigitalOcean'],
    ['gcloud', 'Google Cloud'],
  ]);
  private static readonly OTHER_CLOUD_PROVIDER: [string, string] = ['other', 'Other'];

  @property({type: Boolean}) disabled = false;
  @property({type: String}) variant: AppType = AppType.CLIENT;
  @property({type: String}) issueType: IssueType = IssueType.GENERAL;

  private readonly formRef: Ref<HTMLFormElement> = createRef();
  @state() private formData: FormValues = {};

  @state() private isFormValid = false;

  /** Checks the entire form's validity state. */
  private checkFormValidity() {
    const fieldNodes = this.formRef.value.querySelectorAll<FormControl>('*[name]');
    this.isFormValid = Array.from(fieldNodes).every(field => field.validity.valid);
  }

  /** Resets the form. */
  reset() {
    this.formData = {};
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

    if (!this.isFormValid) {
      throw Error('Cannot submit invalid form.');
    }

    const event = new CustomEvent<FormValues>('submit', {detail: this.formData});
    this.dispatchEvent(event);
  }

  private get renderCloudProviderInputField(): TemplateResult | typeof nothing {
    if (this.variant !== AppType.MANAGER) return nothing;

    const providers = Array.from(SupportForm.CLOUD_PROVIDERS);
    /** We should sort the providers by their labels, which may be localized. */
    providers.sort(([_valueA, labelA], [_valueB, labelB]) => {
      if (labelA < labelB) {
        return -1;
      } else if (labelA === labelB) {
        return 0;
      } else {
        return 1;
      }
    });
    providers.push(SupportForm.OTHER_CLOUD_PROVIDER);

    return html`
      <mwc-select
        name="Cloud_Provider"
        label="Cloud provider"
        helper="Which cloud provider does this relate to?"
        helperPersistent
        .value=${live(this.formData.cloudProvider ?? '')}
        @selected=${(e: CustomEvent<SelectedDetail<number>>) => {
          if (e.detail.index !== -1) {
            this.formData.cloudProvider = providers[e.detail.index][0];
          }
        }}
        .disabled=${this.disabled}
        required
        outlined
        @blur=${this.checkFormValidity}
      >
        ${providers.map(
          ([value, label]) =>
            html`
              <mwc-list-item value="${value}">${label}</mwc-list-item>
            `
        )}
      </mwc-select>
    `;
  }

  private get renderAccessKeySourceInputField(): TemplateResult | typeof nothing {
    if (this.variant !== AppType.CLIENT) return nothing;

    return html`
      <mwc-textfield
        name="Where_did_you_get_your_access_key"
        label="Source"
        helper="Where did you get your access key?"
        helperPersistent
        .value=${live(this.formData.source ?? '')}
        @input=${(e: Event) => (this.formData.source = (e.target as TextField).value)}
        .maxLength=${SupportForm.DEFAULT_MAX_LENGTH_INPUT}
        .disabled=${this.disabled}
        required
        outlined
        @blur=${this.checkFormValidity}
      ></mwc-textfield>
    `;
  }

  render() {
    return html`
      <form ${ref(this.formRef)} @submit=${this.submit}>
        <outline-card .type=${CardType.Elevated}>
          <mwc-textfield
            name="Email"
            type="email"
            label="Email address"
            helper="Please provide an email address where we can reach you."
            helperPersistent
            .value=${live(this.formData.email ?? '')}
            @input=${(e: Event) => (this.formData.email = (e.target as TextField).value)}
            .maxLength=${SupportForm.DEFAULT_MAX_LENGTH_INPUT}
            autoValidate
            validationMessage="Please provide a correct email address."
            .disabled=${this.disabled}
            required
            outlined
            @blur=${this.checkFormValidity}
          ></mwc-textfield>

          ${this.renderCloudProviderInputField} ${this.renderAccessKeySourceInputField}

          <mwc-textfield
            name="Subject"
            label="Subject"
            .value=${live(this.formData.subject ?? '')}
            @input=${(e: Event) => (this.formData.subject = (e.target as TextField).value)}
            .maxLength=${SupportForm.DEFAULT_MAX_LENGTH_INPUT}
            .disabled=${this.disabled}
            required
            outlined
            @blur=${this.checkFormValidity}
          ></mwc-textfield>
          <mwc-textarea
            name="Description"
            label="Description"
            helper="Please provide a detailed description of your issue."
            helperPersistent
            .value=${live(this.formData.description ?? '')}
            @input=${(e: Event) => (this.formData.description = (e.target as TextField).value)}
            rows="5"
            .maxLength=${SupportForm.MAX_LENGTH_DESCRIPTION}
            .disabled=${this.disabled}
            required
            outlined
            @blur=${this.checkFormValidity}
          >
          </mwc-textarea>

          <input type="hidden" name="Operating_System" value="TODO" />
          <input type="hidden" name="Outline_Manager_Client_Version" value="TODO" />

          <p>* = Required field</p>

          <span slot="card-actions">
            <mwc-button label="Cancel" .disabled=${this.disabled} @click=${this.cancel}></mwc-button>
            <mwc-button
              type="submit"
              label="Submit"
              .disabled=${!this.isFormValid || this.disabled}
              @click=${this.submit}
            ></mwc-button>
          </span>
        </outline-card>
      </form>
    `;
  }
}
