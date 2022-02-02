import {esbuildPlugin} from "@web/dev-server-esbuild";
import {storybookPlugin} from "@web/dev-server-storybook";

export default {
  nodeResolve: true,
  open: true,
  plugins: [
    esbuildPlugin({
      ts: true,
      target: "auto"
    }),
    storybookPlugin({
      type: "web-components"
    })
  ],
  rootDir: "./src/www",
  watch: true
};
