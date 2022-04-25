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

import {html, css, LitElement} from "lit";
import {customElement, property, state} from "lit/decorators.js";

export enum ServerConnectionState {
  INITIAL = "initial",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  DISCONNECTING = "disconnecting",
  DISCONNECTED = "disconnected",
}

const ANIMATION_DURATION_MS = 1750;
const CIRCLE_SIZES = [css`large`, css`medium`, css`small`];

@customElement("server-connection-indicator")
export class ServerConnectionIndicator extends LitElement {
  @property({attribute: "connection-state"}) connectionState: ServerConnectionState;
  @property({attribute: "root-path"}) rootPath: string;

  @state() private animationState: ServerConnectionState = ServerConnectionState.INITIAL;
  private animationStartMS: number;

  static styles = [
    css`
      :host {
        position: relative;
        display: inline-block;
        aspect-ratio: 1;

        --timing: ${ANIMATION_DURATION_MS}ms;
        --timing-function: ease-out;

        --circle-large-scale: scale(1);
        --circle-large-delay: 500ms;

        --circle-medium-scale: scale(0.66);
        --circle-medium-delay: 250ms;

        --circle-small-scale: scale(0.33);
        --circle-small-delay: 0ms;

        --circle-initial-opacity: 0.5;
        --circle-initial-color: grayscale(0.5);

        --circle-connected-opacity: 1;
        --circle-connected-color: grayscale(0);

        --circle-disconnected-opacity: 1;
        --circle-disconnected-color: grayscale(1);
      }

      :host,
      .circle {
        width: 100%;
        height: 100%;
      }

      .circle {
        position: absolute;
        display: inline-block;

        transition-property: transform, filter, opacity;
        transition-duration: var(--timing);
        transition-timing-function: var(--timing-function);

        animation-duration: var(--timing);
        animation-timing-function: var(--timing-function);
        animation-iteration-count: infinite;
      }

      .circle-initial {
        opacity: var(--circle-initial-opacity);
        filter: var(--circle-initial-color);
      }

      .circle-connected,
      .circle-reconnecting,
      .circle-disconnecting {
        opacity: var(--circle-connected-opacity);
        filter: var(--circle-connected-color);
      }

      .circle-disconnected,
      .circle-connecting {
        opacity: var(--circle-disconnected-opacity);
        filter: var(--circle-disconnected-color);
      }

      .circle-disconnecting {
        animation-direction: reverse;
        --timing-function: ease-in;
      }
    `,
    ...CIRCLE_SIZES.map(
      /* prettier-ignore */
      circleSize => css`
        .circle-${circleSize} {
          transform: var(--circle-${circleSize}-scale);
          animation-delay: var(--circle-${circleSize}-delay);
        }

        .circle-${circleSize}.circle-connecting,
        .circle-${circleSize}.circle-reconnecting,
        .circle-${circleSize}.circle-disconnecting {
          animation-name: circle-${circleSize}-rotate-with-pause;
        }

        /* Do not mirror animation for RTL languages */
        /* rtl:begin:ignore */
        @keyframes circle-${circleSize}-rotate-with-pause {
          0% {
            transform: rotate(0deg) var(--circle-${circleSize}-scale);
          }
          60%,
          100% {
            transform: rotate(360deg) var(--circle-${circleSize}-scale);
          }
        }
        /* rtl:end:ignore */
      `
    ),
  ];

  render() {
    if (this.shouldAnimate) {
      this.startAnimation();
    } else if (this.isAnimating && !this.shouldAnimate) {
      this.stopAnimation();
    } else {
      this.animationState = this.connectionState;
    }

    const circles = this.animationState === ServerConnectionState.INITIAL ? [CIRCLE_SIZES[0]] : CIRCLE_SIZES;

    return html`
      ${circles.map(
        circleSize =>
          html`
            <img
              class="circle circle-${circleSize} circle-${this.animationState}"
              src="${this.rootPath}assets/circle.webp"
            />
          `
      )}
    `;
  }

  private get shouldAnimate() {
    return this.isAnimationState(this.connectionState);
  }

  private get isAnimating() {
    return this.isAnimationState(this.animationState);
  }

  private startAnimation() {
    this.animationStartMS = Date.now();

    this.animationState = this.connectionState;
  }

  private stopAnimation() {
    const elapsedAnimationMS = Date.now() - this.animationStartMS;
    const remainingAnimationMS = ANIMATION_DURATION_MS - (elapsedAnimationMS % ANIMATION_DURATION_MS);

    setTimeout(() => (this.animationState = this.connectionState), remainingAnimationMS);
  }

  private isAnimationState(state: ServerConnectionState): boolean {
    return [
      ServerConnectionState.CONNECTING,
      ServerConnectionState.RECONNECTING,
      ServerConnectionState.DISCONNECTING,
    ].includes(state);
  }
}
