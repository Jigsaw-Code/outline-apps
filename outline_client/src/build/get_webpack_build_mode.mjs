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

/*
  Inputs:
  => buildMode: the outline build mode

  Outputs:
  => the appropriate webpack mode for this type of build
*/
export function getWebpackBuildMode(buildMode) {
  switch (buildMode) {
    case 'debug':
      return 'development';
    case 'release':
      return 'production';
    default:
      throw new TypeError('get_webpack_mode requires a buildMode argument of debug or release');
  }
}
