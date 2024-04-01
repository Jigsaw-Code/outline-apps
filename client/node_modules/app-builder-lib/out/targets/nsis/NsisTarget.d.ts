import { Arch } from "builder-util";
import { PackageFileInfo } from "builder-util-runtime";
import { Target } from "../../core";
import { WinPackager } from "../../winPackager";
import { Defines } from "./Defines";
import { NsisOptions } from "./nsisOptions";
import { AppPackageHelper } from "./nsisUtil";
export declare class NsisTarget extends Target {
    readonly packager: WinPackager;
    readonly outDir: string;
    protected readonly packageHelper: AppPackageHelper;
    readonly options: NsisOptions;
    /** @private */
    readonly archs: Map<Arch, string>;
    constructor(packager: WinPackager, outDir: string, targetName: string, packageHelper: AppPackageHelper);
    build(appOutDir: string, arch: Arch): Promise<void>;
    get isBuildDifferentialAware(): boolean;
    private getPreCompressedFileExtensions;
    /** @private */
    buildAppPackage(appOutDir: string, arch: Arch): Promise<PackageFileInfo>;
    protected get installerFilenamePattern(): string;
    private get isPortable();
    finishBuild(): Promise<any>;
    private buildInstaller;
    protected generateGitHubInstallerName(): string;
    private get isUnicodeEnabled();
    get isWebInstaller(): boolean;
    private computeScriptAndSignUninstaller;
    private computeVersionKey;
    protected configureDefines(oneClick: boolean, defines: Defines): Promise<any>;
    private configureDefinesForAllTypeOfInstaller;
    private executeMakensis;
    private computeCommonInstallerScriptHeader;
    private computeFinalScript;
}
