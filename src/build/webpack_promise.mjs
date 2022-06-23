import webpack from 'webpack';

export const webpackPromise = webpackConfig =>
  new Promise((resolve, reject) => {
    webpack(webpackConfig, (error, stats) => {
      if (error || stats.hasErrors()) {
        reject(
          error ||
            stats
              .toJson()
              ?.errors.reduce(
                (errorMessages, {message}) => (message ? `${errorMessages}\n${message}` : errorMessages),
                ''
              ) ||
            'Unknown Webpack error.'
        );
      }

      resolve(stats);
    });
  });
