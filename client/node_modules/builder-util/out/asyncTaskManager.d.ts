import { CancellationToken } from "builder-util-runtime";
export declare class AsyncTaskManager {
    private readonly cancellationToken;
    readonly tasks: Array<Promise<any>>;
    private readonly errors;
    constructor(cancellationToken: CancellationToken);
    add(task: () => Promise<any>): void;
    addTask(promise: Promise<any>): void;
    cancelTasks(): void;
    awaitTasks(): Promise<Array<any>>;
}
