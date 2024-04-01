/*!
 * node-progress
 * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */
export declare abstract class ProgressBar {
    private readonly format;
    private readonly stream;
    private current;
    total: number;
    private readonly width;
    private chars;
    private tokens;
    private lastDraw;
    private start;
    private complete;
    /**
     * Initialize a `ProgressBar` with the given `fmt` string and `options` or`total`.
     *
     * Options:
     *   - `curr` current completed index
     *   - `total` total number of ticks to complete
     *   - `width` the displayed width of the progress bar defaulting to total
     *   - `stream` the output stream defaulting to stderr
     *   - `head` head character defaulting to complete character
     *   - `complete` completion character defaulting to "="
     *   - `incomplete` incomplete character defaulting to "-"
     *   - `renderThrottle` minimum time between updates in milliseconds defaulting to 16
     *   - `callback` optional function to call when the progress bar completes
     *   - `clear` will clear the progress bar upon termination
     *
     * Tokens:
     *   - `:bar` the progress bar itself
     *   - `:current` current tick number
     *   - `:total` total ticks
     *   - `:elapsed` time elapsed in seconds
     *   - `:percent` completion percentage
     *   - `:eta` eta in seconds
     *   - `:rate` rate of ticks per second
     */
    constructor(format: string, options?: any);
    /**
     * "tick" the progress bar with optional `len` and optional `tokens`.
     */
    tick(delta: number): void;
    set currentAmount(value: number);
    render(): void;
    /**
     * "update" the progress bar to represent an exact percentage.
     * The ratio (between 0 and 1) specified will be multiplied by `total` and
     * floored, representing the closest available "tick." For example, if a
     * progress bar has a length of 3 and `update(0.5)` is called, the progress
     * will be set to 1.
     *
     * A ratio of 0.5 will attempt to set the progress to halfway.
     */
    update(ratio: number): void;
    /**
     * "interrupt" the progress bar and write a message above it.
     */
    interrupt(message: string): void;
    abstract terminate(): void;
}
export declare class ProgressCallback {
    private readonly progressBar;
    private start;
    private nextUpdate;
    constructor(progressBar: ProgressBar);
    update(transferred: number, total: number): void;
}
