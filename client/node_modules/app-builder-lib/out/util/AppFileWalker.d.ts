/// <reference types="node" />
import { Filter } from "builder-util/out/fs";
import { Stats } from "fs-extra";
import { FileMatcher } from "../fileMatcher";
import { Packager } from "../packager";
export declare abstract class FileCopyHelper {
    protected readonly matcher: FileMatcher;
    readonly filter: Filter | null;
    protected readonly packager: Packager;
    readonly metadata: Map<string, Stats>;
    protected constructor(matcher: FileMatcher, filter: Filter | null, packager: Packager);
    protected handleFile(file: string, parent: string, fileStat: Stats): Promise<Stats | null> | null;
    private handleSymlink;
}
