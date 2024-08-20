/*
  Copyright 2024 The Outline Authors
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
       http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import {html} from 'lit';
import '@material/web/all';

import './index';
import type {AddServerKeyDialog} from './index';
import {localize} from '../../../testing/localize';

export default {
  title: 'Client/Root View/Add Server Key Dialog',
  component: 'add-server-key-dialog',
  args: {
    open: true,
  },
};

export const Example = ({open}: AddServerKeyDialog) =>
  html`<add-server-key-dialog .open=${open} .localize=${localize}>
    <div
      slot="accessMessage"
      .innerHTML="${localize(
        'server-create-your-own',
        'breakLine',
        '<br/>',
        'openLink',
        '<a href=https://s3.amazonaws.com/outline-vpn/index.html>',
        'closeLink',
        '</a>'
      )}"
    ></div>
  </add-server-key-dialog>`;
