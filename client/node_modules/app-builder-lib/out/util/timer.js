"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.time = exports.DevTimer = void 0;
const builder_util_1 = require("builder-util");
class DevTimer {
    constructor(label) {
        this.label = label;
        this.start = process.hrtime();
    }
    endAndGet() {
        const end = process.hrtime(this.start);
        return `${end[0]}s ${Math.round(end[1] / 1000000)}ms`;
    }
    end() {
        console.info(`${this.label}: ${this.endAndGet()}`);
    }
}
exports.DevTimer = DevTimer;
class ProductionTimer {
    end() {
        // ignore
    }
}
function time(label) {
    return builder_util_1.debug.enabled ? new DevTimer(label) : new ProductionTimer();
}
exports.time = time;
//# sourceMappingURL=timer.js.map