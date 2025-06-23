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

import {html, PolymerElement} from '@polymer/polymer/polymer-element.js';
import {flush} from '@polymer/polymer/lib/utils/flush.js';

// Import the component to test
import './app_selection_dialog';
import {AppSelectionDialog, AppSelectionDialogSaveEventDetail} from './app_selection_dialog';

// Mock dependencies
import * as pluginCordova from '../app/plugin.cordova';
import {AppInfo} from '../app/plugin.cordova';

describe('AppSelectionDialog', () => {
  let dialog: AppSelectionDialog;
  let getInstalledApplicationsSpy: jasmine.Spy<() => Promise<AppInfo[]>>;

  const mockApps: AppInfo[] = [
    {packageName: 'com.app.one', label: 'App One'},
    {packageName: 'com.app.two', label: 'App Two'},
    {packageName: 'com.app.three', label: 'App Three'},
  ];

  // Helper to create and attach the dialog to the DOM
  async function createDialog(): Promise<AppSelectionDialog> {
    const element = document.createElement('app-selection-dialog') as AppSelectionDialog;
    // Set a localize function for testing
    element.localize = (msgId: string, ...params: string[]) => {
      let value = msgId;
      if (params) {
        for (let i = 0; i < params.length; i = i + 2) {
          value = value.replace(params[i], params[i+1]);
        }
      }
      return value;
    };
    document.body.appendChild(element);
    await flush(); // Wait for Polymer to render
    return element;
  }

  beforeEach(async () => {
    // Spy on and mock getInstalledApplications before each test
    getInstalledApplicationsSpy = spyOn(pluginCordova, 'getInstalledApplications');
    getInstalledApplicationsSpy.and.returnValue(Promise.resolve([...mockApps])); // Default success

    dialog = await createDialog();
  });

  afterEach(() => {
    // Clean up the dialog from the DOM
    if (dialog && dialog.parentNode) {
      dialog.parentNode.removeChild(dialog);
    }
  });

  it('should be defined as a custom element', () => {
    expect(customElements.get('app-selection-dialog')).toBeDefined();
  });

  it('should call getInstalledApplications on ready/attached', () => {
    expect(getInstalledApplicationsSpy).toHaveBeenCalled();
  });

  it('should populate the apps list from getInstalledApplications', async () => {
    await getInstalledApplicationsSpy.calls.mostRecent().returnValue; // Wait for the promise
    await flush();
    expect(dialog.apps.length).toBe(mockApps.length);
    expect(dialog.apps[0].packageName).toEqual(mockApps[0].packageName);

    const items = dialog.shadowRoot.querySelectorAll('paper-item');
    expect(items.length).toBe(mockApps.length);
    expect(items[0].textContent.includes(mockApps[0].label)).toBeTrue();
  });

  it('should display "No apps found" message if no apps are returned', async () => {
    getInstalledApplicationsSpy.and.returnValue(Promise.resolve([]));
    dialog = await createDialog(); // Recreate with new spy behavior
    await getInstalledApplicationsSpy.calls.mostRecent().returnValue;
    await flush();

    expect(dialog.apps.length).toBe(0);
    const noAppsMessageItem = dialog.shadowRoot.querySelector('paper-item');
    expect(noAppsMessageItem).not.toBeNull();
    expect(noAppsMessageItem.textContent.includes('splitTunnelingNoAppsFound')).toBeTrue();
  });

  it('should handle errors from getInstalledApplications gracefully', async () => {
    getInstalledApplicationsSpy.and.returnValue(Promise.reject(new Error('Plugin failed')));
    dialog = await createDialog(); // Recreate
    await getInstalledApplicationsSpy.calls.mostRecent().returnValue.catch(() => {}); // Catch expected rejection
    await flush();

    expect(dialog.apps.length).toBe(0); // Apps list should remain empty
    const noAppsMessageItem = dialog.shadowRoot.querySelector('paper-item');
    expect(noAppsMessageItem).not.toBeNull(); // "No apps found" should still be shown
    expect(noAppsMessageItem.textContent.includes('splitTunnelingNoAppsFound')).toBeTrue();
    // Optionally, check console.error was called if you added that for error logging
  });

  describe('Selection', () => {
    beforeEach(async () => {
      // Ensure apps are loaded for selection tests
      await getInstalledApplicationsSpy.calls.mostRecent().returnValue;
      await flush();
    });

    it('should initialize with no apps selected if currentlySelectedApps is empty', () => {
      dialog.open([]);
      expect(Object.values(dialog.selectedApps).every(selected => !selected)).toBeTrue();
      const checkboxes = dialog.shadowRoot.querySelectorAll('paper-checkbox');
      checkboxes.forEach(cb => expect((cb as any).checked).toBeFalse());
    });

    it('should initialize with specified apps selected', () => {
      dialog.open([mockApps[0].packageName, mockApps[2].packageName]);
      expect(dialog.selectedApps[mockApps[0].packageName]).toBeTrue();
      expect(dialog.selectedApps[mockApps[1].packageName]).toBeFalse();
      expect(dialog.selectedApps[mockApps[2].packageName]).toBeTrue();

      const checkboxes = dialog.shadowRoot.querySelectorAll('paper-checkbox');
      expect((checkboxes[0] as any).checked).toBeTrue();
      expect((checkboxes[1] as any).checked).toBeFalse();
      expect((checkboxes[2] as any).checked).toBeTrue();
    });

    it('should update selectedApps when an app item is tapped', () => {
      dialog.open([]);
      const paperItems = dialog.shadowRoot.querySelectorAll('paper-item');

      // Tap first item
      (paperItems[0] as HTMLElement).click();
      await flush();
      expect(dialog.selectedApps[mockApps[0].packageName]).toBeTrue();
      expect((dialog.shadowRoot.querySelectorAll('paper-checkbox')[0] as any).checked).toBeTrue();

      // Tap first item again to deselect
      (paperItems[0] as HTMLElement).click();
      await flush();
      expect(dialog.selectedApps[mockApps[0].packageName]).toBeFalse();
      expect((dialog.shadowRoot.querySelectorAll('paper-checkbox')[0] as any).checked).toBeFalse();
    });
  });

  describe('Dialog Actions', () => {
     beforeEach(async () => {
      await getInstalledApplicationsSpy.calls.mostRecent().returnValue;
      await flush();
      dialog.open([mockApps[0].packageName]); // Start with one app selected
    });

    it('should dispatch "save-selected-apps" event with selected apps on save', (done) => {
      // Select another app
      const paperItems = dialog.shadowRoot.querySelectorAll('paper-item');
      (paperItems[1] as HTMLElement).click(); // Select mockApps[1]

      dialog.addEventListener('save-selected-apps', (event: CustomEvent<AppSelectionDialogSaveEventDetail>) => {
        expect(event.detail.selectedApps).toBeDefined();
        expect(event.detail.selectedApps.length).toBe(2);
        expect(event.detail.selectedApps).toContain(mockApps[0].packageName);
        expect(event.detail.selectedApps).toContain(mockApps[1].packageName);
        // Check dialog is closed by _onSave
        expect((dialog as any).dialogElement.opened).toBeFalse();
        done();
      });

      const saveButton = dialog.shadowRoot.querySelector('paper-button[dialog-confirm]') as HTMLElement;
      saveButton.click();
    });

    it('should close the dialog on cancel and revert selections', async () => {
      const initialSelections = {...dialog.selectedApps};

      // Change selection
      const paperItems = dialog.shadowRoot.querySelectorAll('paper-item');
      (paperItems[1] as HTMLElement).click(); // Select mockApps[1]
      expect(dialog.selectedApps[mockApps[1].packageName]).toBeTrue();

      const cancelButton = dialog.shadowRoot.querySelector('paper-button[dialog-dismiss]') as HTMLElement;
      cancelButton.click();
      await flush();

      expect((dialog as any).dialogElement.opened).toBeFalse();
      expect(dialog.selectedApps).toEqual(initialSelections); // Check selections are reverted
    });
  });
});
