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
import {customElement, property} from 'lit/decorators.js';
import '@material/mwc-button';
import '@material/mwc-select';
import '@material/mwc-textarea';
import '@material/mwc-textfield';
import {CardType} from '../../shared/card';
import {IssueType} from '../issue_type';
import {AppType} from '../app_type';

@customElement('support-form')
export class SupportForm extends LitElement {
  static styles = [
    css`
      :host {
        font-family: var(--outline-font-family);
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

  @property() localize: (messageID: string) => string;
  @property({type: String}) type: AppType = AppType.CLIENT;
  @property({type: String}) issueType: IssueType = IssueType.GENERAL;

  private submit(e: SubmitEvent) {
    e.preventDefault();

    // TODO: Send form.

    const event = new CustomEvent<boolean>('submit', {detail: true});
    this.dispatchEvent(event);
  }
  get cloudProviderInputField(): TemplateResult | typeof nothing {
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
        label="Cloud provider"
        helper="Which cloud provider does this relate to?"
        helperPersistent
        required
        outlined
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

  get accessKeySourceInputField(): TemplateResult | typeof nothing {
    return this.type == AppType.CLIENT
      ? html`
          <mwc-textfield
            id="access_key_source"
            label="Source"
            helper="Where did you get your access key?"
            helperPersistent
            maxLength="225"
            required
            outlined
          ></mwc-textfield>
        `
      : nothing;
  }

  render() {
    return html`
      <form @submit=${this.submit}>
        <outline-card .type=${CardType.Elevated}>
          <mwc-textfield
            id="email"
            type="email"
            label="Email address"
            maxLength="225"
            helper="Please provide an email address where we can reach you."
            helperPersistent
            autoValidate
            validationMessage="Please provide a correct email address."
            required
            outlined
          ></mwc-textfield>

          ${this.cloudProviderInputField} ${this.accessKeySourceInputField}

          <mwc-textfield id="subject" label="Subject" maxLength="225" required outlined></mwc-textfield>
          <mwc-textarea
            id="description"
            label="Description"
            helper="Please provide a detailed description of your issue."
            helperPersistent
            rows="5"
            maxLength="131072"
            charCounter
            required
            outlined
          >
          </mwc-textarea>

          <input type="hidden" id="os" name="os" value="TODO" />
          <input type="hidden" id="version" name="version" value="TODO" />

          <p>* = Required field</p>

          <mwc-button label="Submit" slot="card-actions" @click=${this.submit}></mwc-button>
        </outline-card>
      </form>
    `;
  }
}
