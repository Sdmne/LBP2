import { Dimensions, PixelRatio, Platform } from "react-native";
import * as Device from "expo-device";
import Constants from "expo-constants";

export function currentDeviceInfo() {
  const screen = Dimensions.get("screen");
  let timezone: string | undefined;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Optional metadata must not prevent authentication.
  }
  return {
    source: Platform.OS === "ios" ? "Mobile App (iOS)" : Platform.OS === "android" ? "Mobile App (Android)" : "Web App",
    timezone,
    screenWidth: Math.round(screen.width),
    screenHeight: Math.round(screen.height),
    pixelRatio: PixelRatio.get(),
    osName: Device.osName,
    osVersion: Device.osVersion,
    brand: Device.brand,
    model: Device.modelName,
    appVersion: Constants.expoConfig?.version,
    isEmulator: Platform.OS === "web" ? undefined : !Device.isDevice,
  };
}
