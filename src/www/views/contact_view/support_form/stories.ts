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
  },
};

export const Example = ({variant}: {variant: AppType}) =>
  html`
    <support-form .variant=${variant}></support-form>
  `;