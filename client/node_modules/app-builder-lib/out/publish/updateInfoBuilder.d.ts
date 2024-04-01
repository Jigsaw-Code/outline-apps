import { PublishConfiguration, UpdateInfo } from "builder-util-runtime";
import { Packager } from "../packager";
import { PlatformPackager } from "../platformPackager";
export interface UpdateInfoFileTask {
    readonly file: string;
    readonly info: UpdateInfo;
    readonly publishConfiguration: PublishConfiguration;
    readonly packager: PlatformPackager<any>;
}
export declare function writeUpdateInfoFiles(updateInfoFileTasks: Array<UpdateInfoFileTask>, packager: Packager): Promise<void>;
