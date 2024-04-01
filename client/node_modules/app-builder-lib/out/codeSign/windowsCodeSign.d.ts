import { WindowsConfiguration } from "../options/winOptions";
import { VmManager } from "../vm/vm";
import { WinPackager } from "../winPackager";
export declare function getSignVendorPath(): Promise<string>;
export declare type CustomWindowsSign = (configuration: CustomWindowsSignTaskConfiguration, packager?: WinPackager) => Promise<any>;
export interface WindowsSignOptions {
    readonly path: string;
    readonly name?: string | null;
    readonly cscInfo?: FileCodeSigningInfo | CertificateFromStoreInfo | null;
    readonly site?: string | null;
    readonly options: WindowsConfiguration;
}
export interface WindowsSignTaskConfiguration extends WindowsSignOptions {
    resultOutputPath?: string;
    hash: string;
    isNest: boolean;
}
export interface CustomWindowsSignTaskConfiguration extends WindowsSignTaskConfiguration {
    computeSignToolArgs(isWin: boolean): Array<string>;
}
export declare function sign(options: WindowsSignOptions, packager: WinPackager): Promise<void>;
export interface FileCodeSigningInfo {
    readonly file: string;
    readonly password: string | null;
}
export declare function getCertInfo(file: string, password: string): Promise<CertificateInfo>;
export interface CertificateInfo {
    readonly commonName: string;
    readonly bloodyMicrosoftSubjectDn: string;
}
export interface CertificateFromStoreInfo {
    thumbprint: string;
    subject: string;
    store: string;
    isLocalMachineStore: boolean;
}
export declare function getCertificateFromStoreInfo(options: WindowsConfiguration, vm: VmManager): Promise<CertificateFromStoreInfo>;
export declare function doSign(configuration: CustomWindowsSignTaskConfiguration, packager: WinPackager): Promise<void>;
