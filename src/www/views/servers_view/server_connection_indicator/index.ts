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

@customElement("server-connection-indicator")
export class ServerConnectionIndicator extends LitElement {
  @property({attribute: "connection-state"}) connectionState: ServerConnectionState;

  @state() private animationState: ServerConnectionState = ServerConnectionState.INITIAL;
  private animationStartMS: number;

  static styles = css`
    :host {
      position: relative;
      display: inline-block;
      aspect-ratio: 1;

      --timing: ${ANIMATION_DURATION_MS}ms;
      --timing-function: ease-out;

      --large-circle-scale: scale(1);
      --large-circle-delay: 500ms;

      --medium-circle-scale: scale(0.5);
      --medium-circle-delay: 250ms;

      --small-circle-scale: scale(0.33);
      --small-circle-delay: 0ms;

      --initial-circle-opacity: 0.5;
      --initial-circle-color: grayscale(0.5);

      --connected-circle-opacity: 1;
      --connected-circle-color: grayscale(0);

      --disconnected-circle-opacity: 1;
      --disconnected-circle-color: grayscale(1);
    }

    :host,
    .circle {
      width: 100%;
      height: 100%;
    }

    .circle {
      position: absolute;
      display: inline-block;

      transition-property: filter, opacity;
      transition-timing: var(--timing);
      transition-timing-function: var(--timing-function);

      animation-timing: var(--timing);
      animation-timing-function: var(--timing-function);
      animation-iteration-count: infinite;
    }

    .circle-large {
      transform: var(--large-circle-scale);
      animation-delay: var(--large-circle-delay);
    }

    .circle-medium {
      transform: var(--medium-circle-scale);
      animation-delay: var(--medium-circle-delay);
    }

    .circle-small {
      transform: var(--small-circle-scale);
      animation-delay: var(--small-circle-delay);
    }

    .circle-initial {
      opacity: var(--initial-circle-opacity);
      filter: var(--initial-circle-color);
    }

    .circle-connected,
    .circle-disconnecting {
      opacity: var(--connected-circle-opacity);
      filter: var(--connected-circle-color);
    }

    .circle-disconnected,
    .circle-connecting {
      opacity: var(--disconnected-circle-opacity);
      filter: var(--disconnected-circle-color);
    }

    .circle-connecting,
    .circle-disconnecting {
      animation-name: rotate-with-pause;
    }

    .circle-disconnecting {
      animation-direction: reverse;
    }

    @keyframes rotate-with-pause {
      0% {
        transform: rotate(0deg);
      }
      60%,
      100% {
        transform: rotate(360deg);
      }
    }
  `;

  render() {
    if (this.shouldAnimate) {
      this.startAnimation();
    }

    if (this.isAnimating && !this.shouldAnimate) {
      this.stopAnimation();
    }

    const circles = this.animationState === ServerConnectionState.INITIAL ? ["large"] : ["large", "medium", "small"];

    return html`
      ${circles.map(
        circleSize =>
          html`
            <img class="circle circle-${circleSize} circle-${this.animationState}" src="assets/disc_color.png" />
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
      ServerConnectionState.DISCONNECTING,
      ServerConnectionState.RECONNECTING,
    ].includes(state);
  }
}
