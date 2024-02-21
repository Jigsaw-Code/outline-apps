/*
  Copyright 2020 The Outline Authors

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

import {html} from '@polymer/polymer/lib/utils/html-tag';

//  outline-server-settings-styles
//  This file holds common styles for outline-server-settings and outline-validated-input
const styleElement = document.createElement('dom-module');
styleElement.appendChild(html` <style>
  /* Skip processing these with postcss-rtl as it incorrectly parses the border-color
      in the paper-input-container-underline-focus mixin.
      https://github.com/vkalinichev/postcss-rtl/issues/50 */
  /* rtl:begin:ignore */
  paper-input {
    /* Matches the max width of outline-validated-input  */
    max-width: 545px;
    /* Removes extra padding added by children of paper-input */
    margin-top: -8px;
    /* Create space for error messages */
    margin-bottom: 14px;
    --paper-input-container-label-focus: {
      color: var(--primary-green);
    }
    --paper-input-container-underline-focus: {
      border-color: var(--primary-green);
    }
    --paper-input-container-label: {
      font-size: 14px;
      line-height: 22px;
    }
    --paper-input-container-color: var(--medium-gray);
    --paper-input-container-input: {
      color: #fff;
    }
    --paper-input-container-invalid-color: #f28b82;
  }
  /* rtl:end:ignore */

  paper-input[readonly] {
    --paper-input-container-underline: {
      display: none;
    }
    --paper-input-container-underline-focus: {
      display: none;
    }
    --paper-input-container-underline-disabled: {
      display: none;
    }
    --paper-input-container-disabled: {
      opacity: 1;
    }
  }
</style>`);

styleElement.register('outline-server-settings-styles');
