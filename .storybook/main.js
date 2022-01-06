module.exports = {
  "stories": ["../src/**/*.stories.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx)"],
  "addons": ["@storybook/addon-links", "@storybook/addon-essentials"],
  "framework": "@storybook/web-components",
  core: {
    builder: "webpack5"
  },
  staticDirs: [{ from: "../www/assets", to:  "/assets" }]
};