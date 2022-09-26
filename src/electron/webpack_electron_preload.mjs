import path from 'path';

export default {
  entry: './src/electron/preload.ts',
  target: 'electron-preload',
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts'],
  },
  output: {
    filename: 'preload.js',
    path: path.resolve(__dirname, '..', '..', 'build', 'electron', 'electron'),
  },
};
