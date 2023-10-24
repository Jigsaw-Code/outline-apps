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

import '@material/mwc-textfield';
import {Polymer} from '@polymer/polymer/lib/legacy/polymer-fn.js';
import {html} from '@polymer/polymer/lib/utils/html-tag.js';
import {afterNextRender} from '@polymer/polymer/lib/utils/render-status.js';

Polymer({
  _template: html`
    <style>
      mwc-textfield {
        margin-top: 0;
      }
    </style>
    <paper-dialog id="renameDialog" with-backdrop="">
      <h3>[[localize('server-rename')]]</h3>
      <mwc-textfield id="serverNameInput" maxlength="100" tabindex="0"></mwc-textfield>
      <div class="buttons">
        <paper-button dialog-dismiss="">[[localize('cancel')]]</paper-button>
        <paper-button dialog-confirm="" on-tap="_saveRename">[[localize('save')]]</paper-button>
      </div>
    </paper-dialog>
  `,

  is: 'server-rename-dialog',

  properties: {
    // Need to declare localize function passed in from parent, or else
    // localize() calls within the template won't be updated.
    localize: Function,
    rootPath: String,
    __serverName: String,
    __serverId: String,
  },

  open: function (serverName, serverId) {
    // Store the initial serverName so we can know if it changed, and
    // store the serverId so we can emit the rename request event.
    this.__serverName = serverName;
    this.__serverId = serverId;
    this.$.serverNameInput.value = serverName;
    this.$.renameDialog.open();
    // Focus on serverNameInput, only after the dialog has been displayed.
    afterNextRender(this, () => {
      this.$.serverNameInput.focus();
    });
  },

  _saveRename: function () {
    const newName = this.$.serverNameInput.value;
    if (newName !== this.__serverName) {
      this.fire('RenameRequested', {serverId: this.__serverId, newName: newName});
    }
  },
});
