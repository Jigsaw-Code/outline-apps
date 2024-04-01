import { AfterPackContext } from "../configuration";
import { Platform } from "../core";
import { Framework, PrepareApplicationStageDirectoryOptions } from "../Framework";
export declare class LibUiFramework implements Framework {
    readonly version: string;
    readonly distMacOsAppName: string;
    protected readonly isUseLaunchUi: boolean;
    readonly name: string;
    readonly macOsDefaultTargets: string[];
    readonly defaultAppIdPrefix: string;
    readonly isCopyElevateHelper = false;
    readonly isNpmRebuildRequired = false;
    constructor(version: string, distMacOsAppName: string, isUseLaunchUi: boolean);
    prepareApplicationStageDirectory(options: PrepareApplicationStageDirectoryOptions): Promise<void>;
    private prepareMacosApplicationStageDirectory;
    private prepareLinuxApplicationStageDirectory;
    afterPack(context: AfterPackContext): Promise<void>;
    getMainFile(platform: Platform): string | null;
    private isUseLaunchUiForPlatform;
    getExcludedDependencies(platform: Platform): Array<string> | null;
}
