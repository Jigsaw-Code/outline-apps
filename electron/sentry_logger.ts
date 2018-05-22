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

import {Severity} from '@sentry/core';
import {SentryClient} from '@sentry/electron';

// Convenience wrapper for the Sentry Electron SDK to log breadcrumbs.
// Assumes that Sentry has been initialized.
// Note that error reporting is handled by the Sentry browser SDK.
export class SentryLogger {
  // Logs an info message to console and stores a breadcrumb.
  info(message: string) {
    console.info(message);
    SentryClient.addBreadcrumb({message, level: Severity.Info});
  }

  // Logs an error message to console and stores a breadcrumb.
  error(message: string) {
    console.error(message);
    SentryClient.addBreadcrumb({message, level: Severity.Error});
  }
}
