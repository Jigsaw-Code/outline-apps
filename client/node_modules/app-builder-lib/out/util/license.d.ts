import { PlatformPackager } from "../platformPackager";
export declare function getLicenseAssets(fileNames: Array<string>, packager: PlatformPackager<any>): {
    file: string;
    lang: string;
    langWithRegion: string;
    langName: any;
}[];
export declare function getNotLocalizedLicenseFile(custom: string | null | undefined, packager: PlatformPackager<any>, supportedExtension?: Array<string>): Promise<string | null>;
export declare function getLicenseFiles(packager: PlatformPackager<any>): Promise<Array<LicenseFile>>;
export interface LicenseFile {
    file: string;
    lang: string;
    langWithRegion: string;
    langName: string;
}
