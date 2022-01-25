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

/// <reference path='../../types/ambient/clipboard.d.ts'/>

import {AbstractClipboard} from './clipboard_common';

// Pushes a clipboard event whenever the app is brought to the foreground.
export class CordovaClipboard extends AbstractClipboard {
  constructor() {
    super();
    document.addEventListener('resume', this.emitEvent.bind(this));
  }

  getContents() {
    return new Promise<string>((resolve, reject) => {
      cordova.plugins.clipboard.paste(resolve, reject);
    });
  }
}
