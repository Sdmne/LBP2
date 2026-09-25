import { useEffect, useMemo, useState } from "react";

export function firstAvatarText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text && !["null", "undefined", "none", "—", "about:blank"].includes(text.toLowerCase())) return text;
  }
  return "";
}

export function avatarSources(...values: unknown[]): string[] {
  const result: string[] = [];
  const add = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    const source = firstAvatarText(value);
    if (!source) return;
    const normalized = /^(?:https?:)?\/\//i.test(source)
      || /^(?:data|blob):/i.test(source)
      || source.startsWith("/")
      ? source
      : /^(?:api|uploads|media)\//i.test(source)
        ? `/${source}`
        : source;
    if (!result.includes(normalized)) result.push(normalized);
  };
  values.forEach(add);
  return result;
}

export function userInitials(name: unknown): string {
  const text = firstAvatarText(name).normalize("NFC").toUpperCase();
  return (text.match(/\p{L}\p{M}*/gu) || []).slice(0, 2).join("");
}

type UserAvatarProps = {
  name: unknown;
  src?: unknown;
  fallbackClassName?: string;
  initials?: string;
};

function UserAvatarContent({
  name,
  src,
  fallbackClassName = "avatar-placeholder user-avatar-initials",
  initials,
}: UserAvatarProps) {
  const sources = useMemo(() => avatarSources(src), [src]);
  const signature = sources.join("\n");
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [signature]);
  const source = sources[sourceIndex];
  if (source) {
    return <img src={source} alt="" onError={() => setSourceIndex((index) => index + 1)} />;
  }
  return <span className={fallbackClassName} aria-hidden="true">{initials ?? userInitials(name)}</span>;
}

export function UserAvatar(props: UserAvatarProps) {
  return <UserAvatarContent {...props} />;
}
