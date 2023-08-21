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

import {TemplateResult, html, nothing} from 'lit';

import '@material/mwc-button';

import './index';
import {CardType} from './index';

export default {
  title: 'Shared/Card',
  component: 'outline-card',
  argTypes: {
    variant: {
      description: 'Style variant of the card.',
      defaultValue: CardType.Elevated,
      options: Object.values(CardType),
      control: {
        type: 'radio',
        defaultValue: CardType.Elevated,
      },
    },
    withActions: {
      description: 'Show action button.',
      defaultValue: true,
      control: {
        type: 'boolean',
        defaultValue: true,
      },
    },
  },
};

function getFooter(withActions: boolean): TemplateResult | typeof nothing {
  return withActions
    ? html`
        <mwc-button slot="card-actions">Confirm</mwc-button>
      `
    : nothing;
}

export const Example = ({variant, withActions}: {variant: CardType; withActions: boolean}) =>
  html`
    <outline-card .type=${variant}>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam odio turpis, mattis nec elit nec, dapibus
      malesuada ligula. ${getFooter(withActions)}
    </outline-card>
  `;
