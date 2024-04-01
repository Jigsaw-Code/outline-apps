import { Arch } from "builder-util";
import { Target } from "../core";
import { LinuxPackager } from "../linuxPackager";
import { FlatpakOptions } from "../options/linuxOptions";
import { LinuxTargetHelper } from "./LinuxTargetHelper";
export default class FlatpakTarget extends Target {
    private readonly packager;
    private helper;
    readonly outDir: string;
    readonly options: FlatpakOptions;
    constructor(name: string, packager: LinuxPackager, helper: LinuxTargetHelper, outDir: string);
    get appId(): string;
    build(appOutDir: string, arch: Arch): Promise<any>;
    private prepareStageDir;
    private createSandboxBinWrapper;
    private createDesktopFile;
    private copyLicenseFile;
    private copyIcons;
    private getFlatpakBuilderOptions;
}
