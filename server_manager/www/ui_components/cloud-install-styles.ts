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

import {html} from '@polymer/polymer/lib/utils/html-tag';
import {unsafeCSS} from 'lit';

// Polymer style module to share styles between steps
// https://polymer-library.polymer-project.org/3.0/docs/devguide/style-shadow-dom#share-styles-between-elements
const styleElement = document.createElement('dom-module');
styleElement.appendChild(
  html` <style>
    :host {
      --primary-green: #00bfa5;
      --background-color: #263238;
      --background-contrast-color: #2e3a3f;
      --light-gray: rgba(255, 255, 255, 0.87);
      --medium-gray: rgba(255, 255, 255, 0.54);
      --dark-gray: rgba(0, 0, 0, 0.87);
      --border-color: rgba(255, 255, 255, 0.12);
    }

    #title {
      font-weight: 100;
      color: rgba(0, 0, 0, 0.87);
      font-size: 24px;
      line-height: 1.5em;
      display: inline-block;
      -webkit-margin-before: 1.25em;
      -webkit-margin-after: 0em;
      -webkit-margin-start: 0px;
      -webkit-margin-end: 0px;
    }

    paper-button {
      font-size: 14px;
      padding: 1em 3em 1em 3em;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.87);
      letter-spacing: 0.05em;
      border-radius: 2px;
    }

    paper-button.primary {
      transition: 0.5s;
      color: white;
      background-color: var(--background-color);
      width: 56%;
    }

    paper-button.secondary {
      background-color: none;
    }

    paper-button[disabled] {
      background-color: rgba(0, 0, 0, 0.25);
      color: var(--medium-gray);
    }

    paper-progress {
      background: var(--background-contrast-color);
      --paper-progress-active-color: var(--primary-green);
      --paper-progress-container-color: var(--background-contrast-color);
      --paper-progress-transition-duration: 1s;
      --paper-progress-transition-timing-function: linear;
      width: 100%;
    }

    hr {
      margin: 2em 0 2em 0;
    }

    paper-dropdown-menu {
      --paper-input-container-underline: {
        color: var(--primary-green);
      };
    }

    paper-input,
    paper-textarea,
    paper-dropdown-menu {
      --paper-input-container-focus-color: var(--primary-green);
    }

    app-toolbar {
      color: #eee;
      font-size: 12px;
      font-weight: 300;
      letter-spacing: 0.02em;
      color: var(--light-gray);
      padding: 0;
      min-height: 60px;
      border-bottom: 1px solid var(--border-color);
    }

    app-toolbar paper-icon-button {
      margin-left: 16px;
      margin-right: 26px;
    }

    app-toolbar h2 {
      color: #e0e2e3;
      font-size: 19px;
      font-weight: 400;
    }

    p {
      color: rgba(0, 0, 0, 0.54);
      margin-top: 12px;
      margin-bottom: 24px;
    }

    paper-dialog {
      max-width: 540px;
      min-width: 480px;
      margin: 56px 32px 32px 32px;
    }

    paper-dialog-scrollable {
      width: 100%;
      margin: 0;
    }

    paper-dialog-scrollable img {
      padding-top: 24px;
      padding-bottom: 24px;
    }

    paper-dialog .dialogBanner {
      background-color: #eceff1;
      text-align: center;
      margin-top: 0;
      padding-top: 50px;
      height: 150px;
    }
    paper-dialog .dialogBanner img {
      height: 150px;
    }

    paper-tooltip {
      --paper-tooltip-text-color: #000;
      --paper-tooltip-background: #fff;
      --paper-tooltip-duration-in: 100;
      --paper-tooltip-duration-out: 100;
    }

    .instructions-list {
      margin: auto;
      padding-right: 42px;
      padding-left: 42px;
      max-width: 400px;
    }

    .instructions-list ol {
      margin: 0 0 0 0;
      padding: 0 24px 0 56px;
      text-align: center !important;
    }

    .instructions-list li {
      padding: 0 12px 24px 20px;
      text-align: left;
    }

    .instructions-list li:before {
      padding: 0 0 30px 20px;
    }

    .instructions-list paper-button {
      margin-top: 20px;
    }

    .instructions-list a {
      text-decoration: underline;
      color: rgba(0, 0, 0, 0.87);
      font-weight: 500;
    }

    .instructions-list p {
      color: rgba(0, 0, 0, 0.54);
    }

    .instructions-list img {
      padding: 32px 0px 42px 0;
      margin: auto;
    }

    .walkthrough {
      background: #ffffff;
      box-shadow:
        0 3px 5px 0 rgba(0, 0, 0, 0.1),
        0 2px 4px 0 rgba(0, 0, 0, 0.1),
        0 4px 4px 0 rgba(0, 0, 0, 0.12);
      top: 0px;
      display: block;
    }

    .walkthrough h3 {
      font-size: 14px;
      line-height: 24px;
      color: rgba(0, 0, 0, 0.87);
      max-width: 70%;
      margin: auto;
      padding: 0px 0px 24px 0px;
      font-weight: normal;
    }

    a {
      text-decoration: none;
      color: var(--primary-green);
    }

    /*
    Helps make sure elements using both iron-flex-layout and the hidden
    attribute actually hide:
      - https://github.com/Polymer/polymer/issues/3711
      - https://github.com/PolymerElements/iron-flex-layout/issues/86
  */
    [hidden] {
      display: none !important;
    }

    .card-section {
      display: flex;
      padding: 24px;
      background: var(--background-contrast-color);
      border-radius: 2px;
    }

    /* Mirror progress indicators for RTL languages */
    :host(:dir(rtl)) paper-progress {
      transform: scaleX(-1);
    }
  </style>`
);
styleElement.register('cloud-install-styles');

// Shared styles for LitElement components
const commonStyleCss =
  styleElement.querySelector('template').content.textContent;
export const COMMON_STYLES = unsafeCSS(commonStyleCss);
