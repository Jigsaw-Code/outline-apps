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
import {customElement, property, state} from 'lit/decorators.js';
import '@material/mwc-button';
import '@material/mwc-linear-progress';
import '@material/mwc-select';
import '@material/mwc-textarea';
import '@material/mwc-textfield';
import {CardType} from '../../shared/card';
import {IssueType} from '../issue_type';
import {AppType} from '../app_type';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

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

  private static readonly CLOUD_PROVIDERS = new Map([
    ['aws', 'Amazon Web Services'],
    ['digitalocean', 'DigitalOcean'],
    ['gcloud', 'Google Cloud'],
  ]);
  private static readonly OTHER_CLOUD_PROVIDER: [string, string] = ['other', 'Other'];

  @property({type: String}) variant: AppType = AppType.CLIENT;
  @property({type: String}) issueType: IssueType = IssueType.GENERAL;

  private readonly formRef: Ref<HTMLFormElement> = createRef();

  @state() private isFormValid = false;
  @state() private isSubmitting = false;

  /** Checks the entire form's validity state. */
  private checkFormValidity() {
    const fieldNodes = this.formRef.value.querySelectorAll<FormControl>('*[name]');
    this.isFormValid = Array.from(fieldNodes).every(field => field.validity.valid);
  }

  /** Resets the form. */
  private reset() {
    this.formRef.value.reset();
  }

  /** Cancels the form. */
  private cancel() {
    this.reset();
    const event = new CustomEvent<boolean>('cancel', {detail: true});
    this.dispatchEvent(event);
  }

  /** Submits the form. */
  private submit(e: SubmitEvent) {
    e.preventDefault();

    if (!this.isFormValid) {
      throw Error('Cannot submit invalid form.');
    }

    this.isSubmitting = true;
    // TODO: Actually send the form data using the error reporter.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const formData = new FormData(this.formRef.value);
    console.log('Submitting form data...');

    const event = new CustomEvent<boolean>('submit', {detail: true});
    this.dispatchEvent(event);
    this.reset();
    this.isSubmitting = false;
  }

  private get renderProgressBar(): TemplateResult | typeof nothing {
    return this.isSubmitting
      ? html`
          <mwc-linear-progress indeterminate></mwc-linear-progress>
        `
      : nothing;
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
        .disabled="${this.isSubmitting}"
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
        maxLength="225"
        .disabled="${this.isSubmitting}"
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
            maxLength="225"
            helper="Please provide an email address where we can reach you."
            helperPersistent
            autoValidate
            validationMessage="Please provide a correct email address."
            .disabled="${this.isSubmitting}"
            required
            outlined
            @blur=${this.checkFormValidity}
          ></mwc-textfield>

          ${this.renderCloudProviderInputField} ${this.renderAccessKeySourceInputField}

          <mwc-textfield
            name="Subject"
            label="Subject"
            maxLength="225"
            .disabled="${this.isSubmitting}"
            required
            outlined
            @blur=${this.checkFormValidity}
          ></mwc-textfield>
          <mwc-textarea
            name="Description"
            label="Description"
            helper="Please provide a detailed description of your issue."
            helperPersistent
            rows="5"
            maxLength="131072"
            charCounter
            .disabled="${this.isSubmitting}"
            required
            outlined
            @blur=${this.checkFormValidity}
          >
          </mwc-textarea>

          <input type="hidden" name="Operating_System" value="TODO" />
          <input type="hidden" name="Outline_Manager_Client_Version" value="TODO" />

          <p>* = Required field</p>

          ${this.renderProgressBar}

          <span slot="card-actions">
            <mwc-button label="Cancel" .disabled="${this.isSubmitting}" @click=${this.cancel}></mwc-button>
            <mwc-button
              label="Submit"
              .disabled="${!this.isFormValid || this.isSubmitting}"
              @click=${this.submit}
            ></mwc-button>
          </span>
        </outline-card>
      </form>
    `;
  }
}