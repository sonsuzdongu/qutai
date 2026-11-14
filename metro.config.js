// Expo's default Metro config, plus one exclusion: `webpage/` is the website, a separate project with its own
// node_modules, which the app's bundler must not crawl or resolve from.
// https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^${escape(path.join(__dirname, 'webpage'))}(?:[\\\\/].*)?$`),
  /^webpage(?:[\\/].*)?$/,
];

module.exports = config;
