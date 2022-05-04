// Copyright 2022 The Outline Authors
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

/**
 * The UI component should realize this interface.
 */
export interface OutlineUIServiceHandler {
  /**
   * Display a simple dialog (similar to alert or confirm) and return the user response.
   * @param message A text message to be displayed.
   * @param okOnly Should we display an OK button only, or with OK and Cancel.
   */
  showSimpleDialog(message: string, okOnly: boolean): Promise<boolean>;

  /**
   * Display a notification with a specific timeout.
   * @param message A text message to be displayed.
   * @param timeout The seconds which this notification will be presented on screen.
   */
  showNotification(message: string, timeout?: number): void;

  /**
   * Localize a message identified by messageKey and return the result string.
   * @param args The input message key to be localized with other arguments.
   */
  localize(...args: string[]): string;
}

/**
 * The UI services provided by Outline, which can be used in Non-UI code.
 */
export class OutlineUIService {
  private _handler: OutlineUIServiceHandler;

  /**
   * Display a confirmation dialog and return the user response.
   * @param messageKey A localizable message key to be displayed to the user.
   */
  public showConfirmation(messageKey: string): Promise<boolean> {
    console.assert(this._handler, 'there are no actual UI handlers registered');
    const message = this._handler.localize(messageKey);
    return this._handler.showSimpleDialog(message, false);
  }

  /**
   * Display a simple text notification with an optional timeout (in seconds).
   * @param messageKey A localizable message key to be displayed.
   * @param timeout The seconds which this notification will be presented on screen.
   */
  public showSimpleNotification(messageKey: string, timeout?: number): void {
    console.assert(this._handler, 'there are no actual UI handlers registered');
    const message = this._handler.localize(messageKey);
    this._handler.showNotification(message, timeout);
  }

  /**
   * Set the actual UI service handler. (typically this should be called in the App class)
   * @param value The actual UI service handler.
   */
  public setHandler(value: OutlineUIServiceHandler) {
    this._handler = value;
  }
}
