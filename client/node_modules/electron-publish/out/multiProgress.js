"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiProgress = void 0;
const log_1 = require("builder-util/out/log");
const progress_1 = require("./progress");
class MultiProgress {
    constructor() {
        this.stream = process.stdout;
        this.cursor = 0;
        this.totalLines = 0;
        this.isLogListenerAdded = false;
        this.barCount = 0;
    }
    createBar(format, options) {
        options.stream = this.stream;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const manager = this;
        class MultiProgressBar extends progress_1.ProgressBar {
            constructor(format, options) {
                super(format, options);
                this.index = -1;
            }
            render() {
                if (this.index === -1) {
                    this.index = manager.totalLines;
                    manager.allocateLines(1);
                }
                else {
                    manager.moveCursor(this.index);
                }
                super.render();
                if (!manager.isLogListenerAdded) {
                    manager.isLogListenerAdded = true;
                    log_1.setPrinter(message => {
                        let newLineCount = 0;
                        let newLineIndex = message.indexOf("\n");
                        while (newLineIndex > -1) {
                            newLineCount++;
                            newLineIndex = message.indexOf("\n", ++newLineIndex);
                        }
                        manager.allocateLines(newLineCount + 1);
                        manager.stream.write(message);
                    });
                }
            }
            terminate() {
                manager.barCount--;
                if (manager.barCount === 0 && manager.totalLines > 0) {
                    manager.allocateLines(1);
                    manager.totalLines = 0;
                    manager.cursor = 0;
                    log_1.setPrinter(null);
                    manager.isLogListenerAdded = false;
                }
            }
        }
        const bar = new MultiProgressBar(format, options);
        this.barCount++;
        return bar;
    }
    allocateLines(count) {
        this.stream.moveCursor(0, this.totalLines - 1);
        // if cursor pointed to previous line where \n is already printed, another \n is ignored, so, we can simply print it
        this.stream.write("\n");
        this.totalLines += count;
        this.cursor = this.totalLines - 1;
    }
    moveCursor(index) {
        this.stream.moveCursor(0, index - this.cursor);
        this.cursor = index;
    }
    terminate() {
        this.moveCursor(this.totalLines);
        this.stream.clearLine();
        this.stream.cursorTo(0);
    }
}
exports.MultiProgress = MultiProgress;
//# sourceMappingURL=multiProgress.js.map