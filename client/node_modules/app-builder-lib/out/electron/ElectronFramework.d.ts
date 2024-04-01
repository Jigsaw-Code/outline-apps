import { Configuration } from "../configuration";
import { Framework } from "../Framework";
import { Packager } from "../index";
export declare type ElectronPlatformName = "darwin" | "linux" | "win32" | "mas";
/**
 * Electron distributables branding options.
 * @see [Electron BRANDING.json](https://github.com/electron/electron/blob/master/shell/app/BRANDING.json).
 */
export interface ElectronBrandingOptions {
    projectName?: string;
    productName?: string;
}
export declare function createBrandingOpts(opts: Configuration): Required<ElectronBrandingOptions>;
export interface ElectronDownloadOptions {
    version?: string;
    /**
     * The [cache location](https://github.com/electron-userland/electron-download#cache-location).
     */
    cache?: string | null;
    /**
     * The mirror.
     */
    mirror?: string | null;
    /** @private */
    customDir?: string | null;
    /** @private */
    customFilename?: string | null;
    strictSSL?: boolean;
    isVerifyChecksum?: boolean;
    platform?: ElectronPlatformName;
    arch?: string;
}
export declare function createElectronFrameworkSupport(configuration: Configuration, packager: Packager): Promise<Framework>;
