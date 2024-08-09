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
import '@polymer/neon-animation/animations/slide-down-animation';
import '@polymer/neon-animation/animations/slide-from-bottom-animation';
import '@polymer/paper-button/paper-button';
import '@polymer/paper-dialog/paper-dialog';

import type {PaperDialogElement} from '@polymer/paper-dialog/paper-dialog';
import type {PolymerElementProperties} from '@polymer/polymer/interfaces';
import {DirMixin} from '@polymer/polymer/lib/mixins/dir-mixin';
import {html} from '@polymer/polymer/lib/utils/html-tag';
import {PolymerElement} from '@polymer/polymer/polymer-element';

class OutlineSurveyDialog extends DirMixin(PolymerElement) {
  static get template() {
    return html`
      <style include="cloud-install-styles"></style>
      <style>
        :host {
          position: fixed;
          bottom: 0px;
        }
        /* rtl:begin:ignore */
        /* RTLCSS incorrectly adds a :host selector when converting this rule. */
        :host(:dir(ltr)) {
          right: 0px;
        }
        :host(:dir(rtl)) {
          left: 0px;
        }
        /* rtl:end:ignore */
        #dialog {
          margin: 0 24px 24px 24px;
          border-radius: 2px;
        }
        #container {
          display: flex;
        }
        #content {
          width: 100%;
        }
        #button-container {
          display: flex;
          justify-content: space-between;
        }
        h3 {
          margin-top: 8px;
        }
        img {
          height: 32px;
          margin-right: 24px;
        }
        paper-button {
          padding: 1em 0;
          margin: 0;
        }
        hr {
          margin: 12px 0;
          border: 1px solid #eee;
        }
        p {
          font-size: 11px;
          line-height: 14px;
        }
      </style>
      <paper-dialog
        id="dialog"
        vertical-align="bottom"
        no-cancel-on-outside-click=""
        entry-animation="slide-from-bottom-animation"
        exit-animation="slide-down-animation"
      >
        <div id="container">
          <img id="outlineLogo" src="images/manager-profile-2x.png" />
          <div id="content">
            <h3>[[title]]</h3>
            <div id="button-container">
              <paper-button dialog-dismiss="" noink="">
                [[localize('survey-decline')]]
              </paper-button>
              <paper-button dialog-confirm="" autofocus="" noink="">
                <a href="[[surveyLink]]">[[localize('survey-go-to-survey')]]</a>
              </paper-button>
            </div>
          </div>
        </div>
        <div id="disclaimer">
          <hr />
          <p>[[localize('survey-disclaimer')]]</p>
        </div>
      </paper-dialog>
    `;
  }

  static get is() {
    return 'outline-survey-dialog';
  }

  static get properties(): PolymerElementProperties {
    return {
      localize: Function,
      surveyLink: String,
      title: String,
    };
  }

  surveyLink: string;

  open(title: string, surveyLink: string) {
    this.title = title;
    this.surveyLink = surveyLink;
    const dialog = this.$.dialog as PaperDialogElement;
    dialog.horizontalAlign = this.dir === 'ltr' ? 'left' : 'right';
    dialog.open();
  }
}
customElements.define(OutlineSurveyDialog.is, OutlineSurveyDialog);
