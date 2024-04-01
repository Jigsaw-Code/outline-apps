"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLazyProductionDeps = void 0;
const lazy_val_1 = require("lazy-val");
const appBuilder_1 = require("./appBuilder");
function createLazyProductionDeps(projectDir, excludedDependencies) {
    return new lazy_val_1.Lazy(async () => {
        const args = ["node-dep-tree", "--dir", projectDir];
        if (excludedDependencies != null) {
            for (const name of excludedDependencies) {
                args.push("--exclude-dep", name);
            }
        }
        return appBuilder_1.executeAppBuilderAsJson(args);
    });
}
exports.createLazyProductionDeps = createLazyProductionDeps;
//# sourceMappingURL=packageDependencies.js.map