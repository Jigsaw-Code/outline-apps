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
import {AppType} from './app_type';
import {localize} from '../../testing/localize';

export default {
  title: 'Contact View',
  component: 'contact-view',
  argTypes: {
    variant: {
      description: 'Style variant of the contact view.',
      defaultValue: AppType.CLIENT,
      options: Object.values(AppType),
      control: {
        type: 'radio',
        defaultValue: AppType.CLIENT,
      },
    },
    onSuccess: {action: 'success'},
    onError: {action: 'error'},
  },
};

export const Example = ({variant, onSuccess, onError}: {variant: AppType; onSuccess: Function; onError: Function}) =>
  html`
    <contact-view
      .localize=${localize}
      .variant=${variant}
      .errorReporter=${{report: console.log}}
      @success=${onSuccess}
      @error=${onError}
    ></contact-view>
  `;
