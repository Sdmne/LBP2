type PersonRecord = Record<string, unknown>;

function text(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const name = String(value).trim();
  return ["null", "undefined", "none"].includes(name.toLowerCase()) ? "" : name;
}

export function personName(row: PersonRecord): string {
  for (const value of [
    row.displayName, row.display_name, row.profileName, row.userName, row.user_name, row.name,
    row.title, row.email, row.profileEmail, row.id,
  ]) {
    const name = text(value);
    if (name) return name;
  }
  return "—";
}

export function personSecondaryText(row: PersonRecord): string {
  const secondary = text(row.email) || text(row.profileEmail) || text(row.slug);
  return secondary.toLocaleLowerCase() === personName(row).toLocaleLowerCase() ? "" : secondary;
}
