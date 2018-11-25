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

  Usage: python tools/l10n/import_native_android_strings.py $TRANSLATION_FILE $OUTPUT_FILE
  Example: python tools/l10n/import_native_android_strings.py www/messages/en.json
            cordova-plugin-outline/android/resources/strings/values-en/strings.xml
"""

import json
import sys

# Keys to import.
NATIVE_KEYS = [
  "connected_server_state",
  "reconnecting_server_state",
  "server_default_name_outline"
]
XML_TEMPLATE = '''<?xml version='1.0' encoding='utf-8'?>
<resources>
\t<string name="app_name">Outline</string>
\t<string name="launcher_name">@string/app_name</string>
\t<string name="activity_name">@string/launcher_name</string>{0}
</resources>
'''
MESSAGE_TEMPLATE="\n\t<string name=\"{0}\">{1}</string>"

def read_input(filename):
  with open(filename) as f:
    return json.loads(f.read())

def format_messages(messages_dict):
  """ Formats input messages in Polymer format to native Android format. This means replacing
      hyphens with underscores in keys and escaping apostrophes in values. """
  formatted_messages = {}
  for k,v in messages_dict.items():
    formatted_messages[k.replace("-", "_")] = v.replace("'", "\\'")
  return formatted_messages

def write_output(output, filename):
  with open(filename, "w+") as f:
    f.write(output)

def main(argv):
  if len(argv) < 3:
    raise RuntimeError("Too few command-line arguments.")
  input_filename = argv[1]
  output_filename = argv[2]
  polymer_messages = read_input(input_filename)
  messages = format_messages(polymer_messages)
  xml_entry_template = ''
  xml_messages = ''
  for k, v in messages.items():
    if k not in NATIVE_KEYS:
      continue
    xml_messages += MESSAGE_TEMPLATE.format(k.encode("utf-8"), v.encode("utf-8"))

  xml = XML_TEMPLATE.format(xml_messages)
  write_output(xml, output_filename)


if __name__ == "__main__":
  main(sys.argv)
