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

// This is similar to the client's, except this spins endlessly and does not
// support different connection states.
Polymer({
  _template: html`
    <style>
      @-webkit-keyframes rotating {
        from {
          -webkit-transform: rotate(0deg);
          -o-transform: rotate(0deg);
          transform: rotate(0deg);
        }
        to {
          -webkit-transform: rotate(360deg);
          -o-transform: rotate(360deg);
          transform: rotate(360deg);
        }
      }
      :host {
        display: inline-block;
      }
      #container {
        position: relative;
        height: 160px;
        width: 160px;
      }
      img {
        position: absolute;
      }
      #sm {
        top: 60px;
        left: 60px;
        height: 40px;
        width: 40px;
        animation: rotating 2s linear infinite;
        z-index: 3;
      }
      #md {
        top: 30px;
        left: 30px;
        height: 100px;
        width: 100px;
        animation: rotating 2.1s linear infinite;
        z-index: 2;
      }
      #lg {
        top: 0;
        left: 0;
        height: 160px;
        width: 160px;
        animation: rotating 2.2s linear infinite;
        z-index: 1;
      }
    </style>
    <div id="container">
      <img id="lg" src="images/connected_large.png" />
      <img id="md" src="images/connected_large.png" />
      <img id="sm" src="images/connected_large.png" />
    </div>
  `,

  is: 'outline-progress-spinner',
});
