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

import {computed, customElement, property} from '@polymer/decorators';
import {html, PolymerElement} from '@polymer/polymer';
import {LegacyElementMixin} from '@polymer/polymer/lib/legacy/legacy-element-mixin';

export enum ServerConnectionState {
  INITIAL = 'INITIAL',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTING = 'DISCONNECTING',
  DISCONNECTED = 'DISCONNECTED'
}

@customElement('server-connection-viz') export class ServerConnectionViz extends LegacyElementMixin
(PolymerElement) {
  static ANIMATION_DURATION_MS = 1750;

  static template = html`
    <style>
      /* Do not mirror animation for RTL languages */
      /* rtl:begin:ignore */
      @keyframes rotate-with-pause {
        0% {
          transform: rotate(0deg);
        }
        60%,
        100% {
          transform: rotate(360deg);
        }
      }
      @keyframes rotate-backward-with-pause {
        0% {
          transform: rotate(360deg);
        }
        60%,
        100% {
          transform: rotate(0deg);
        }
      }
      :host {
        margin: 0 auto;
      }
      #container {
        border-radius: 80px;
        margin: 0 auto;
        position: relative;
      }
      img {
        position: absolute;
        display: inline-block;
        transition-timing-function: ease-out;
        transition-duration: 1s;
      }
      .grey.DISCONNECTED {
        opacity: 1;
      }
      .grey.CONNECTED {
        opacity: 0;
      }
      .grey.DISCONNECTING {
        opacity: 0.8;
      }
      .grey.INITIAL,
      .green.INITIAL,
      .green.DISCONNECTED,
      .green.CONNECTING,
      .green.RECONNECTING,
      .green.DISCONNECTING {
        opacity: 0;
      }
      .green.CONNECTED {
        opacity: 1;
      }
      #small.CONNECTING,
      #small-grey.CONNECTING,
      #small.RECONNECTING,
      #small-grey.RECONNECTING {
        animation: rotate-with-pause 1.75s ease-out infinite;
      }
      #medium.CONNECTING,
      #medium-grey.CONNECTING,
      #medium.RECONNECTING,
      #medium-grey.RECONNECTING {
        animation: rotate-with-pause 1.75s ease-out 250ms infinite;
      }
      #large.CONNECTING,
      #large-grey.CONNECTING,
      #large.RECONNECTING,
      #large-grey.RECONNECTING {
        animation: rotate-with-pause 1.75s ease-out 500ms infinite;
      }
      #small.DISCONNECTING,
      #small-grey.DISCONNECTING {
        animation: rotate-backward-with-pause 1.75s ease-out infinite;
      }
      #medium.DISCONNECTING,
      #medium-grey.DISCONNECTING {
        animation: rotate-backward-with-pause 1.75s ease-out 250ms infinite;
      }
      #large.DISCONNECTING,
      #large-grey.DISCONNECTING {
        animation: rotate-backward-with-pause 1.75s ease-out 500ms infinite;
      }
      #small,
      #small-grey {
        top: 16px;
        left: 16px;
        height: 16px;
        width: 16px;
        z-index: 300;
      }
      #medium,
      #medium-grey {
        top: 8px;
        left: 8px;
        height: 32px;
        width: 32px;
        transition-delay: 250ms;
        z-index: 200;
      }
      #large,
      #large-grey,
      #large-zero {
        top: 0;
        left: 0;
        height: 48px;
        width: 48px;
        transition-delay: 500ms;
        z-index: 100;
      }
      .expanded #small,
      .expanded #small-grey {
        top: 60px;
        left: 60px;
        height: 40px;
        width: 40px;
      }
      .expanded #medium,
      .expanded #medium-grey {
        top: 30px;
        left: 30px;
        height: 100px;
        width: 100px;
      }
      .expanded #large,
      .expanded #large-grey,
      .expanded #large-zero {
        top: 0;
        left: 0;
        height: 160px;
        width: 160px;
      }
      #large {
        position: relative;
      }
      #large-zero {
        opacity: 0;
      }
      #large-zero.INITIAL {
        opacity: 1;
      }
      @media (max-width: 360px) {
        #small,
        #small-grey {
          top: 12px;
          left: 12px;
          height: 8px;
          width: 8px;
        }
        #medium,
        #medium-grey {
          top: 8px;
          left: 8px;
          height: 16px;
          width: 16px;
        }
        #large,
        #large-grey,
        #large-zero {
          top: 0;
          left: 0;
          height: 32px;
          width: 32px;
        }
      }
      @media (min-height: 600px) {
        .expanded #small,
        .expanded #small-grey {
          top: 72px;
          left: 72px;
          height: 48px;
          width: 48px;
        }
        .expanded #medium,
        .expanded #medium-grey {
          top: 36px;
          left: 36px;
          height: 120px;
          width: 120px;
        }
        .expanded #large,
        .expanded #large-grey,
        .expanded #large-zero {
          top: 0;
          left: 0;
          height: 192px;
          width: 192px;
        }
      }
      /* rtl:end:ignore */
    </style>
    <div id="container" class\$="[[expandedClassName]]">
      <img id="small-grey" src\$="[[rootPath]]assets/disc_grey.png" class\$="grey {{animationState}}">
      <img id="small" src\$="[[rootPath]]assets/disc_color.png" class\$="green {{animationState}}">
      <img id="medium-grey" src\$="[[rootPath]]assets/disc_grey.png" class\$="grey {{animationState}}">
      <img id="medium" src\$="[[rootPath]]assets/disc_color.png" class\$="green {{animationState}}">
      <img id="large-grey" src\$="[[rootPath]]assets/disc_grey.png" class\$="grey {{animationState}}">
      <img id="large-zero" src\$="[[rootPath]]assets/disc_empty.png" class\$="{{state}}">
      <img id="large" src\$="[[rootPath]]assets/disc_color.png" class\$="green {{animationState}}">
    </div>
  `;

  animationStartMS: number;

  @property({type: String}) rootPath: string;
  @property({type: Boolean}) expanded: boolean;

  @property({type: String, observer: 'syncAnimationState'}) state: ServerConnectionState;
  @property({type: String}) animationState: ServerConnectionState = ServerConnectionState.INITIAL;

  @computed('expanded')
  get expandedClassName() {
    return this.expanded ? 'expanded' : '';
  }

  @computed('state')
  get shouldAnimate() {
    return this.isAnimationState(this.state);
  }

  @computed('animationState')
  get isAnimating() {
    return this.isAnimationState(this.animationState);
  }

  // @ts-ignore
  private syncAnimationState() {
    if (this.shouldAnimate) {
      return this.startAnimation();
    }

    if (!this.shouldAnimate && this.isAnimating) {
      return this.stopAnimation();
    }

    this.animationState = this.state;
  }

  private startAnimation() {
    this.animationStartMS = Date.now();

    this.animationState = this.state;
  }

  private stopAnimation() {
    const elapsedAnimationMS = Date.now() - this.animationStartMS;
    const remainingAnimationMS =
        (ServerConnectionViz.ANIMATION_DURATION_MS -
         (elapsedAnimationMS % ServerConnectionViz.ANIMATION_DURATION_MS));

    this.async(() => this.animationState = this.state, remainingAnimationMS);
  }

  private isAnimationState(state: ServerConnectionState): boolean {
    return [
      ServerConnectionState.CONNECTING, ServerConnectionState.DISCONNECTING, ServerConnectionState.RECONNECTING
    ].includes(state);
  }
}