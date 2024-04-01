export interface ToolInfo {
    path: string;
    env?: any;
}
export declare function computeEnv(oldValue: string | null | undefined, newValues: Array<string>): string;
export declare function computeToolEnv(libPath: Array<string>): any;
