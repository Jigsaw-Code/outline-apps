import { Lazy } from "lazy-val";
export declare function createLazyProductionDeps(projectDir: string, excludedDependencies: Array<string> | null): Lazy<any[]>;
export interface NodeModuleDirInfo {
    readonly dir: string;
    readonly deps: Array<NodeModuleInfo>;
}
export interface NodeModuleInfo {
    readonly name: string;
}
