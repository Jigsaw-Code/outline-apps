import { Arch } from "builder-util";
import { Target } from "../core";
import { LinuxPackager } from "../linuxPackager";
import { AppImageOptions } from "../options/linuxOptions";
import { LinuxTargetHelper } from "./LinuxTargetHelper";
export default class AppImageTarget extends Target {
    private readonly packager;
    private readonly helper;
    readonly outDir: string;
    readonly options: AppImageOptions;
    private readonly desktopEntry;
    constructor(ignored: string, packager: LinuxPackager, helper: LinuxTargetHelper, outDir: string);
    build(appOutDir: string, arch: Arch): Promise<any>;
}
