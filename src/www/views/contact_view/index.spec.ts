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

import {ContactView} from './index';

import {fixture, html, nextFrame} from '@open-wc/testing';
import {SupportForm} from './support_form';

describe('ContactView', () => {
  let el: ContactView;

  beforeEach(async () => {
    el = await fixture(html` <contact-view></contact-view> `);
  });

  it('is defined', async () => {
    expect(el).toBeInstanceOf(ContactView);
  });

  it('hides issue selector by default', async () => {
    const issueSelector = el.shadowRoot?.querySelector('mwc-select[label="Outline issue"]');
    expect(issueSelector?.hasAttribute('hidden')).toBeTrue();
  });

  it('hides support form by default', async () => {
    const supportForm = el.shadowRoot?.querySelector('support-form');
    expect(supportForm).toBeNull();
  });

  it('shows exit message if the user selects that they have an open ticket', async () => {
    const radioButton = el.shadowRoot!.querySelector('mwc-formfield[label="Yes"] mwc-radio')! as HTMLElement;
    radioButton.click();
    await nextFrame();

    const exitCard = el.shadowRoot!.querySelector('outline-card')!;
    expect(exitCard.textContent).toContain('experiencing high support volume');
  });

  it('shows issue selector if the user selects that they have no open tickets', async () => {
    const radioButton = el.shadowRoot!.querySelector('mwc-formfield[label="No"] mwc-radio')! as HTMLElement;
    radioButton.click();
    await nextFrame();

    const issueSelector = el.shadowRoot!.querySelector('mwc-select[label="Outline issue"]');
    expect(issueSelector?.hasAttribute('hidden')).toBeFalse();
  });

  describe('when the user selects issue', () => {
    let issueSelector: HTMLElement;

    beforeEach(async () => {
      issueSelector = el.shadowRoot!.querySelector('mwc-select[label="Outline issue"]')!;
      const radioButton: HTMLElement = el.shadowRoot!.querySelector('mwc-formfield[label="No"] mwc-radio')!;
      radioButton.click();
      await nextFrame();
    });

    const conditions = [
      {
        testcaseName: 'I need an access key',
        value: 'require_access_key',
        expectedMsg: 'does not distribute free or paid access keys',
      },
      {
        testcaseName: 'I am having trouble adding a server using my access key',
        value: 'adding_server',
        expectedMsg: 'assist with adding a server',
      },
      {
        testcaseName: 'I am having trouble connecting to my Outline VPN server',
        value: 'connecting',
        expectedMsg: 'assist with connecting to a server',
      },
    ];

    for (const {testcaseName, value, expectedMsg} of conditions) {
      it(`'${testcaseName}' shows exit message`, async () => {
        const issue: HTMLElement = issueSelector.querySelector(`mwc-list-item[value="${value}"]`)!;
        issue.click();
        await nextFrame();

        const exitCard = el.shadowRoot!.querySelector('outline-card')!;
        expect(exitCard.textContent).toContain(expectedMsg);
      });
    }

    describe('"General feedback & suggestions"', () => {
      beforeEach(async () => {
        const issue: HTMLElement = issueSelector.querySelector('mwc-list-item[value="general"]')!;
        issue.click();
        await nextFrame();
      });

      it('shows support form', async () => {
        const supportForm = el.shadowRoot!.querySelector('support-form')!;
        expect(supportForm).not.toBeNull();
      });

      it('shows "thank you" exit message on completion of support form', async () => {
        const supportForm: SupportForm = el.shadowRoot!.querySelector('support-form')!;
        supportForm.valid = true;
        supportForm.dispatchEvent(new CustomEvent('submit'));

        await nextFrame();

        const exitCard = el.shadowRoot!.querySelector('outline-card')!;
        expect(exitCard.textContent).toContain('Thanks for helping us improve');
      });

      it('shows default contact view on cancellation of support form', async () => {
        el.shadowRoot!.querySelector('support-form')!.dispatchEvent(new CustomEvent('cancel'));

        await nextFrame();

        expect(el.shadowRoot?.querySelector('p')?.textContent).toContain('Tell us how we can help.');
        expect(el.shadowRoot?.querySelector('support-form')).toBeNull();
      });
    });
  });
});
