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

import {SupportForm} from './index';

import {fixture, html, nextFrame, oneEvent, triggerBlurFor, triggerFocusFor} from '@open-wc/testing';

async function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await triggerFocusFor(el);
  el.value = value;
  await triggerBlurFor(el);
  el.dispatchEvent(new CustomEvent('blur'));
}

describe('SupportForm', () => {
  it('is defined', async () => {
    const el = await fixture(html` <support-form></support-form> `);
    expect(el).toBeInstanceOf(SupportForm);
  });

  it('shows correct fields for the client variant', async () => {
    const el = await fixture(html` <support-form variant="client"></support-form> `);

    expect(el.shadowRoot!.querySelector('mwc-textfield[name="Where_did_you_get_your_access_key"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('mwc-select[name="Cloud_Provider"]')).toBeNull();
  });

  it('shows correct fields for the manager variant', async () => {
    const el = await fixture(html` <support-form variant="manager"></support-form> `);

    expect(el.shadowRoot!.querySelector('mwc-textfield[name="Where_did_you_get_your_access_key"]')).toBeNull();
    expect(el.shadowRoot!.querySelector('mwc-select[name="Cloud_Provider"]')).not.toBeNull();
  });

  it('submit button is disabled by default', async () => {
    const el = await fixture(html` <support-form></support-form> `);
    const submitButton = el.shadowRoot!.querySelector('mwc-button[label="Submit"]')!;
    expect(submitButton.hasAttribute('disabled')).toBeTrue();
  });

  describe('when form is valid', () => {
    let el: SupportForm;
    let submitButton: HTMLElement;

    beforeEach(async () => {
      el = await fixture(html` <support-form></support-form> `);

      const emailInput: HTMLInputElement = el.shadowRoot!.querySelector('mwc-textfield[name="email"')!;
      await setValue(emailInput, 'foo@bar.com');
      const accessKeySourceInput: HTMLInputElement = el.shadowRoot!.querySelector(
        'mwc-textfield[name="Where_did_you_get_your_access_key"'
      )!;
      await setValue(accessKeySourceInput, 'From a friend');
      const subjectInput: HTMLInputElement = el.shadowRoot!.querySelector('mwc-textfield[name="subject"')!;
      await setValue(subjectInput, 'Test Subject');
      const descriptionInput: HTMLTextAreaElement = el.shadowRoot!.querySelector('mwc-textarea[name="description"')!;
      await setValue(descriptionInput, 'Test Description');

      submitButton = el.shadowRoot!.querySelector('mwc-button[label="Submit"]')!;
    });

    it('submit button is enabled', async () => {
      expect(submitButton.hasAttribute('disabled')).toBeFalse();
    });

    it('clicking submit button emits form submit success event', async () => {
      const listener = oneEvent(el, 'submit');

      submitButton.click();

      const {detail} = await listener;
      expect(detail).toBeTrue();
    });
  });

  it('updating the `values` property updates the form', async () => {
    const el: SupportForm = await fixture(html` <support-form></support-form> `);
    const emailInput: HTMLInputElement = el.shadowRoot!.querySelector('mwc-textfield[name="email"')!;
    await setValue(emailInput, 'foo@bar.com');

    el.values = {};
    await nextFrame();

    expect(emailInput.value).toBe('');
  });

  it('emits form cancel event', async () => {
    const el: SupportForm = await fixture(html` <support-form></support-form> `);
    const listener = oneEvent(el, 'cancel');

    const cancelButton: HTMLElement = el.shadowRoot!.querySelector('mwc-button[label="Cancel"]')!;
    cancelButton.click();

    const {detail} = await listener;
    expect(detail).toBeTrue();
  });
});
