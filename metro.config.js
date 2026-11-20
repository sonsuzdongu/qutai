// Expo's default Metro config, plus two things:
// - `webpage/` is the website, a separate project with its own node_modules, which the app's bundler must not crawl or
//   resolve from;
// - without pro mode, the pro-only native packages (plugins/proBuild.js: RevenueCat's react-native-purchases) resolve to
//   an empty module, so the open-source bundle contains none of their JavaScript (their native code is left out by
//   react-native.config.js; src/purchases/index.ts then finds no SDK and says buying isn't available in this build).
// https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { isProBuild, PRO_ONLY_PACKAGES } = require('./plugins/proBuild');

const config = getDefaultConfig(__dirname);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  new RegExp(`^${escape(path.join(__dirname, 'webpage'))}(?:[\\\\/].*)?$`),
  /^webpage(?:[\\/].*)?$/,
];

if (!isProBuild()) {
  const resolveNext = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (PRO_ONLY_PACKAGES.some((name) => moduleName === name || moduleName.startsWith(`${name}/`))) return { type: 'empty' };
    return resolveNext ? resolveNext(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
