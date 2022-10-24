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

import {DirMixin} from '@polymer/polymer/lib/mixins/dir-mixin.js';
import {html} from '@polymer/polymer/lib/utils/html-tag.js';
import {PolymerElement} from '@polymer/polymer/polymer-element.js';

class LoginPage extends DirMixin(PolymerElement) {
  static get template() {
    return html`
      <style>
        :host {
          background: #fff;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
          width: 100%;
          height: 100vh;
          font-family: var(--outline-font-family);
          padding-top: 24px;
        }

        #main {
          margin: 0 auto;
        }

        .buttons-wrapper{
          margin-top: 16px;
        }

        .sign-up {
          text-decoration: none;
          color: inherit;
        }
        
        .error-message {
          color: red;
          margin-top: 16px;
          max-width: fit-content;
        }
      </style>

      <div id="main">
        <paper-input
          class="shadow"
          label="[[localize('label-username')]]"
          value="{{_userName}}"
        ></paper-input>

        <paper-input
          id="accessKeyInput"
          class="shadow"
          label="[[localize('label-password')]]"
          value="{{_password}}"
        ></paper-input>

        <div class="buttons-wrapper">
          <paper-button required auto-validate on-tap="_onLoginClick">[[localize('button-login')]]</paper-button>

          <a class="sign-up" href="https://cryptanica.com/signup">
            <paper-button required auto-validate on-tap="_ignoreDetectedServer">[[localize('button-signup')]]</paper-button>
          </a>
        </div>

        <template is="dom-if" if=[[_error]]>
          <div class="error-message">
            username or password is not correct. if you are not signed up please use the link below and signup first <a href="https://cryptanica.com/signup">signup</a>.
            if you already signed up check your subscription to be valid on web site control panel <a href="https://cryptanica.com/index.php/membership-account/">control panel</a>
          </div>
        </template>

        <iron-ajax
          id="ajax"
          url="http://3.126.163.92:5000/v1/GetAvailableServers"
          method="POST"
          body="[[_getBody(_userName, _password)]]"
          on-response="_onLoginSucess"
          last-error="{{_error}}">
        </iron-ajax>
     

      </div>
    `;
  }

  static get is() {
    return 'login-page';
  }

  static get properties() {
    return {
      _userName: String,
      _password: String,
      _error: Object
    };
  }

  _onLoginClick() {
    this.$.ajax.generateRequest();
  }

  _getBody(username, password){
    const formData = new FormData();

    formData.append('UserName', username);
    formData.append('Password', btoa(password));

    return formData;
  }

  _onLoginSucess(){
    this._storeDataInLocal();

    const params = {bubbles: true, composed: true, detail: this.$.ajax.lastResponse};
    this.dispatchEvent(new CustomEvent('login-sucessfully', params));
  }

  _storeDataInLocal(){
    localStorage.setItem('outline-user', JSON.stringify({username: this._userName, password: btoa(this._password)}));
    localStorage.setItem('outline-servers', JSON.stringify(this.$.ajax.lastResponse))
  }

}
customElements.define(LoginPage.is, LoginPage);
