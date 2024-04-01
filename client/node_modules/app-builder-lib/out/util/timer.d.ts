export interface Timer {
    end(): void;
}
export declare class DevTimer implements Timer {
    private readonly label;
    private start;
    constructor(label: string);
    endAndGet(): string;
    end(): void;
}
export declare function time(label: string): Timer;
