import { DmgOptions, Target } from "app-builder-lib";
import MacPackager from "app-builder-lib/out/macPackager";
import { Arch } from "builder-util";
export declare class DmgTarget extends Target {
    private readonly packager;
    readonly outDir: string;
    readonly options: DmgOptions;
    constructor(packager: MacPackager, outDir: string);
    build(appPath: string, arch: Arch): Promise<void>;
    private signDmg;
    computeVolumeName(arch: Arch, custom?: string | null): string;
    computeDmgOptions(): Promise<DmgOptions>;
}
