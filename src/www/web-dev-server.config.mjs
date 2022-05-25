import {esbuildPlugin} from '@web/dev-server-esbuild';
import {storybookPlugin} from '@web/dev-server-storybook';
import {fromRollup} from '@web/dev-server-rollup';
import image from '@rollup/plugin-image';

export default {
  mimeTypes: {
    // serve all png files as js so as to not confuse rollup
    '**/*.png': 'js',
  },
  plugins: [
    fromRollup(image)({
      include: ['./src/**/*.png'],
    }),
    esbuildPlugin({
      ts: true,
      json: true,
    }),
    storybookPlugin({
      type: 'web-components',
      configDir: './src/www/.storybook',
    }),
  ],
};
