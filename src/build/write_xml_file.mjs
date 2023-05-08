// TODO
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

import fs from 'fs/promises';
import xmlbuilder from 'xmlbuilder2';

export async function writeXmlFile(filePath, data, {verbose = false, dtd, encoding = 'UTF-8'} = {}) {
  const xml = xmlbuilder.create({encoding}, data);

  if (dtd) {
    xml.dtd(dtd);
  }

  const xmlContents = xml.end({prettyPrint: true});

  if (verbose) {
    console.info('[writeXmlFile]', {filePath, xmlContents});
  }

  return fs.writeFile(filePath, xmlContents);
}
