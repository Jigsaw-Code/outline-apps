import { WinPackager } from "../winPackager";
export interface CommonWindowsInstallerConfiguration {
    readonly oneClick?: boolean;
    /**
     * Whether to install per all users (per-machine).
     * @default false
     */
    readonly perMachine?: boolean;
    /**
     * Whether to run the installed application after finish. For assisted installer corresponding checkbox will be removed.
     * @default true
     */
    readonly runAfterFinish?: boolean;
    /**
     * Whether to create desktop shortcut. Set to `always` if to recreate also on reinstall (even if removed by user).
     * @default true
     */
    readonly createDesktopShortcut?: boolean | "always";
    /**
     * Whether to create start menu shortcut.
     * @default true
     */
    readonly createStartMenuShortcut?: boolean;
    /**
     * Whether to create submenu for start menu shortcut and program files directory. If `true`, company name will be used. Or string value.
     * @default false
     */
    readonly menuCategory?: boolean | string;
    /**
     * The name that will be used for all shortcuts. Defaults to the application name.
     */
    readonly shortcutName?: string | null;
}
export interface FinalCommonWindowsInstallerOptions {
    isAssisted: boolean;
    isPerMachine: boolean;
    shortcutName: string;
    menuCategory: string | null;
    isCreateDesktopShortcut: DesktopShortcutCreationPolicy;
    isCreateStartMenuShortcut: boolean;
}
export declare function getEffectiveOptions(options: CommonWindowsInstallerConfiguration, packager: WinPackager): FinalCommonWindowsInstallerOptions;
export declare enum DesktopShortcutCreationPolicy {
    FRESH_INSTALL = 0,
    ALWAYS = 1,
    NEVER = 2
}
