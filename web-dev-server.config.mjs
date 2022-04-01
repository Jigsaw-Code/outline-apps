import {esbuildPlugin} from "@web/dev-server-esbuild";
import {storybookPlugin} from "@web/dev-server-storybook";

export default {
  plugins: [
    esbuildPlugin({
      ts: true,
    }),
    storybookPlugin({
      type: "web-components",
      configDir: "./src/www/.storybook",
    }),
  ],
};
