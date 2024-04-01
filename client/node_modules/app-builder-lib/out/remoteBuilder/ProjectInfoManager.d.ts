import { Lazy } from "lazy-val";
import { Packager } from "../packager";
export declare class ProjectInfoManager {
    readonly packager: Packager;
    readonly infoFile: Lazy<string>;
    constructor(packager: Packager);
    private saveConfigurationAndMetadata;
}
