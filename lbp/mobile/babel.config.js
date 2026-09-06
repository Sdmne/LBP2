module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // react-native-reanimated resolved to v4.5.1 here (see package.json),
    // which moved its worklets machinery into a separate
    // "react-native-worklets" package (peerDependency
    // "react-native-worklets": "0.10.x" per its own package.json) with its
    // own babel plugin - "react-native-reanimated/plugin" no longer exists
    // in v4. This MUST still be the last plugin in this array, per
    // reanimated's setup docs. Requires `react-native-worklets` to actually
    // be installed (npx expo install react-native-worklets) - if it isn't,
    // Metro/babel can't resolve this plugin and the JS bundle step fails
    // (exactly what broke the first two EAS builds, both "Unknown error"
    // in the Bundle JavaScript phase - one from the reanimated/gesture-
    // handler/linear-gradient packages missing entirely, this one from the
    // plugin name being stale for the v4 line that got installed).
    plugins: ["react-native-worklets/plugin"],
  };
};
