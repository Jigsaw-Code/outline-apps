#!/bin/bash
#
# Copyright 2018 The Outline Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Usage:
#   ./import_translations.sh <translations-directory>
# Expects <translations-directory> to contain locale-named subdirectories with a single
# messages.json file in chrome app format.

set -eu

# Converts a Polymer locale to a native Android locale.
function get_native_android_locale() {
  case "$1" in
    "zh-CN" | "zh-TW" | "pt-BR" | "pt-PT") echo $1 | sed -e 's/-/-r/g';;
    "es-419") echo 'es';;
    "sr-Latn") echo 'b+sr+Latn';;
    *) echo "$1";;
  esac
}

TRANSLATIONS_DIR="$ROOT_DIR/www/messages"
for TRANSLATION_FILE in $TRANSLATIONS_DIR/*; do
  LANG=`basename $TRANSLATION_FILE .json`
  echo "Importing ${LANG}"
  LANG=$(get_native_android_locale $LANG)

  NATIVE_DIR="cordova-plugin-outline/android/resources/strings/values-$LANG"
  OUTPUT_FILE="$NATIVE_DIR/strings.xml"
  python $ROOT_DIR/scripts/l10n/import_native_android_strings.py $TRANSLATION_FILE $OUTPUT_FILE
done

