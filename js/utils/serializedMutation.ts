type MaybePromise<T> = T | Promise<T>;

export interface SerializedRecordMutatorOptions<T> {
  load: (id: string) => Promise<T | null>;
  save: (id: string, value: T) => Promise<void>;
  verify: (id: string) => Promise<T | null>;
  lockName?: string;
}

const localTails = new Map<string, Promise<void>>();

async function withLocalLock<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const previous = localTails.get(name) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  localTails.set(name, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (localTails.get(name) === current) localTails.delete(name);
  }
}

async function withCrossContextLock<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const locks = (globalThis as any).navigator?.locks;
  if (locks?.request) return locks.request(name, { mode: 'exclusive' }, operation);
  return withLocalLock(name, operation);
}

export function createSerializedRecordMutator<T>(options: SerializedRecordMutatorOptions<T>) {
  const lockName = options.lockName || 'pangu-records';
  return async (id: string, updater: (latest: T) => MaybePromise<T>): Promise<T> =>
    withCrossContextLock(lockName, async () => {
      const latest = await options.load(id);
      if (!latest) throw new Error(`record not found: ${id}`);
      const updated = await updater(latest);
      await options.save(id, updated);
      const confirmed = await options.verify(id);
      if (!confirmed) throw new Error(`record verification failed: ${id}`);
      return confirmed;
    });
}
