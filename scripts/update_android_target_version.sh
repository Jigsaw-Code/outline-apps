#!/bin/bash -eu

# Copyright 2019 The Outline Authors
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

# cordova-android 7.1.4 does not support Android SDK 28 (Android P). Override the Android Studio
# Gradle project target version with this workaround until upgrading to cordova-android 8.0.0.
echo "Updating Android target version"
sed -i -e "s/android-27/android-28/g" platforms/android/project.properties
