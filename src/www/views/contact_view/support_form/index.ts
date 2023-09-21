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

  private static readonly CloudProviders = new Map([
    ['aws', 'Amazon Web Services'],
    ['digitalocean', 'DigitalOcean'],
    ['gcloud', 'Google Cloud'],
  ]);

  @property({type: String}) type: AppType = AppType.CLIENT;
  @property({type: String}) issueType: IssueType = IssueType.GENERAL;

  private readonly formRef: Ref<HTMLFormElement> = createRef();

  @state() private isFormValid = false;
  @state() private isSubmitting = false;

  /** Checks the entire form's validity state. */
  private checkFormValidity() {
    const fieldNodes = this.formRef.value.querySelectorAll<FormControl>('*[name]');
    this.isFormValid = Array.from(fieldNodes).every(field => field.validity.valid);
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
    this.formRef.value.reset();
    this.isSubmitting = false;
  }

  private get progressBar(): TemplateResult | typeof nothing {
    return this.isSubmitting
      ? html`
          <mwc-linear-progress indeterminate></mwc-linear-progress>
        `
      : nothing;
  }

  private get cloudProviderInputField(): TemplateResult | typeof nothing {
    if (this.type != AppType.MANAGER) {
      return nothing;
    }

    const providers = Array.from(SupportForm.CloudProviders);
    /** We should sort the providers by their labels, which may be localized. */
    providers.sort(([_valueA, labelA], [_valueB, labelB]) => {
      if (labelA < labelB) {
        return -1;
      } else if (labelA == labelB) {
        return 0;
      } else {
        return 1;
      }
    });
    providers.push(['other', 'Other']);

    return html`
      <mwc-select
        name="Cloud_Provider"
        label="Cloud provider"
        helper="Which cloud provider does this relate to?"
        helperPersistent
        disabled="${this.isSubmitting || nothing}"
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

  private get accessKeySourceInputField(): TemplateResult | typeof nothing {
    return this.type == AppType.CLIENT
      ? html`
          <mwc-textfield
            name="Where_did_you_get_your_access_key"
            label="Source"
            helper="Where did you get your access key?"
            helperPersistent
            maxLength="225"
            disabled="${this.isSubmitting || nothing}"
            required
            outlined
            @blur=${this.checkFormValidity}
          ></mwc-textfield>
        `
      : nothing;
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
            disabled="${this.isSubmitting || nothing}"
            required
            outlined
            @blur=${this.checkFormValidity}
          ></mwc-textfield>

          ${this.cloudProviderInputField} ${this.accessKeySourceInputField}

          <mwc-textfield
            name="Subject"
            label="Subject"
            maxLength="225"
            disabled="${this.isSubmitting || nothing}"
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
            disabled="${this.isSubmitting || nothing}"
            required
            outlined
            @blur=${this.checkFormValidity}
          >
          </mwc-textarea>

          <input type="hidden" name="Operating_System" value="TODO" />
          <input type="hidden" name="Outline_Manager_Client_Version" value="TODO" />

          <p>* = Required field</p>

          ${this.progressBar}

          <mwc-button
            label="Submit"
            slot="card-actions"
            disabled="${!this.isFormValid || this.isSubmitting || nothing}"
            @click=${this.submit}
          ></mwc-button>
        </outline-card>
      </form>
    `;
  }
}
