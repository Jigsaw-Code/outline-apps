// Copyright 2019 The Outline Authors
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

import { ChildProcess, spawn } from 'child_process';

// Simple child process launcher. Launches the process on construction.
//
// NOTE: Because there is no way in Node.js to tell whether a process launched
//       successfully, use #onExit to be notified when the process has exited
//       (which may be immediately after construction if, e.g. the binary cannot be
//       found).
export class ChildProcessHelper {
  private process: ChildProcess;
  private running = false;

  private resolveExit!: (code?: number) => void;
  private exited = new Promise<number>(resolve => {
    this.resolveExit = resolve;
  });
  private stdErrListener?: (data?: string | Buffer) => void;

  constructor(path: string, args: string[]) {
    this.process = spawn(path, args);
    this.running = true;

    const onExit = (code?: number, signal?: string) => {
      this.running = false;
      if (this.process) {
        // Prevent registering duplicate listeners on re-launch.
        this.process.removeAllListeners();
      }
      this.resolveExit(code);
      // Recreate the exit promise to support re-launching.
      this.exited = new Promise<number>(resolve => {
        this.resolveExit = resolve;
      });
    };

    const onStdErr = (data?: string | Buffer) => {
      if (this.stdErrListener) {
        this.stdErrListener(data);
      }
    };

    // We have to listen for both events: error means the process could not be launched and in that
    // case exit will not be invoked.
    this.process.on('error', onExit.bind((this)));
    this.process.on('exit', onExit.bind((this)));
    this.process.stderr.on('data', onStdErr.bind(this));
  }

  // Stops the process, resolving when it has exited.
  // Use #onExit to be notified when the process exits spontaneously.
  async stop() {
    if (!this.running || this.process.killed) {
      // Never started or already stopped.
      return;
    }
    return new Promise((resolve, reject) => {
      this.process.removeAllListeners();
      this.process.once('exit', (code) => {
        this.running = false;
        resolve(code);
      });
      this.process.once('error', (e) => {
        console.error(`failed to send kill signal: ${e}`);
        reject(e);
      });
      this.process.kill();
    });
  }

  get onExit(): Promise<number> {
    return this.exited;
  }

  set onStderr(newListener: ((data?: string | Buffer) => void) | undefined) {
    this.stdErrListener = newListener;
  }

  get isRunning(): boolean {
    return this.running;
  }
}
