import { Arch } from "builder-util";
import { Target } from "../core";
import { LinuxPackager } from "../linuxPackager";
import { LinuxTargetSpecificOptions } from "../options/linuxOptions";
import { LinuxTargetHelper } from "./LinuxTargetHelper";
export default class FpmTarget extends Target {
    private readonly packager;
    private readonly helper;
    readonly outDir: string;
    readonly options: LinuxTargetSpecificOptions;
    private readonly scriptFiles;
    constructor(name: string, packager: LinuxPackager, helper: LinuxTargetHelper, outDir: string);
    private createScripts;
    checkOptions(): Promise<any>;
    private computeFpmMetaInfoOptions;
    build(appOutDir: string, arch: Arch): Promise<any>;
}
