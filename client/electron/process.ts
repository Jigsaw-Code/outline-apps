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

/**
 * A child process is terminated abnormally, caused by a non-zero exit code.
 */
export class ProcessTerminatedExitCodeError extends Error {
  constructor(
    readonly exitCode: number,
    errJSON: string
  ) {
    super(errJSON);
  }
}

/**
 * A child process is terminated abnormally, caused by a signal string.
 */
export class ProcessTerminatedSignalError extends Error {
  constructor(readonly signal: string) {
    super(`Process terminated by signal: ${signal}`);
  }
}

// Simple "one shot" child process launcher.
//
// NOTE: Because there is no way in Node.js to tell whether a process launched successfully,
//       #startInternal always succeeds; use #onExit to be notified when the process has exited
//       (which may be immediately after calling #startInternal if, e.g. the binary cannot be
//       found).
export class ChildProcessHelper {
  private readonly processName: string;
  private childProcess?: ChildProcess;
  private waitProcessToExit?: Promise<string>;

  /**
   * Whether to enable verbose logging for the process.  Must be called before launch().
   */
  isDebugModeEnabled = false;

  private stdOutListener?: ((data?: string | Buffer) => void) | null;

  constructor(private readonly path: string) {
    this.processName = basename(this.path);
  }

  /**
   * Start the process with the given args and wait for the process to exit. If `isDebugModeEnabled`
   * is `true`, the process is started in verbose mode if supported.
   *
   * If the process does not exit normally (i.e., exit code !== 0 or received a signal), it will
   * throw either `ProcessTerminatedExitCodeError` or `ProcessTerminatedSignalError`.
   *
   * It the process exits normally, it will return the stdout string.
   *
   * @param args The args for the process
   */
  async launch(args: string[], returnStdOut: boolean = true): Promise<string> {
    if (this.childProcess) {
      throw new Error(
        `subprocess ${this.processName} has already been launched`
      );
    }
    this.childProcess = spawn(this.path, args);
    return (this.waitProcessToExit = new Promise<string>((resolve, reject) => {
      let stdErrJSON = '';
      let stdOutStr = '';
      const onExit = (code?: number, signal?: string) => {
        if (this.childProcess) {
          this.childProcess.removeAllListeners();
          this.childProcess = undefined;
        } else {
          // When listening to both the 'exit' and 'error' events, guard against accidentally
          // invoking handler functions multiple times.
          return;
        }

        logExit(this.processName, code, signal);
        if (code === 0) {
          resolve(stdOutStr);
        } else if (code) {
          reject(new ProcessTerminatedExitCodeError(code, stdErrJSON));
        } else {
          reject(new ProcessTerminatedSignalError(signal ?? 'unknown'));
        }
      };

      this.childProcess?.stdout?.on('data', data => {
        this.stdOutListener?.(data);
        if (returnStdOut) {
          stdOutStr += data?.toString() ?? '';
        }
      });
      this.childProcess?.stderr?.on('data', (data?: string | Buffer) => {
        if (this.isDebugModeEnabled) {
          // This will be captured by Sentry
          console.error(`[${this.processName} - STDERR]: ${data}`);
        }
        stdErrJSON += data?.toString() ?? '';
      });

      if (this.isDebugModeEnabled) {
        // Redirect subprocess output while bypassing the Node console.  This makes sure we don't
        // send web traffic information to Sentry.
        this.childProcess?.stdout?.pipe(process.stdout);
        this.childProcess?.stderr?.pipe(process.stderr);
      }

      // We have to listen for both events: error means the process could not be launched and in that
      // case exit will not be invoked.
      this.childProcess?.on('error', onExit.bind(this));
      this.childProcess?.on('exit', onExit.bind(this));
    }));
  }

  /**
   * Try to kill the process and wait for the process to exit.
   *
   * If the process does not exist normally (i.e., exit code !== 0 or received a signal), it will
   * throw either `ProcessTerminatedExitCodeError` or `ProcessTerminatedSignalError`.
   */
  async stop(): Promise<string> {
    if (!this.childProcess) {
      // Never started.
      return '';
    }
    this.childProcess.kill();
    return (await this.waitProcessToExit) ?? '';
  }

  set onStdOut(listener: ((data?: string | Buffer) => void) | null) {
    this.stdOutListener = listener;
    if (!this.stdOutListener && !this.isDebugModeEnabled) {
      this.childProcess?.stdout?.removeAllListeners();
    }
  }
}

function logExit(processName: string, exitCode?: number, signal?: string) {
  const prefix = `[${processName} - EXIT]: `;
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
