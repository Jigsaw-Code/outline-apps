import { Arch } from "builder-util";
import { PackagerOptions, Platform } from "app-builder-lib";
import { PublishOptions } from "electron-publish";
import * as yargs from "yargs";
export declare function createYargs(): yargs.Argv<unknown>;
export interface BuildOptions extends PackagerOptions, PublishOptions {
}
export interface CliOptions extends PackagerOptions, PublishOptions {
    x64?: boolean;
    ia32?: boolean;
    armv7l?: boolean;
    arm64?: boolean;
    universal?: boolean;
    dir?: boolean;
}
/** @private */
export declare function normalizeOptions(args: CliOptions): BuildOptions;
/** @private */
export declare function coerceTypes(host: any): any;
export declare function createTargets(platforms: Array<Platform>, type?: string | null, arch?: string | null): Map<Platform, Map<Arch, Array<string>>>;
export declare function build(rawOptions?: CliOptions): Promise<Array<string>>;
/**
 * @private
 */
export declare function configureBuildCommand(yargs: yargs.Argv): yargs.Argv;
