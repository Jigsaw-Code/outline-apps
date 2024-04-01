/// <reference types="node" />
import { Arch, DebugLogger, TmpDir } from "builder-util";
import { CancellationToken } from "builder-util-runtime";
import { EventEmitter } from "events";
import { Lazy } from "lazy-val";
import { AppInfo } from "./appInfo";
import { AfterPackContext, Configuration } from "./configuration";
import { Platform, SourceRepositoryInfo, Target } from "./core";
import { Framework } from "./Framework";
import { Metadata } from "./options/metadata";
import { ArtifactBuildStarted, ArtifactCreated, PackagerOptions } from "./packagerApi";
import { PlatformPackager } from "./platformPackager";
import { NodeModuleDirInfo } from "./util/packageDependencies";
export declare class Packager {
    readonly cancellationToken: CancellationToken;
    readonly projectDir: string;
    private _appDir;
    get appDir(): string;
    private _metadata;
    get metadata(): Metadata;
    private _nodeModulesHandledExternally;
    get areNodeModulesHandledExternally(): boolean;
    private _isPrepackedAppAsar;
    get isPrepackedAppAsar(): boolean;
    private _devMetadata;
    get devMetadata(): Metadata | null;
    private _configuration;
    get config(): Configuration;
    isTwoPackageJsonProjectLayoutUsed: boolean;
    readonly eventEmitter: EventEmitter;
    _appInfo: AppInfo | null;
    get appInfo(): AppInfo;
    readonly tempDirManager: TmpDir;
    private _repositoryInfo;
    private readonly afterPackHandlers;
    readonly options: PackagerOptions;
    readonly debugLogger: DebugLogger;
    get repositoryInfo(): Promise<SourceRepositoryInfo | null>;
    private nodeDependencyInfo;
    getNodeDependencyInfo(platform: Platform | null): Lazy<Array<NodeModuleDirInfo>>;
    stageDirPathCustomizer: (target: Target, packager: PlatformPackager<any>, arch: Arch) => string;
    private _buildResourcesDir;
    get buildResourcesDir(): string;
    get relativeBuildResourcesDirname(): string;
    private _framework;
    get framework(): Framework;
    private readonly toDispose;
    disposeOnBuildFinish(disposer: () => Promise<void>): void;
    constructor(options: PackagerOptions, cancellationToken?: CancellationToken);
    addAfterPackHandler(handler: (context: AfterPackContext) => Promise<any> | null): void;
    artifactCreated(handler: (event: ArtifactCreated) => void): Packager;
    callArtifactBuildStarted(event: ArtifactBuildStarted, logFields?: any): Promise<void>;
    /**
     * Only for sub artifacts (update info), for main artifacts use `callArtifactBuildCompleted`.
     */
    dispatchArtifactCreated(event: ArtifactCreated): void;
    callArtifactBuildCompleted(event: ArtifactCreated): Promise<void>;
    callAppxManifestCreated(path: string): Promise<void>;
    callMsiProjectCreated(path: string): Promise<void>;
    build(): Promise<BuildResult>;
    _build(configuration: Configuration, metadata: Metadata, devMetadata: Metadata | null, repositoryInfo?: SourceRepositoryInfo): Promise<BuildResult>;
    private readProjectMetadataIfTwoPackageStructureOrPrepacked;
    private doBuild;
    private createHelper;
    installAppDependencies(platform: Platform, arch: Arch): Promise<any>;
    afterPack(context: AfterPackContext): Promise<any>;
}
export interface BuildResult {
    readonly outDir: string;
    readonly artifactPaths: Array<string>;
    readonly platformToTargets: Map<Platform, Map<string, Target>>;
    readonly configuration: Configuration;
}
