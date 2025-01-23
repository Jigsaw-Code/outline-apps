// Copyright 2020 The Outline Authors
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

import {PlatformError, GoErrorCode} from './platform_error';

describe('PlatformError', () => {
  it('serializes correctly', () => {
    const err = new PlatformError(GoErrorCode.GENERIC_ERROR, 'Error message', {
      details: {property: 'value'},
      cause: new Error('cause message'),
    });

    expect(Object.getOwnPropertyNames(err)).toEqual([
      'stack',
      'message',
      'cause',
      'name',
      'details',
    ]);

    delete err.stack;
    expect(JSON.stringify(err, Object.getOwnPropertyNames(err))).toEqual(
      'fail'
    );

    const errJson = JSON.parse(
      JSON.stringify(err, Object.getOwnPropertyNames(err))
    );
    expect(errJson.details.property).toEqual('value');
    // delete errJson.stack;
    // delete errJson.cause.stack;
    // expect(errJson).toEqual({
    //   name: 'ERR_GENERIC',
    //   message: 'Error message',
    //   details: {
    //     property: 'value',
    //   },
    //   cause: {name: 'Error', message: 'cause message'},
    // });
  });
});
