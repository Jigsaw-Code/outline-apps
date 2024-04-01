import { PlatformPackager } from "app-builder-lib";
export { DmgTarget } from "./dmg";
export declare function getDmgTemplatePath(): string;
export declare function getDmgVendorPath(): string;
export declare function attachAndExecute(dmgPath: string, readWrite: boolean, task: () => Promise<any>): Promise<any>;
export declare function detach(name: string): Promise<void>;
export declare function computeBackground(packager: PlatformPackager<any>): Promise<string>;
