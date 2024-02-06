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

import '@polymer/iron-icons/iron-icons';
import '@polymer/paper-button/paper-button';
import {Polymer} from '@polymer/polymer/lib/legacy/polymer-fn';
import {html} from '@polymer/polymer/lib/utils/html-tag';
Polymer({
  _template: html`
    <style include="cloud-install-styles">
      :host {
      }
      .container {
        border: 1px solid var(--border-color);
        padding-bottom: 12px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        padding: 15px 24px;
        line-height: 30px;
      }
      .showme:hover {
        cursor: pointer;
      }
      .showme iron-icon {
        width: 16px;
        height: 16px;
        margin-left: 8px;
      }
      .title {
        font-size: 16px;
      }
      .thumbnail {
        width: 480px;
        height: 288px;
        margin-bottom: 24px;
      }
      .overlay {
        position: absolute;
        background: rgb(38, 50, 56);
        opacity: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
      }
      .overlay iron-icon {
        color: #fff;
        width: 24px;
        height: 24px;
      }
      .overlay:hover {
        opacity: 0.57;
      }
      .instructions {
        color: var(--light-gray);
        font-size: 16px;
        line-height: 24px;
      }
    </style>
    <div class="container">
      <div class="header">
        <div class="title">[[title]]</div>
        <div class="showme" on-tap="_openImage">
          [[localize('manual-server-show-me')]]<iron-icon icon="open-in-new"></iron-icon>
        </div>
      </div>
      <div class="thumbnail overlay" on-tap="_openImage">
        <iron-icon icon="open-in-new"></iron-icon>
      </div>
      <img class="thumbnail" src$="[[thumbnailPath]]" />
      <div class="instructions">
        <slot></slot>
      </div>
    </div>
  `,

  is: 'outline-cloud-instructions-view',

  properties: {
    title: String,
    imagePath: String,
    thumbnailPath: String,
    instructions: Array,
    localize: Function,
  },

  _openImage() {
    this.fire('OpenImageRequested', {imagePath: this.imagePath});
  },
});
