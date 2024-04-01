export declare class NsisScriptGenerator {
    private readonly lines;
    addIncludeDir(file: string): void;
    addPluginDir(pluginArch: string, dir: string): void;
    include(file: string): void;
    macro(name: string, lines: Array<string> | NsisScriptGenerator): void;
    file(outputName: string | null, file: string): void;
    insertMacro(name: string, parameters: string): void;
    flags(flags: Array<string>): void;
    build(): string;
}
