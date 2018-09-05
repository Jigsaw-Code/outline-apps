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


 Validates that all the keys in the master messages file are present in localized files.
 Usage: python scripts/l10n/validate_localized_keys.py (from repository root)

"""

import codecs
import json
import os

ORIGINAL_MESSAGES_FILE = "resources/master_messages.json"
SOURCE_FOLDER = "www/messages/"

def read_json_content(filename):
  json_content = {}
  with codecs.open(filename, encoding="utf-8") as f:
    json_content = json.loads(f.read())
  if not json_content:
    print("ERROR: No content found in ", filename)
  return json_content

def format_original_message_keys(orignal_messages):
  formatted_messages = {}
  for key, message in orignal_messages.items():
    formatted_messages[key.replace('_', '-')] = message
  return formatted_messages

def validate_keys(original_keys, translation_keys):
  """ Prints keys present in |original_keys|, missing from |translation_keys|. """
  valid = True
  for key in original_keys:
    if key not in translation_keys:
      print("\tMissing key: %s" % key)
      valid = False
  return valid

def main():
  orignal_messages = format_original_message_keys(read_json_content(ORIGINAL_MESSAGES_FILE))
  for root, _, files in os.walk(SOURCE_FOLDER):
    for file in files:
      lang, file_extension = os.path.splitext(file)
      if file_extension != ".json":
        continue

      print("Validating %s" % lang)
      tranlsation_file = os.path.join(root, file)
      if not validate_keys(orignal_messages.keys(), read_json_content(tranlsation_file).keys()):
        raise Exception()


if __name__ == "__main__":
  main()
