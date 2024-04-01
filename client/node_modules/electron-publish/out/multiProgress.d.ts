import { ProgressBar } from "./progress";
export declare class MultiProgress {
    private readonly stream;
    private cursor;
    private totalLines;
    private isLogListenerAdded;
    private barCount;
    createBar(format: string, options: any): ProgressBar;
    private allocateLines;
    private moveCursor;
    terminate(): void;
}
