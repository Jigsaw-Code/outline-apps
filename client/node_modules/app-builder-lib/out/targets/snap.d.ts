import { Arch } from "builder-util";
import { Target } from "../core";
import { LinuxPackager } from "../linuxPackager";
import { SnapOptions } from "../options/SnapOptions";
import { LinuxTargetHelper } from "./LinuxTargetHelper";
export default class SnapTarget extends Target {
    private readonly packager;
    private readonly helper;
    readonly outDir: string;
    readonly options: SnapOptions;
    isUseTemplateApp: boolean;
    constructor(name: string, packager: LinuxPackager, helper: LinuxTargetHelper, outDir: string);
    private replaceDefault;
    private createDescriptor;
    build(appOutDir: string, arch: Arch): Promise<any>;
    private isElectronVersionGreaterOrEqualThan;
}
