// Copyright 2018 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//,
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {makeConfig, SIP002_URI} from 'ShadowsocksConfig';
import {ShadowsocksConfig} from '../../config';

export class OutlineServiceConfig {
  constructor(
    public serviceName: string,
    public connection: Readonly<ShadowsocksConfig>,
    public isOutlineService: boolean = false
  ) {}

  get connectionAddress(): string {
    const {host, port} = this.connection;

    if (!host) {
      return '';
    }

    return `${host}${port ? ':' : ''}${port}`;
  }

  isEqualTo(that: OutlineServiceConfig) {
    return (
      this.connection.host === that.connection.host &&
      this.connection.port === that.connection.port &&
      this.connection.password === that.connection.password &&
      this.connection.method === that.connection.method
    );
  }

  toString() {
    return SIP002_URI.stringify(makeConfig(this.connection));
  }

  // async loadConnectionConfig(): Promise<Readonly<ShadowsocksConfig>> {
  //   return this.connection;
  // }
}
