/*
  Copyright 2018 The Outline Authors

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
import '@polymer/polymer/polymer-legacy';

import {Polymer} from '@polymer/polymer/lib/legacy/polymer-fn';
import {html} from '@polymer/polymer/lib/utils/html-tag';
Polymer({
  _template: html`
    <style include="cloud-install-styles">
      :host {
        display: block;
      }
      .step-container {
        padding: 36px 24px 24px;
        vertical-align: middle;
        height: auto;
        text-align: left;
        background-color: #263238;
        display: flex;
        flex-direction: column;
      }
      .step-header {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        margin-bottom: 36px;
      }
      .step-text {
        flex: 2;
        margin-right: 24px;
        font-size: 20px;
        line-height: 28px;
      }
      .step-title {
        color: var(--light-gray);
      }
      .step-description {
        color: var(--medium-gray);
        max-width: 40ch;
      }
      .step-action {
        display: flex;
        justify-content: flex-end;
        flex: 1;
      }
    </style>
    <div class="step-container">
      <div class="step-header">
        <div class="step-text">
          <div class="step-title"><slot name="step-title"></slot></div>
          <div class="step-description"><slot name="step-description"></slot></div>
        </div>
        <div class="step-action" hidden$="[[!displayAction]]"><slot name="step-action"></slot></div>
      </div>
      <slot></slot>
    </div>
  `,

  is: 'outline-step-view',

  properties: {
    displayAction: {
      type: Boolean,
      value: false,
    },
  },
});
