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

// Typings for:
// https://github.com/oyyd/http-proxy-to-socks

declare module 'http-proxy-to-socks/lib/proxy_server' {
// Normally imports would come first but we must make the first statement of the file be a declare
// in order for the TypeScript compiler to accept this file as a .d.ts.
import * as http from 'http';

  function createServer(args: {socks: string;}): http.Server;
}
