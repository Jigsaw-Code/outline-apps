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

import {fixture, html} from '@open-wc/testing';

describe('SupportForm', () => {
  it('is defined', async () => {
    const element = await fixture(
      html`
        <support-form></support-form>
      `
    );
    expect(element).toBeInstanceOf(SupportForm);
  });

  it('submit button is disabled by default', async () => {
    const element = await fixture(
      html`
        <support-form></support-form>
      `
    );
    const submitButton = element.shadowRoot.querySelector('mwc-button[label="Submit"]');
    expect(submitButton.hasAttribute('disabled')).toBeTrue();
  });
});
