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

import {ChildProcess, spawn} from 'node:child_process';
import {basename} from 'node:path';
import process from 'node:process';

// Simple "one shot" child process launcher.
//
// NOTE: Because there is no way in Node.js to tell whether a process launched successfully,
//       #startInternal always succeeds; use #onExit to be notified when the process has exited
//       (which may be immediately after calling #startInternal if, e.g. the binary cannot be
//       found).
export class ChildProcessHelper {
  private readonly processName: string;
  private subProcess?: ChildProcess = null;
  private exitCodePromise?: Promise<number | string> = Promise.resolve('not started');
  private isDebug = false;

  private stdErrListener?: (data?: string | Buffer) => void;

  constructor(private readonly path: string) {
    this.processName = basename(this.path);
  }

  /**
   * Starts the process with the given args. If enableDebug() has been called, then the process is
   * started in verbose mode if supported. This method will only start the process, it will not
   * wait for it to be ended. Please use stop() or waitForExit() instead.
   * @param args The args for the process
   */
  launch(args: string[]): void {
    if (this.subProcess) {
      throw new Error(`subprocess ${this.processName} has already been launched`);
    }
    this.subProcess = spawn(this.path, args);
    this.exitCodePromise = new Promise(resolve => {
      const onExit = (code?: number, signal?: string) => {
        if (this.subProcess) {
          this.subProcess.removeAllListeners();
          this.subProcess = null;
        } else {
          // When listening to both the 'exit' and 'error' events, guard against accidentally
          // invoking handler functions multiple times.
          return;
        }

        logExit(this.processName, code, signal);
        resolve(code ?? signal);
      };

      const onStdErr = (data?: string | Buffer) => {
        if (this.isDebugModeEnabled) {
          console.error(`[STDERR - ${this.processName}]: ${data}`);
        }
        if (this.stdErrListener) {
          this.stdErrListener(data);
        }
      };
      this.subProcess.stderr.on('data', onStdErr.bind(this));

      if (this.isDebugModeEnabled) {
        // Redirect subprocess output while bypassing the Node console.  This makes sure we don't
        // send web traffic information to Sentry.
        this.subProcess.stdout.pipe(process.stdout);
        this.subProcess.stderr.pipe(process.stderr);
      }

      // We have to listen for both events: error means the process could not be launched and in that
      // case exit will not be invoked.
      this.subProcess.on('error', onExit.bind(this));
      this.subProcess.on('exit', onExit.bind(this));
    });
  }

  /**
   * Try to kill the process and wait for the exit code.
   * @returns Either an exit code or a signal string (if the process is ended by a signal).
   */
  stop(): Promise<number | string> {
    if (!this.subProcess) {
      // Never started.
      return;
    }
    this.subProcess.kill();
    return this.exitCodePromise;
  }

  /**
   * Wait for the process to end, and get out the exit code.
   * @returns Either an exit code or a signal string (if the process is ended by a signal).
   */
  waitForEnd(): Promise<number | string> {
    return this.exitCodePromise;
  }

  set onStdErr(listener: ((data?: string | Buffer) => void) | undefined) {
    this.stdErrListener = listener;
    if (!this.stdErrListener && !this.isDebugModeEnabled) {
      this.subProcess?.stderr.removeAllListeners();
    }
  }

  /**
   * Whether to enable verbose logging for the process.  Must be called before launch().
   */
  set isDebugModeEnabled(value: boolean) {
    this.isDebug = value;
  }

  /**
   * Get a value indicates whether verbose logging for the process is enabled.
   */
  get isDebugModeEnabled(): boolean {
    return this.isDebug;
  }
}

function logExit(processName: string, exitCode?: number, signal?: string) {
  const prefix = `[EXIT - ${processName}]: `;
  if (exitCode !== null) {
    const log = exitCode === 0 ? console.log : console.error;
    log(`${prefix}Exited with code ${exitCode}`);
  } else if (signal !== null) {
    const log = signal === 'SIGTERM' ? console.log : console.error;
    log(`${prefix}Killed by signal ${signal}`);
  } else {
    // This should never happen.  It likely signals an internal error in Node, as it is supposed to
    // always pass either an exit code or an exit signal to the exit handler.
    console.error(`${prefix}Process exited for an unknown reason.`);
  }
}
