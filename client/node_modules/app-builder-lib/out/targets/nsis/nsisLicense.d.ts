import { WinPackager } from "../../winPackager";
import { NsisOptions } from "./nsisOptions";
import { NsisScriptGenerator } from "./nsisScriptGenerator";
export declare function computeLicensePage(packager: WinPackager, options: NsisOptions, scriptGenerator: NsisScriptGenerator, languages: Array<string>): Promise<void>;
