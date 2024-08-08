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

import {nothing, LitElement, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('if-messages')
export class IfMessages extends LitElement {
  @property({
    type: Array,
    attribute: 'message-ids',
    converter: (value: string) => value.split(/,\s*/),
  })
  messageIDs: string[] = [];
  @property({type: Function, attribute: 'localize'}) localize: (
    msgId: string,
    ...params: string[]
  ) => string;

  render() {
    if (
      this.messageIDs.some(id => {
        const result = this.localize(id);

        return result === id || result === undefined || result === '';
      })
    ) {
      return nothing;
    }

    return html`<slot></slot>`;
  }
}
