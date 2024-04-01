"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncTaskManager = void 0;
const log_1 = require("./log");
const promise_1 = require("./promise");
class AsyncTaskManager {
    constructor(cancellationToken) {
        this.cancellationToken = cancellationToken;
        this.tasks = [];
        this.errors = [];
    }
    add(task) {
        if (this.cancellationToken == null || !this.cancellationToken.cancelled) {
            this.addTask(task());
        }
    }
    addTask(promise) {
        if (this.cancellationToken.cancelled) {
            log_1.log.debug({ reason: "cancelled", stack: new Error().stack }, "async task not added");
            if ("cancel" in promise) {
                ;
                promise.cancel();
            }
            return;
        }
        this.tasks.push(promise.catch(it => {
            log_1.log.debug({ error: it.message || it.toString() }, "async task error");
            this.errors.push(it);
            return Promise.resolve(null);
        }));
    }
    cancelTasks() {
        for (const task of this.tasks) {
            if ("cancel" in task) {
                ;
                task.cancel();
            }
        }
        this.tasks.length = 0;
    }
    async awaitTasks() {
        if (this.cancellationToken.cancelled) {
            this.cancelTasks();
            return [];
        }
        const checkErrors = () => {
            if (this.errors.length > 0) {
                this.cancelTasks();
                throwError(this.errors);
                return;
            }
        };
        checkErrors();
        let result = null;
        const tasks = this.tasks;
        let list = tasks.slice();
        tasks.length = 0;
        while (list.length > 0) {
            const subResult = await Promise.all(list);
            result = result == null ? subResult : result.concat(subResult);
            checkErrors();
            if (tasks.length === 0) {
                break;
            }
            else {
                if (this.cancellationToken.cancelled) {
                    this.cancelTasks();
                    return [];
                }
                list = tasks.slice();
                tasks.length = 0;
            }
        }
        return result || [];
    }
}
exports.AsyncTaskManager = AsyncTaskManager;
function throwError(errors) {
    if (errors.length === 1) {
        throw errors[0];
    }
    else if (errors.length > 1) {
        throw new promise_1.NestedError(errors, "Cannot cleanup: ");
    }
}
//# sourceMappingURL=asyncTaskManager.js.map