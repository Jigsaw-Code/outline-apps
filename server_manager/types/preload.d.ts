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

// Functions made available to the renderer process via preload.ts.

type SentryBreadcrumb = import('@sentry/electron').Breadcrumb;
declare function redactSentryBreadcrumbUrl(
  breadcrumb: SentryBreadcrumb
): SentryBreadcrumb;

type HttpRequest = import('@outline/infrastructure/path_api').HttpRequest;
type HttpResponse = import('@outline/infrastructure/path_api').HttpResponse;

declare function fetchWithPin(
  request: HttpRequest,
  fingerprint: string
): Promise<HttpResponse>;
declare function openImage(basename: string): void;
declare function onUpdateDownloaded(callback: () => void): void;

// TODO: Move this back to digitalocean_oauth.ts, where it really belongs.
interface OauthSession {
  // Resolves with the OAuth token if authentication was successful, otherwise rejects.
  result: Promise<string>;
  // Returns true iff the session has been cancelled.
  isCancelled(): boolean;
  // Cancels the session, causing the result promise to reject and isCancelled to return true.
  cancel(): void;
}

declare function runDigitalOceanOauth(): OauthSession;

declare function runGcpOauth(): OauthSession;

declare function bringToFront(): void;

// From base.webpack.js.
declare const outline: {gcpAuthEnabled: boolean};
