import { Target, AppInfo } from "../";
import { Arch } from "builder-util";
import { PlatformPackager } from "../platformPackager";
export declare class StageDir {
    readonly dir: string;
    constructor(dir: string);
    getTempFile(name: string): string;
    cleanup(): Promise<void>;
    toString(): string;
}
export declare function createStageDir(target: Target, packager: PlatformPackager<any>, arch: Arch): Promise<StageDir>;
export declare function createStageDirPath(target: Target, packager: PlatformPackager<any>, arch: Arch): Promise<string>;
export declare function getWindowsInstallationDirName(appInfo: AppInfo, isTryToUseProductName: boolean): string;
export declare function getWindowsInstallationAppPackageName(appName: string): string;
