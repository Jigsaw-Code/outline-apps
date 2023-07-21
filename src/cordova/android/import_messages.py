"""
Copyright 2018 The Outline Authors

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 Generates localized string files for native Android usage based on the front-end translations.

  Usage:
    python src/cordova/android/import_messages.py $TRANSLATION_FILE $OUTPUT_FILE

  Example:
    python src/cordova/android/import_messages.py \
      www/messages/en.json \
      src/cordova/plugin/android/resources/strings/values-en/strings.xml
"""

import json
import os
import sys

DEFAULT_MESSAGES = {
  "app_name": "Outline",
  "launcher_name": "@string/app_name",
  "activity_name": "@string/launcher_name",
}
# Keys to import.
NATIVE_KEYS = [
  "connected_server_state",
  "reconnecting_server_state",
  "server_default_name_outline"
]
XML_TEMPLATE = '''<?xml version='1.0' encoding='utf-8'?>
<resources>
{0}
</resources>
'''
MESSAGE_TEMPLATE="\t<string name=\"{0}\">{1}</string>"


def read_input(filename):
  with open(filename) as f:
    return json.loads(f.read())


def format_messages(messages_dict):
  """ Formats input messages in Polymer format to native Android format. This means replacing
      hyphens with underscores in keys and escaping apostrophes in values. """
  for k, v in messages_dict.items():
    yield k.replace("-", "_"), v.replace("'", "\\'")


def write_output(output, filename):
  directory = os.path.dirname(filename)
  if not os.path.exists(directory):
    os.mkdir(directory)
  with open(filename, "w+") as f:
    f.write(output)


def main(argv):
  if len(argv) < 3:
    raise RuntimeError("Too few command-line arguments.")
  input_filename = argv[1]
  output_filename = argv[2]
  polymer_messages = DEFAULT_MESSAGES.copy()
  polymer_messages.update(read_input(input_filename))
  keys_to_import = list(DEFAULT_MESSAGES.keys()) + NATIVE_KEYS
  messages = [
    MESSAGE_TEMPLATE.format(k, v)
    for k, v in format_messages(polymer_messages)
    if k in keys_to_import
  ]
  xml = XML_TEMPLATE.format('\n'.join(messages))
  write_output(xml, output_filename)


if __name__ == "__main__":
  main(sys.argv)
