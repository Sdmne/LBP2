import React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import * as Application from "expo-application";

type Props = { style?: StyleProp<TextStyle> };

export default function AppVersionLabel({ style }: Props) {
  return (
    <Text style={style}>
      {`v.${Application.nativeApplicationVersion ?? "?"}(${Application.nativeBuildVersion ?? "?"})`}
    </Text>
  );
}
