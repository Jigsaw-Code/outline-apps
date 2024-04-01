"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.Logger = exports.PADDING = exports.setPrinter = exports.debug = void 0;
const chalk = require("chalk");
const debug_1 = require("debug");
let printer = null;
exports.debug = debug_1.default("electron-builder");
function setPrinter(value) {
    printer = value;
}
exports.setPrinter = setPrinter;
exports.PADDING = 2;
class Logger {
    constructor(stream) {
        this.stream = stream;
        this.messageTransformer = it => it;
    }
    filePath(file) {
        const cwd = process.cwd();
        return file.startsWith(cwd) ? file.substring(cwd.length + 1) : file;
    }
    // noinspection JSMethodCanBeStatic
    get isDebugEnabled() {
        return exports.debug.enabled;
    }
    info(messageOrFields, message) {
        this.doLog(message, messageOrFields, "info");
    }
    error(messageOrFields, message) {
        this.doLog(message, messageOrFields, "error");
    }
    warn(messageOrFields, message) {
        this.doLog(message, messageOrFields, "warn");
    }
    debug(fields, message) {
        if (exports.debug.enabled) {
            this._doLog(message, fields, "debug");
        }
    }
    doLog(message, messageOrFields, level) {
        if (message === undefined) {
            this._doLog(messageOrFields, null, level);
        }
        else {
            this._doLog(message, messageOrFields, level);
        }
    }
    _doLog(message, fields, level) {
        // noinspection SuspiciousInstanceOfGuard
        if (message instanceof Error) {
            message = message.stack || message.toString();
        }
        else {
            message = message.toString();
        }
        const levelIndicator = level === "error" ? "⨯" : "•";
        const color = LEVEL_TO_COLOR[level];
        this.stream.write(`${" ".repeat(exports.PADDING)}${color(levelIndicator)} `);
        this.stream.write(Logger.createMessage(this.messageTransformer(message, level), fields, level, color, exports.PADDING + 2 /* level indicator and space */));
        this.stream.write("\n");
    }
    static createMessage(message, fields, level, color, messagePadding = 0) {
        if (fields == null) {
            return message;
        }
        const fieldPadding = " ".repeat(Math.max(2, 16 - message.length));
        let text = (level === "error" ? color(message) : message) + fieldPadding;
        const fieldNames = Object.keys(fields);
        let counter = 0;
        for (const name of fieldNames) {
            let fieldValue = fields[name];
            let valuePadding = null;
            // Remove unnecessary line breaks
            if (fieldValue != null && typeof fieldValue === "string" && fieldValue.includes("\n")) {
                valuePadding = " ".repeat(messagePadding + message.length + fieldPadding.length + 2);
                fieldValue = fieldValue.replace(/\n\s*\n/g, `\n${valuePadding}`);
            }
            else if (Array.isArray(fieldValue)) {
                fieldValue = JSON.stringify(fieldValue);
            }
            text += `${color(name)}=${fieldValue}`;
            if (++counter !== fieldNames.length) {
                if (valuePadding == null) {
                    text += " ";
                }
                else {
                    text += "\n" + valuePadding;
                }
            }
        }
        return text;
    }
    log(message) {
        if (printer == null) {
            this.stream.write(`${message}\n`);
        }
        else {
            printer(message);
        }
    }
}
exports.Logger = Logger;
const LEVEL_TO_COLOR = {
    info: chalk.blue,
    warn: chalk.yellow,
    error: chalk.red,
    debug: chalk.white,
};
exports.log = new Logger(process.stdout);
//# sourceMappingURL=log.js.map