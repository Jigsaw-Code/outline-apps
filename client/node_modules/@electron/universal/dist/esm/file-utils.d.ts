export declare enum AppFileType {
    MACHO = 0,
    PLAIN = 1,
    INFO_PLIST = 2,
    SNAPSHOT = 3,
    APP_CODE = 4
}
export declare type AppFile = {
    relativePath: string;
    type: AppFileType;
};
/**
 *
 * @param appPath Path to the application
 */
export declare const getAllAppFiles: (appPath: string) => Promise<AppFile[]>;
