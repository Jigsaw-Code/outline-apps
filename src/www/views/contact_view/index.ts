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
import {customElement, property, state} from 'lit/decorators.js';
import {Ref, createRef, ref} from 'lit/directives/ref.js';
import '@material/mwc-circular-progress';
import '@material/mwc-radio';
import '@material/mwc-select';
import '@material/mwc-formfield';
import {Radio} from '@material/mwc-radio';
import {SingleSelectedEvent} from '@material/mwc-list/mwc-list';

import './support_form';
import {CardType} from '../shared/card';
import {IssueType} from './issue_type';
import {AppType} from './app_type';
import {FormValues, SupportForm} from './support_form';

/** The possible steps in the stepper. Only one step is shown at a time. */
enum Step {
  ISSUE_WIZARD, // Step to ask for their specific issue.
  FORM, // The contact form.
  EXIT, // Final message to show, if any.
}

@customElement('contact-view')
export class ContactView extends LitElement {
  static styles = [
    css`
      :host {
        display: block;
        font-family: var(--outline-font-family);
        padding: var(--outline-gutter);
      }

      mwc-circular-progress {
        left: 50%;
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
      }

      ol {
        list-style-type: none;
      }

      mwc-select {
        width: 100%;
      }

      mwc-select[hidden] {
        display: none;
      }

      mwc-list-item {
        /**
         * The default styling of list items that wrap to 3+ lines is bad, and
         * our items here are quite long and tend to wrap that much. To allow
         * all lines to take up as much space as they can, we set the height to
         * "auto", with a min-height of what the height would have been, which
         * defaults to "48px" (https://www.npmjs.com/package/@material/mwc-menu#css-custom-properties).
         */
        min-height: 48px;
        --mdc-menu-item-height: auto;
        padding-bottom: var(--outline-mini-gutter);
        padding-top: var(--outline-mini-gutter);
      }

      mwc-list-item span {
        white-space: normal;
      }
    }
    `,
  ];

  private static readonly Issues = new Map([
    [IssueType.INSTALLATION, 'I am having trouble installing Outline'],
    [IssueType.REQUIRE_ACCESS_KEY, 'I need an access key'],
    [IssueType.ADDING_SERVER, 'I am having trouble adding a server using my access key'],
    [IssueType.CONNECTING, 'I am having trouble connecting to my Outline VPN server'],
    [IssueType.MANAGING, 'I need assistance managing my Outline VPN server or helping others connect to it'],
    [IssueType.INTERNET_SPEED, 'My internet access is slow while connected to my Outline VPN server'],
    [IssueType.GENERAL, 'General feedback & suggestions'],
  ]);

  @property({type: String}) variant: AppType = AppType.CLIENT;

  @state() private step: Step = Step.ISSUE_WIZARD;
  private selectedIssueType?: IssueType;
  private exitTemplate?: TemplateResult;

  private readonly openTicketSelectionOptions: Array<{
    ref: Ref<Radio>;
    value: boolean;
    label: string;
  }> = [
    {
      ref: createRef(),
      value: true,
      label: 'Yes',
    },
    {
      ref: createRef(),
      value: false,
      label: 'No',
    },
  ];

  @state() private showIssueSelector = false;
  private readonly formRef: Ref<SupportForm> = createRef();
  @state() private isFormSubmitting = false;

  private selectHasOpenTicket(e: InputEvent) {
    const radio = e.target as Radio;
    const hasOpenTicket = radio.value;
    if (hasOpenTicket) {
      this.exitTemplate = html`
        We are currently experiencing high support volume and appreciate your patience. Please do not submit a new
        request for this concern. If you have additional information to provide, please reply to the initial email about
        this request.
      `;
      this.step = Step.EXIT;
      return;
    }
    this.openTicketSelectionOptions.forEach(element => {
      element.ref.value.disabled = true;
    });
    this.showIssueSelector = true;
  }

