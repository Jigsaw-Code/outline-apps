/*
  Copyright 2020 The Outline Authors

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

const $_documentContainer = document.createElement('template');

$_documentContainer.innerHTML = `<iron-iconset-svg name="outline-icons" size="24">
  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 24 24" style="enable-background:new 0 0 24 24;" xml:space="preserve">
    <g id="outline">
      <path d="M23.9,10.7c-0.6-5.4-4.8-9.6-10.1-10.2v4.7c3.7,0.7,6.1,4.2,5.5,7.9c-0.5,2.8-2.7,5.1-5.5,5.6v4.7
        C20.1,22.6,24.6,17,23.9,10.7z"></path>
      <path d="M0.1,13.1c0.6,5.4,4.8,9.6,10.1,10.2v-4v-0.6V5.2V3.9V0.5C4,1.3-0.5,6.9,0.1,13.1z"></path>
    </g>
  </svg>
</iron-iconset-svg>`;

document.head.appendChild($_documentContainer.content);
;
