import type { ImageURISource } from "react-native";
import { API_BASE_URL } from "../config";
import { getSessionToken } from "./session";

const PRIVATE_PHOTO_PATH = /^\/api\/member\/photos\/[1-9]\d*\/(?:content|avatar-content)$/;

export function profilePhotoSource(uri: string): ImageURISource {
  const path = uri.startsWith(`${API_BASE_URL}/`)
    ? uri.slice(API_BASE_URL.length)
    : uri.startsWith("/")
      ? uri
      : "";
  if (!PRIVATE_PHOTO_PATH.test(path)) return { uri };

  const source: ImageURISource = { uri: `${API_BASE_URL}${path}`, cache: "reload" };
  const token = getSessionToken();
  if (token) source.headers = { Authorization: `Bearer ${token}` };
  return source;
}
