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

import {ValueStream} from './value_stream';

describe('ValueStream', () => {
  it('get returns initial value', () => {
    const stream = new ValueStream<string>('foo');
    expect(stream.get()).toEqual('foo');
  });

  it('watch yields initial value', async () => {
    const stream = new ValueStream<string>('foo');
    for await (const value of stream.watch()) {
      expect(value).toEqual('foo');
      return;
    }
    fail("Loop didn't run");
  });

  it('watch on a closed stream yields the final value and exits', async () => {
    const stream = new ValueStream<string>('foo');
    stream.close();
    for await (const value of stream.watch()) {
      expect(value).toEqual('foo');
    }
  });

  it('closing a stream terminates existing watchers', async () => {
    const stream = new ValueStream<string>('foo');
    for await (const value of stream.watch()) {
      expect(value).toEqual('foo');
      stream.close();
    }
  });

  it('close can safely be called twice', async () => {
    const stream = new ValueStream<string>('foo');
    stream.close();
    stream.close();
  });

  it('get works after close', () => {
    const stream = new ValueStream<string>('foo');
    stream.close();
    expect(stream.get()).toEqual('foo');
  });

  it('set changes the value', () => {
    const stream = new ValueStream<string>('foo');
    stream.set('bar');
    expect(stream.get()).toEqual('bar');
  });

  it('set updates the generator', async () => {
    const stream = new ValueStream<string>('foo');
    for await (const value of stream.watch()) {
      if (value === 'foo') {
        stream.set('bar');
      } else {
        expect(value).toEqual('bar');
        break;
      }
    }
  });

  it('the last update in a burst is received', async () => {
    const stream = new ValueStream<string>('foo');
    let value;
    for await (value of stream.watch()) {
      if (value === 'foo') {
        stream.set('bar');
        stream.set('baz');
      } else if (value === 'baz') {
        stream.close();
      }
    }
  });

  it('updates can be made during updates', async () => {
    const stream = new ValueStream<number>(0);
    const stepTo10 = async () => {
      for await (const value of stream.watch()) {
        if (value === 10) {
          break;
        }
        stream.set(value + 1);
      }
    };

    await Promise.all([stepTo10(), stepTo10(), stepTo10()]);
    expect(stream.get()).toEqual(10);
  });
});
