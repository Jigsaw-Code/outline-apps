import { PlatformPackager } from "../../platformPackager";
import { NsisOptions } from "./nsisOptions";
import { NsisScriptGenerator } from "./nsisScriptGenerator";
export declare class LangConfigurator {
    readonly isMultiLang: boolean;
    readonly langs: Array<string>;
    constructor(options: NsisOptions);
}
export declare function createAddLangsMacro(scriptGenerator: NsisScriptGenerator, langConfigurator: LangConfigurator): void;
export declare function addCustomMessageFileInclude(input: string, packager: PlatformPackager<any>, scriptGenerator: NsisScriptGenerator, langConfigurator: LangConfigurator): Promise<void>;
