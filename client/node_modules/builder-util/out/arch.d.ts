export declare enum Arch {
    ia32 = 0,
    x64 = 1,
    armv7l = 2,
    arm64 = 3,
    universal = 4
}
export declare type ArchType = "x64" | "ia32" | "armv7l" | "arm64" | "universal";
export declare function toLinuxArchString(arch: Arch, targetName: string): string;
export declare function getArchCliNames(): Array<string>;
export declare function getArchSuffix(arch: Arch, defaultArch?: string): string;
export declare function archFromString(name: string): Arch;
export declare function defaultArchFromString(name?: string): Arch;
export declare function getArtifactArchName(arch: Arch, ext: string): string;
