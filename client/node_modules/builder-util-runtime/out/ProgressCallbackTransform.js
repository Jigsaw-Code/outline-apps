"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressCallbackTransform = void 0;
const stream_1 = require("stream");
class ProgressCallbackTransform extends stream_1.Transform {
    constructor(total, cancellationToken, onProgress) {
        super();
        this.total = total;
        this.cancellationToken = cancellationToken;
        this.onProgress = onProgress;
        this.start = Date.now();
        this.transferred = 0;
        this.delta = 0;
        this.nextUpdate = this.start + 1000;
    }
    _transform(chunk, encoding, callback) {
        if (this.cancellationToken.cancelled) {
            callback(new Error("cancelled"), null);
            return;
        }
        this.transferred += chunk.length;
        this.delta += chunk.length;
        const now = Date.now();
        if (now >= this.nextUpdate && this.transferred !== this.total /* will be emitted on _flush */) {
            this.nextUpdate = now + 1000;
            this.onProgress({
                total: this.total,
                delta: this.delta,
                transferred: this.transferred,
                percent: (this.transferred / this.total) * 100,
                bytesPerSecond: Math.round(this.transferred / ((now - this.start) / 1000)),
            });
            this.delta = 0;
        }
        callback(null, chunk);
    }
    _flush(callback) {
        if (this.cancellationToken.cancelled) {
            callback(new Error("cancelled"));
            return;
        }
        this.onProgress({
            total: this.total,
            delta: this.delta,
            transferred: this.total,
            percent: 100,
            bytesPerSecond: Math.round(this.transferred / ((Date.now() - this.start) / 1000)),
        });
        this.delta = 0;
        callback(null);
    }
}
exports.ProgressCallbackTransform = ProgressCallbackTransform;
//# sourceMappingURL=ProgressCallbackTransform.js.map