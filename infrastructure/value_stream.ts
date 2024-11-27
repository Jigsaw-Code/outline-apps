// Copyright 2021 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Represents a value that can change over time, with a generator that
 * exposes changes to the value.
 *
 * Watchers are not guaranteed to see every intermediate value, but are
 * guaranteed to see the last value in a series of updates.
 */
export class ValueStream<T> {
  private wakers: Array<(_closed: boolean) => void> | null = [];
  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(newValue: T) {
    if (this.wakers === null) {
      throw new Error('Cannot change a closed value stream');
    }
    this.value = newValue;
    const wakers = this.wakers;
    this.wakers = [];
    wakers.forEach(waker => waker(false));
  }

  close() {
    if (this.wakers === null) {
      return;
    }
    const finalWakers = this.wakers;
    this.wakers = null;
    finalWakers.forEach(waker => waker(true));
  }

  isClosed() {
    return this.wakers === null;
  }

  private nextChange(): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      if (this.wakers === null) {
        return resolve(true);
      }
      return this.wakers.push(resolve);
    });
  }

  async *watch(): AsyncGenerator<T, void> {
    let closed = false;
    while (!closed) {
      const nextChange = this.nextChange();
      yield this.value;
      closed = await nextChange;
    }
    yield this.value;
  }
}
