/*
  Copyright 2022 The Outline Authors

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

// TODO(daniellacosse): requires electron context (should be somewhere in src/electron)
// import * as electronMain from './app/electron_main';
// import * as electronOutlineTunnel from './app/electron_outline_tunnel';

// TODO(daniellacosse): requires cordova context (should be somewhere in src/cordova)
// import * as cordovaMain from './app/cordova_main';

// TODO(daniellacosse): these modules have side effects, causing them to fail when we import into the test. They need to be encapsulated.
// import * as main from './app/main';
// import * as environment from './app/environment';
// import * as outlineIcons from './ui_components/outline-icons';

import * as clipboard from './app/clipboard';
import * as errorReporter from './shared/error_reporter';
import * as platform from './app/platform';
import * as tunnel from './app/tunnel';
import * as updater from './app/updater';
import * as urlInterceptor from './app/url_interceptor';
import * as vpnInstaller from './app/vpn_installer';

import * as aboutView from './ui_components/about-view';
import * as addServerView from './ui_components/add-server-view';
import * as appRoot from './ui_components/app-root.js';
import * as feedbackView from './ui_components/feedback-view';
import * as languageView from './ui_components/language-view';
import * as privacyView from './ui_components/privacy-view';
import * as serverRenameDialog from './ui_components/server-rename-dialog';
import * as userCommsDialog from './ui_components/user-comms-dialog';

describe('TODOs', () => {
  it('loads all the files that have no tests against them', () => {
    // expect(environment).toBeDefined();
    // expect(main).toBeDefined();
    // expect(outlineIcons).toBeDefined();
    expect(aboutView).toBeDefined();
    expect(addServerView).toBeDefined();
    expect(appRoot).toBeDefined();
    expect(clipboard).toBeDefined();
    expect(errorReporter).toBeDefined();
    expect(feedbackView).toBeDefined();
    expect(languageView).toBeDefined();
    expect(platform).toBeDefined();
    expect(privacyView).toBeDefined();
    expect(serverRenameDialog).toBeDefined();
    expect(tunnel).toBeDefined();
    expect(updater).toBeDefined();
    expect(urlInterceptor).toBeDefined();
    expect(userCommsDialog).toBeDefined();
    expect(vpnInstaller).toBeDefined();
  });
});
