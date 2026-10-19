export function integrationStatus(configured: unknown): string {
  if (configured === true) return "Configured";
  if (configured === false) return "Not Configured";
  return "Unknown";
}
