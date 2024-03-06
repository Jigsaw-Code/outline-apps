// Copyright 2021 The Outline Authors
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

'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');

const tarballBinary = fs.readFileSync(process.argv[2]);
const base64Tarball = tarballBinary.toString('base64');
const scriptText = `
(base64 --decode | tar --extract --gzip ) <<EOM
${base64Tarball}
EOM
./gcp_install_server.sh
`;

console.log(`export const SCRIPT = ${JSON.stringify(scriptText)};`);
