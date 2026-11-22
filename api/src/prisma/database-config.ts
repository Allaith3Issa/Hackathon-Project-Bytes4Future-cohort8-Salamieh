export function validateDatabaseConfig(config: Record<string, unknown>) {
  const connectionString = config.DATABASE_URL;
  if (connectionString === undefined) {
    return config;
  }

  if (typeof connectionString === 'string' && URL.canParse(connectionString)) {
    const url = new URL(connectionString);
    if (
      ['postgresql:', 'postgres:'].includes(url.protocol) &&
      url.hostname &&
      url.pathname.length > 1
    ) {
      return config;
    }
  }

  throw new Error('DATABASE_URL must be a PostgreSQL URL with a host and database name.');
}
