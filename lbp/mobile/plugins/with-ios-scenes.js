const { withAppDelegate, withInfoPlist, createRunOncePlugin } = require("expo/config-plugins");

function adoptScenes(contents) {
  if (!contents.includes("ExpoReactNativeFactoryProvider")) {
    const declaration = /class AppDelegate:\s*ExpoAppDelegate\s*\{/;
    if (!declaration.test(contents)) throw new Error("Unsupported Expo AppDelegate declaration for scene lifecycle");
    contents = contents.replace(declaration, "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {");
  }
  const legacyWindow = /#if os\(iOS\) \|\| os\(tvOS\)\s+window = UIWindow\(frame: UIScreen\.main\.bounds\)\s+factory\.startReactNative\([\s\S]*?launchOptions: launchOptions\)\s*#endif/;
  if (legacyWindow.test(contents)) {
    contents = contents.replace(legacyWindow, "// ExpoAppSceneDelegate creates the window and starts React Native.");
  }
  if (/window = UIWindow\(frame:/.test(contents) || !contents.includes("reactNativeFactory = factory")) {
    throw new Error("Unsupported Expo React Native startup for scene lifecycle");
  }
  return contents;
}

function withIosScenes(config) {
  config = withInfoPlist(config, (result) => {
    result.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: "Default Configuration",
          UISceneDelegateClassName: "EXExpoAppSceneDelegate",
        }],
      },
    };
    return result;
  });
  return withAppDelegate(config, (result) => {
    if (result.modResults.language !== "swift") throw new Error("Scene lifecycle requires the Expo Swift AppDelegate");
    result.modResults.contents = adoptScenes(result.modResults.contents);
    return result;
  });
}

module.exports = createRunOncePlugin(withIosScenes, "ios-scene-lifecycle", "1.0.0");
module.exports.adoptScenes = adoptScenes;
