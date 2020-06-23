// Copyright 2018 The Outline Authors
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

import * as sentry from '@sentry/browser';

export interface OutlineErrorReporter {
  report(userFeedback: string, feedbackCategory: string, userEmail?: string): Promise<void>;
}

export class SentryErrorReporter implements OutlineErrorReporter {
  constructor(appVersion: string, dsn: string, private tags: {[id: string]: string;}) {
    if (dsn) {
      sentry.init({dsn, release: appVersion});
    }
    this.setUpUnhandledRejectionListener();
  }

  async report(userFeedback: string, feedbackCategory: string, userEmail?: string): Promise<void> {
    sentry.configureScope(scope => {
      scope.setUser({email: userEmail || ''});
      if (this.tags) {
        scope.setTags(this.tags);
      }
      scope.setTag('category', feedbackCategory);
    });
    sentry.captureMessage(userFeedback);
    sentry.configureScope(scope => {
      scope.clear();  // Reset the user context, don't cache the email
    });
  }

  private setUpUnhandledRejectionListener() {
    // Chrome is the only browser that supports the unhandledrejection event.
    // This is fine for Android, but will not work in iOS.
    const unhandledRejection = 'unhandledrejection';
    window.addEventListener(unhandledRejection, (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason.stack ? reason.stack : reason;
      sentry.addBreadcrumb({message: msg, category: unhandledRejection});
    });
  }
}
