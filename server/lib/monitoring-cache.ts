/** Per-process snapshots bound database monitoring reads to once per two minutes.
 * Failed reads are never retained; simultaneous scrapes share the same read.
 */
export function createMonitoringCache<T>(ttlMs = 120_000) {
  let cached: { value: T; expiresAt: number } | undefined;
  let pending: Promise<T> | undefined;
  let generation = 0;
  return {
    get(load: () => Promise<T>, retain = (_value: T) => true): Promise<T> {
      if (cached && Date.now() < cached.expiresAt)
        return Promise.resolve(cached.value);
      if (pending) return pending;
      const currentGeneration = generation;
      const result = Promise.resolve()
        .then(load)
        .then((value) => {
          if (currentGeneration === generation && retain(value))
            cached = { value, expiresAt: Date.now() + ttlMs };
          return value;
        });
      pending = result;
      const cleanup = () => {
        if (pending === result) pending = undefined;
      };
      void result.then(cleanup, cleanup);
      return result;
    },
    clear() {
      generation += 1;
      cached = undefined;
      pending = undefined;
    },
  };
}
