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
SOURCE_FOLDER = "src/www/messages/"
ENGLISH_LOCALE = "en"
# Message keys that are not expected to be translated, i.e. a key for 'Outline'.
UNTRANSLATED_KEYS = ['servers-page-title']

def read_json_content(filename):
  json_content = {}
  with codecs.open(filename, encoding="utf-8") as f:
    json_content = json.loads(f.read())
  if not json_content:
    print("ERROR: No content found in ", filename)
  return json_content

def format_original_message_keys(original_messages):
  formatted_messages = {}
  for key, data in original_messages.items():
    formatted_messages[key.replace('_', '-')] = data['message']
  return formatted_messages

def validate_keys(original_messages, translation_messages, locale):
  """ Prints keys present in |original_messages|, missing from |translation_messages|, or keys that
      have not been translated.
  """
  valid = True
  translation_keys = translation_messages.keys()
  for key in original_messages.keys():
    # print (key,original_messages[key], translation_messages[key])
    if key not in translation_keys:
      print("\tMissing key: %s" % key)
      valid = False
    if key not in UNTRANSLATED_KEYS and locale != ENGLISH_LOCALE and \
        original_messages[key] == translation_messages[key]:
      # Don't mark as invalid because the translation could intentionally match the original English
      # message.
      print("\tKey %s ('%s') not translated" % (key, original_messages[key]))
  return valid

def main():
  original_messages = format_original_message_keys(read_json_content(ORIGINAL_MESSAGES_FILE))
  for root, _, files in os.walk(SOURCE_FOLDER):
    for file in files:
      lang, file_extension = os.path.splitext(file)
      if file_extension != ".json":
        continue

      print("Validating %s" % lang)
      translation_file = os.path.join(root, file)
      if not validate_keys(original_messages, read_json_content(translation_file), lang):
        raise Exception()

if __name__ == "__main__":
  main()
