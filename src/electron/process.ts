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

import {ChildProcess, spawn} from 'child_process';
import * as path from 'path';

// Simple "one shot" child process launcher.
//
// NOTE: Because there is no way in Node.js to tell whether a process launched successfully,
//       #startInternal always succeeds; use #onExit to be notified when the process has exited
//       (which may be immediately after calling #startInternal if, e.g. the binary cannot be
//       found).
export class ChildProcessHelper {
  private process?: ChildProcess;
  protected isInDebugMode = false;

  private exitListener?: (code?: number, signal?: string) => void;
  private stdErrListener?: (data?: string | Buffer) => void;

  constructor(private path: string) {}

  /**
   * Starts the process with the given args. If enableDebug() has been called, then the process is
   * started in verbose mode if supported.
   * @param args The args for the process
   */
  launch(args: string[]) {
    this.process = spawn(this.path, args);
    const processName = path.basename(this.path);

    const onExit = (code?: number, signal?: string) => {
      if (this.process) {
        this.process.removeAllListeners();
      }
      if (this.exitListener) {
        this.exitListener(code, signal);
      }

      logExit(processName, code, signal);
    };
    const onStdErr = (data?: string | Buffer) => {
      if (this.isInDebugMode) {
        console.error(`[STDERR - ${processName}]: ${data}`);
      }
      if (this.stdErrListener) {
        this.stdErrListener(data);
      }
    };
    this.process.stderr.on('data', onStdErr.bind(this));

    if (this.isInDebugMode) {
      // Redirect subprocess output while bypassing the Node console.  This makes sure we don't
      // send web traffic information to Sentry.
      this.process.stdout.pipe(process.stdout);
      this.process.stderr.pipe(process.stderr);
    }

    // We have to listen for both events: error means the process could not be launched and in that
    // case exit will not be invoked.
    this.process.on('error', onExit.bind(this));
    this.process.on('exit', onExit.bind(this));
  }

  // Use #onExit to be notified when the process exits.
  stop() {
    if (!this.process) {
      // Never started.
      if (this.exitListener) {
        this.exitListener(null, null);
      }
      return;
    }

    this.process.kill();
  }

  set onExit(newListener: ((code?: number, signal?: string) => void) | undefined) {
    this.exitListener = newListener;
  }

  set onStdErr(listener: ((data?: string | Buffer) => void) | undefined) {
    this.stdErrListener = listener;
    if (!this.stdErrListener && !this.isDebugModeEnabled) {
      this.process.stderr.removeAllListeners();
    }
  }

  /**
   * Enables verbose logging for the process.  Must be called before launch().
   */
  enableDebugMode() {
    this.isInDebugMode = true;
  }

  get isDebugModeEnabled() {
    return this.isInDebugMode;
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
