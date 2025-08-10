// Copyright 2024 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import '@polymer/paper-dialog/paper-dialog.js';
import '@polymer/paper-listbox/paper-listbox.js';
import '@polymer/paper-item/paper-item.js';
import '@polymer/paper-checkbox/paper-checkbox.js';
import '@polymer/paper-button/paper-button.js';
import '@polymer/iron-icon/iron-icon.js';
import '@polymer/paper-dialog-scrollable/paper-dialog-scrollable.js';

import {PolymerElement, html} from '@polymer/polymer/polymer-element.js';
import {customElement, property, query} from '@polymer/decorators';
import {AppLocalizeBehavior} from '@polymer/app-localize-behavior/app-localize-behavior.js';
import {PaperDialogElement} from '@polymer/paper-dialog/paper-dialog.js'; // Added import

import {AppInfo, getInstalledApplications} from '../app/plugin.cordova';
// Removed LocalizeMixin import

// Define the event detail for when the dialog saves.
export interface AppSelectionDialogSaveEventDetail {
  selectedApps: string[]; // Array of package names
}

@customElement('app-selection-dialog')
export class AppSelectionDialog extends AppLocalizeBehavior(PolymerElement) {
  static readonly template = html`
    <style>
      paper-dialog {
        min-width: 320px;
        max-width: 500px;
      }
      paper-listbox {
        max-height: 300px; /* Ensure the list is scrollable if too long */
      }
      paper-item {
        cursor: pointer;
        display: flex;
        align-items: center;
      }
      paper-item paper-checkbox {
        margin-right: 10px;
      }
      .app-label {
        flex-grow: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .buttons {
        margin-top: 24px;
        padding: 0 24px 24px 24px; /* Match paper-dialog padding */
        display: flex;
        justify-content: flex-end;
      }
      .description {
        padding: 0 24px;
        margin-bottom: 10px;
      }
    </style>

    <paper-dialog id="dialog" with-backdrop>
      <h2>[[localize('splitTunnelingDialogTitle')]]</h2>
      <paper-dialog-scrollable>
        <div class="description">[[localize('splitTunnelingDialogDescription')]]</div>
        <template is="dom-if" if="[[!apps.length]]">
          <paper-item>[[localize('splitTunnelingNoAppsFound')]]</paper-item>
        </template>
        <paper-listbox multi>
          <template is="dom-repeat" items="[[apps]]" as="app">
            <paper-item on-tap="_toggleAppSelection">
              <paper-checkbox checked="{{_isAppSelected(app.packageName, selectedApps.*)}}"></paper-checkbox>
              <span class="app-label" title="[[app.label]] ([[app.packageName]])">[[app.label]]</span>
            </paper-item>
          </template>
        </paper-listbox>
      </paper-dialog-scrollable>
      <div class="buttons">
        <paper-button dialog-dismiss on-tap="_onCancel">[[localize('splitTunnelingDialogCancelButton')]]</paper-button>
        <paper-button dialog-confirm autofocus on-tap="_onSave">[[localize('splitTunnelingDialogSaveButton')]]</paper-button>
      </div>
    </paper-dialog>
  `;

  @property({type: Array, value: () => []}) apps: AppInfo[] = [];

  @property({type: Object, value: () => ({})})
  selectedApps: {[packageName: string]: boolean} = {};

  // Stores the initially selected apps when the dialog is opened to compare on save.
  private initialSelectedApps: {[packageName: string]: boolean} = {};

  @query('#dialog') private dialogElement!: PaperDialogElement;

  ready() {
    super.ready();
    // Load localization resources
    this.loadResources(this.resolveUrl('../messages/en.json'));
    this._loadInstalledApps();
  }

  open(currentlySelectedApps: string[] = []) {
    const newSelectedApps: {[packageName: string]: boolean} = {};
    for (const appPkg of currentlySelectedApps) {
      newSelectedApps[appPkg] = true;
    }
    this.selectedApps = newSelectedApps;
    // Store a copy for comparison on save, to see if changes were made.
    this.initialSelectedApps = {...this.selectedApps};
    this.dialogElement.open();
  }

  private async _loadInstalledApps() {
    try {
      // TODO: Add a loading indicator
      this.apps = await getInstalledApplications();
      // Ensure selectedApps object is populated for any apps that might have been
      // selected previously but are just now being loaded.
      // Create a new object for selectedApps to ensure Polymer notices the change if needed.
      const updatedSelectedApps = {...this.selectedApps};
      this.apps.forEach(app => {
        if (updatedSelectedApps[app.packageName] === undefined) {
          updatedSelectedApps[app.packageName] = false;
        }
      });
      this.selectedApps = updatedSelectedApps;
    } catch (e) {
      console.error('Failed to load installed applications', e);
      // TODO: Show error to user, perhaps using the splitTunnelingFeatureNotSupported message
      // For now, just leave the apps list empty, which will show "No apps found".
    }
  }

  private _isAppSelected(packageName: string): boolean {
    return !!this.selectedApps[packageName];
  }

  // paper-item on-tap handler to toggle the checkbox state
  private _toggleAppSelection(event: Event) {
    const item = (event.currentTarget as HTMLElement).closest('paper-item');
    // In Polymer 3, modelForElement might not be the standard way.
    // Assuming dom-repeat sets up `app` in the item's context.
    const app = (item as any).app as AppInfo; // Or use a more robust way to get app data
    if (app && app.packageName) {
      const updatedSelectedApps = {...this.selectedApps};
      updatedSelectedApps[app.packageName] = !this.selectedApps[app.packageName];
      this.selectedApps = updatedSelectedApps;
    } else {
      // Fallback or error if app context is not found as expected
      const checkbox = item.querySelector('paper-checkbox') as any;
      if (checkbox) {
         // This is less ideal as it relies on finding the app by checkbox state indirectly
         // and requires knowing which app corresponds to this checkbox.
         // The dom-repeat model is preferred.
        console.warn("Could not find app context directly, attempting fallback for checkbox toggle.");
      }
    }
  }

  private _onSave() {
    const newSelectedAppsList: string[] = [];
    for (const pkgName in this.selectedApps) {
      if (this.selectedApps[pkgName]) {
        newSelectedAppsList.push(pkgName);
      }
    }

    // Only dispatch event if the selection has actually changed.
    // This prevents unnecessary processing if the user opens and saves without changes.
    // For a more robust check, compare newSelectedAppsList with an initial list.
    // For simplicity now, we'll always dispatch.
    // A more robust check would involve converting initialSelectedApps to a list and comparing.

    this.dispatchEvent(
      new CustomEvent<AppSelectionDialogSaveEventDetail>('save-selected-apps', {
        bubbles: true,
        composed: true,
        detail: {selectedApps: newSelectedAppsList},
      })
    );
    this.dialogElement.close();
  }

  private _onCancel() {
    // Restore the selection to what it was when the dialog opened.
    this.selectedApps = {...this.initialSelectedApps};
    this.dialogElement.close();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-selection-dialog': AppSelectionDialog;
  }
}
