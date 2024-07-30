/*
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
*/

import '@polymer/iron-iconset-svg/iron-iconset-svg';
import {html} from '@polymer/polymer/lib/utils/html-tag';

const template = html`<iron-iconset-svg name="outline-iconset" size="24">
  <svg>
    <defs>
      <g id="outline">
        <g>
          <polygon
            points="11.7,5.5 15.6,7.8 15.6,14.1 11.7,16.4 11.7,18.8 11.7,21 19.6,16.4 19.6,5.5 11.7,1 11.7,3.4 		"
          />
        </g>
        <g>
          <polygon points="8.9,17.2 4.1,14.4 4.1,7.5 8.9,4.7 8.9,5.8 5.1,8.1 5.1,13.9 8.9,16.1 		" />
        </g>
        <g>
          <polygon points="8.9,21.7 0.2,16.7 0.2,5.2 8.9,0.1 8.9,1.3 1.1,5.8 1.2,16.2 8.9,20.6 		" />
        </g>
      </g>
      <g id="devices">
        <path
          d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"
        ></path>
      </g>
      <g id="share">
        <path
          d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"
        ></path>
      </g>
      <g id="key">
        <path
          d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"
        ></path>
      </g>
    </defs>
  </svg>
</iron-iconset-svg>`;

document.head.appendChild(template.content);
