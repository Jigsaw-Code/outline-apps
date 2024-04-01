import { PlatformPackager } from "app-builder-lib";
export declare function getLicenseButtonsFile(packager: PlatformPackager<any>): Promise<Array<LicenseButtonsFile>>;
export interface LicenseButtonsFile {
    file: string;
    lang: string;
    langWithRegion: string;
    langName: string;
}
export declare function getLicenseButtons(licenseButtonFiles: Array<LicenseButtonsFile>, langWithRegion: string, id: number, name: string): Promise<string>;
