import { useState } from "react";

export function firstAvatarText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text && !["null", "undefined", "none", "—", "about:blank"].includes(text.toLowerCase())) return text;
  }
  return "";
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
}: UserAvatarProps & { src: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt="" onError={() => setFailed(true)} />;
  }
  return <span className={fallbackClassName} aria-hidden="true">{initials ?? userInitials(name)}</span>;
}

export function UserAvatar(props: UserAvatarProps) {
  const src = firstAvatarText(props.src);
  return <UserAvatarContent key={src} {...props} src={src} />;
}
