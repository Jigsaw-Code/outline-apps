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

import {IronFitBehavior} from '@polymer/iron-fit-behavior/iron-fit-behavior';
import {Polymer} from '@polymer/polymer/lib/legacy/polymer-fn';
import {html} from '@polymer/polymer/lib/utils/html-tag';

export interface OutlineHelpBubble extends Element {
  show(positionTarget: Element, arrowDirection: string, leftOrRightOffset: string): void;
  hide(): void;
}

Polymer({
  _template: html`
    <style include="cloud-install-styles"></style>
    <style>
      :host {
        margin: 10px;
        z-index: 100;
      }
      paper-button {
        color: var(--primary-green);
      }
      .helpContent {
        background-color: #fff;
        color: #000;
        padding: 24px;
        font-size: 14px;
        width: 250px;
        border-radius: 4px;
        box-shadow: 0 8px 10px 0 rgba(0, 0, 0, 0.2);
      }
      .upArrowWrapper,
      .downArrowWrapper,
      .rightArrowWrapper,
      .leftArrowWrapper {
        display: none;
        position: absolute;
        text-align: center;
      }
      :host(.showArrow-up) .upArrowWrapper,
      :host(.showArrow-down) .downArrowWrapper,
      :host(.showArrow-left) .leftArrowWrapper,
      :host(.showArrow-right) .rightArrowWrapper {
        display: block;
      }
      .upArrowWrapper {
        top: -13px;
        width: 100%;
        left: 0px;
      }
      .downArrowWrapper {
        top: 100%;
        width: 100%;
        left: 0px;
        margin-top: -3px;
      }
      .rightArrowWrapper {
        top: 8px;
        left: 100%;
      }
      .leftArrowWrapper {
        top: 8px;
        left: -10px;
      }
      .upArrow,
      .downArrow,
      .rightArrow,
      .leftArrow {
        width: 0px;
        height: 0px;
        display: inline-block;
      }
      .upArrow {
        border-bottom: 10px solid #fff;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
      }
      .downArrow {
        border-top: 10px solid #fff;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
      }
      .rightArrow {
        border-left: 10px solid #fff;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
      }
      .leftArrow {
        border-right: 10px solid #fff;
        border-top: 10px solid transparent;
        border-bottom: 10px solid transparent;
      }
      /* rtl:begin:ignore */
      /* Multiple :host selectors must not have spacing between them */
      :host(:dir(ltr)):host(.offset-right) .upArrowWrapper,
      :host(:dir(ltr)):host(.offset-right) .downArrowWrapper {
        margin-left: 35%;
      }
      :host(:dir(ltr)):host(.offset-left) .upArrowWrapper,
      :host(:dir(ltr)):host(.offset-left) .downArrowWrapper {
        margin-left: -35%;
      }
      :host(:dir(rtl)):host(.offset-right) .upArrowWrapper,
      :host(:dir(rtl)):host(.offset-right) .downArrowWrapper {
        margin-right: 35%;
      }
      :host(:dir(rtl)):host(.offset-left) .upArrowWrapper,
      :host(:dir(rtl)):host(.offset-left) .downArrowWrapper {
        margin-right: -35%;
      }
      /* rtl:end:ignore */
    </style>
    <div class="rightArrowWrapper"><div class="rightArrow"></div></div>
    <div class="leftArrowWrapper"><div class="leftArrow"></div></div>
    <div class="upArrowWrapper"><div class="upArrow"></div></div>
    <div class="downArrowWrapper"><div class="downArrow"></div></div>
    <div class="helpContent"><slot></slot></div>
  `,

  is: 'outline-help-bubble',

  behaviors: [IronFitBehavior],

  ready() {
    // Prevent help bubble from overlapping with it's positionTarget.
    this.setAttribute('no-overlap', true);

    // Help bubble should default to hidden until show is called.
    this.setAttribute('hidden', true);
  },

  show(positionTarget: Element, arrowDirection: string, leftOrRightOffset: string) {
    this.removeAttribute('hidden');

    // Set arrow direction.
    this.classList.add('showArrow-' + arrowDirection);

    // Apply left or right offset to arrow, e.g. display an up-pointing
    // arrow on the top right.
    const isUpOrDown = arrowDirection === 'up' || arrowDirection === 'down';
    if (isUpOrDown && (leftOrRightOffset === 'left' || leftOrRightOffset === 'right')) {
      this.classList.add('offset-' + leftOrRightOffset);
    }

    // Position the help bubble.
    this.positionTarget = positionTarget;
    this.refit();

    // Listen to scroll and resize events so the help bubble can reposition if needed.
    window.addEventListener('scroll', this.refit.bind(this));
    window.addEventListener('resize', this.refit.bind(this));
  },

  hide() {
    this.setAttribute('hidden', true);
    window.removeEventListener('scroll', this.refit.bind(this));
    window.removeEventListener('resize', this.refit.bind(this));
    this.fire('outline-help-bubble-dismissed');
  },
});
