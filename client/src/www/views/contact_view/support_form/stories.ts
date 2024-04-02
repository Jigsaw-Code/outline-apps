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

/* tslint:disable */

import {html} from 'lit';

import './index';
import {AppType} from '../app_type';
import {FormValues} from './index';
import {localize} from '../../../testing/localize';

export default {
  title: 'Contact View/Support Form',
  component: 'support-form',
  argTypes: {
    variant: {
      description: 'Style variant of the support form.',
      defaultValue: AppType.CLIENT,
      options: Object.values(AppType),
      control: {
        type: 'radio',
        defaultValue: AppType.CLIENT,
      },
    },
    disabled: {
      description: 'Whether to disable the form.',
      defaultValue: false,
      control: 'boolean',
    },
    onCancel: {action: 'cancel'},
    onSubmit: {action: 'submit'},
  },
};

export const EmptyForm = ({
  variant,
  disabled,
  onCancel,
  onSubmit,
}: {
  variant: AppType;
  disabled: boolean;
  onCancel: Function;
  onSubmit: Function;
}) => html`
  <support-form
    .localize=${localize}
    .variant=${variant}
    .disabled=${disabled}
    @cancel=${onCancel}
    @submit=${onSubmit}
  ></support-form>
`;

export const CompleteForm = ({
  variant,
  disabled,
  onCancel,
  onSubmit,
}: {
  variant: AppType;
  disabled: boolean;
  onCancel: Function;
  onSubmit: Function;
}) => {
  const values: FormValues = {
    email: 'foo@bar.com',
    subject: 'My Test Subject',
    description: 'My Test Description',
    accessKeySource: 'a friend',
    cloudProvider: 'digitalocean',
  };
  return html`
    <support-form
      .localize=${localize}
      .variant=${variant}
      .disabled=${disabled}
      .values=${values}
      @cancel=${onCancel}
      @submit=${onSubmit}
    ></support-form>
  `;
};
