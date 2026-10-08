import { env } from '../config/env';
import { StorageAdapter, StorageHealthInfo } from './storageAdapter';
import { JsonStorageAdapter } from './jsonAdapter';
import { PostgresStorageAdapter } from './postgresAdapter';

export * from './storageAdapter';
export * from './jsonAdapter';
export * from './postgresAdapter';

export function createStorageAdapter(connectionUrl?: string): StorageAdapter {
  const dbUrl = connectionUrl || env.DATABASE_URL;

  if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
    try {
      console.log('[Storage] Initializing PostgreSQL storage adapter...');
      return new PostgresStorageAdapter({
        connectionString: dbUrl,
        ssl: env.DATABASE_SSL,
      });
    } catch (err) {
      console.error('[Storage Error] Failed to construct PostgresStorageAdapter, falling back to JSON:', err);
    }
  }

  console.log('[Storage] Initializing Local JSON flat-file storage adapter...');
  return new JsonStorageAdapter();
}

export const storageService: StorageAdapter = createStorageAdapter();

// Initialize schema or sync storage on module load
storageService.init().catch((err) => {
  console.error('[Storage Init Error]', err);
});

// Backward compatibility alias
export const dbService = storageService;
