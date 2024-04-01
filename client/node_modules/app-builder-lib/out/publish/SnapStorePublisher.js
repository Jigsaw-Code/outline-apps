"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapStorePublisher = void 0;
const electron_publish_1 = require("electron-publish");
const builder_util_1 = require("builder-util");
const path = require("path");
class SnapStorePublisher extends electron_publish_1.Publisher {
    constructor(context, options) {
        super(context);
        this.options = options;
        this.providerName = "snapStore";
    }
    upload(task) {
        this.createProgressBar(path.basename(task.file), -1);
        const args = ["publish-snap", "-f", task.file];
        let channels = this.options.channels;
        if (channels == null) {
            channels = ["edge"];
        }
        else {
            if (typeof channels === "string") {
                channels = channels.split(",");
            }
        }
        for (const channel of channels) {
            args.push("-c", channel);
        }
        return builder_util_1.executeAppBuilder(args);
    }
    toString() {
        return "Snap Store";
    }
}
exports.SnapStorePublisher = SnapStorePublisher;
//# sourceMappingURL=SnapStorePublisher.js.map