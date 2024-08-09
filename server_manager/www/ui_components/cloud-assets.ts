/*
  Copyright 2021 The Outline Authors

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

export enum DisplayCloudId {
  DO = 'do',
  GCP = 'gcp',
}

export function getCloudIcon(id: DisplayCloudId): string {
  switch (id) {
    case DisplayCloudId.DO:
      return 'images/do_white_logo.svg';
    case DisplayCloudId.GCP:
      return 'images/gcp-logo.svg';
    default:
      return null;
  }
}

export function getCloudName(id: DisplayCloudId): string {
  switch (id) {
    case DisplayCloudId.DO:
      return 'DigitalOcean';
    case DisplayCloudId.GCP:
      return 'Google Cloud Platform';
    default:
      return null;
  }
}