  private selectIssue(e: SingleSelectedEvent) {
    this.selectedIssueType = Array.from(ContactView.Issues.keys())[e.detail.index];
    switch (this.selectedIssueType) {
      case IssueType.INSTALLATION:
      case IssueType.MANAGING:
      case IssueType.INTERNET_SPEED:
      case IssueType.GENERAL:
        this.step = Step.FORM;
        break;
      case IssueType.REQUIRE_ACCESS_KEY:
        // TODO: Send users to localized support pages based on chosen language.
        this.exitTemplate = html`
          The Outline team does not distribute free or paid access keys.
          <a href="https://support.getoutline.org/s/article/How-do-I-get-an-access-key" target="_blank">
            Learn more about how to get an access key.
          </a>
        `;
        this.step = Step.EXIT;
        break;
      case IssueType.ADDING_SERVER:
        this.exitTemplate = html`
          The Outline team is not able to assist with adding a server. Please try the troubleshooting steps listed
          <a href="https://support.getoutline.org/s/article/What-if-my-access-key-doesn-t-work" target="_blank">
            here
          </a>
          and then contact the person who gave you the access key to troubleshoot this issue.
        `;
        this.step = Step.EXIT;
        break;
      case IssueType.CONNECTING:
        this.exitTemplate = html`
          The Outline team is not able to assist with connecting to a server. Please try the troubleshooting steps
          listed
          <a href="https://support.getoutline.org/s/article/Why-can-t-I-connect-to-the-Outline-service" target="_blank">
            here
          </a>
          and then contact the person who gave you the access key to troubleshoot this issue.
        `;
        this.step = Step.EXIT;
        break;
      default:
        throw Error('Unexpected issue found');
    }
  }

  private reset() {
    this.showIssueSelector = false;
    this.step = Step.ISSUE_WIZARD;
    this.formRef.value.reset();
  }

  private submitForm(e: CustomEvent) {
    this.isFormSubmitting = true;

    const formData: FormValues = e.detail;
    // TODO: Actually send the form data using the error reporter.
    console.log('Submitting form data...', formData);

    this.isFormSubmitting = false;
    this.exitTemplate = html`
      Thanks for helping us improve! We love hearing from you.
    `;
    this.step = Step.EXIT;
  }

  private get renderIntroTemplate(): TemplateResult {
    return html`
      <p>
        Tell us how we can help. Please do not enter personal information that is not requested below.
      </p>
    `;
  }

  private get renderForm(): TemplateResult | typeof nothing {
    if (this.isFormSubmitting) {
      return html`
        <mwc-circular-progress indeterminate></mwc-linear-progress>
      `;
    }
    return html`
      <support-form
        ${ref(this.formRef)}
        .variant=${this.variant}
        .issueType=${this.selectedIssueType}
        .disabled=${this.isFormSubmitting}
        @cancel=${this.reset}
        @submit=${this.submitForm}
      ></support-form>
    `;
  }

  render() {
    switch (this.step) {
      case Step.FORM: {
        return html`
          ${this.renderIntroTemplate} ${this.renderForm}
        `;
      }

      case Step.EXIT: {
        return html`
          <outline-card .type=${CardType.Elevated}>
            ${this.exitTemplate}
          </outline-card>
        `;
      }

      case Step.ISSUE_WIZARD:
      default: {
        return html`
          ${this.renderIntroTemplate}
          <p>Do you have an open ticket for this issue?</p>

          <ol>
            ${this.openTicketSelectionOptions.map(
              element =>
                html`
                  <li>
                    <mwc-formfield label=${element.label}>
                      <mwc-radio
                        name="open-ticket"
                        .value="${element.value}"
                        required
                        @change=${this.selectHasOpenTicket}
                        ${ref(element.ref)}
                      >
                      </mwc-radio>
                    </mwc-formfield>
                  </li>
                `
            )}
          </ol>

          <mwc-select
            label="Outline issue"
            helper="What issue are you contacting us about?"
            helperPersistent
            outlined
            ?hidden=${!this.showIssueSelector}
            @selected="${this.selectIssue}"
          >
            ${Array.from(ContactView.Issues).map(([value, label]) => {
              return html`
                <mwc-list-item value="${value}">
                  <span>${label}</span>
                </mwc-list-item>
              `;
            })}
          </mwc-select>
        `;
      }
    }
  }
}
