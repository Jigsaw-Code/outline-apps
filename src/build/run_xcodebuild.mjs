// Copyright 2023 The Outline Authors
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

import {spawnStream} from './spawn_stream.mjs';

const runXcodebuild = (command, flags) =>
  spawnStream('xcodebuild', command, ...Object.entries(flags).flatMap(([key, value]) => [`-${key}`, value]));

export const clean = flags => runXcodebuild('clean', flags);
export const test = flags => runXcodebuild('test', flags);
export const build = flags => runXcodebuild('build', flags);
export const archive = flags => runXcodebuild('archive', flags);
