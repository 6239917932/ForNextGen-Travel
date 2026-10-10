export function isPublicIndexingEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    environment.NODE_ENV === 'production' &&
    environment.PUBLIC_INDEXING_ENABLED === 'true' &&
    environment.FIXTURE_INVENTORY_ENABLED !== 'true'
  );
}
