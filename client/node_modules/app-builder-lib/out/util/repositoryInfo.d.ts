import { SourceRepositoryInfo } from "../core";
import { Metadata } from "../options/metadata";
export declare function getRepositoryInfo(projectDir: string, metadata?: Metadata, devMetadata?: Metadata | null): Promise<SourceRepositoryInfo | null>;
