// Serialize cookie rotation across tabs. Tokens stay in HttpOnly cookies.
const lockName = "nw-session-refresh";
type Lease = { owner: string; expires: number };

async function leaseDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(new Error("Session coordination timed out"));
    }, 5000);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open("nw-session-coordination", 1);
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
      return;
    }
    request.onupgradeneeded = () => request.result.createObjectStore("locks");
    request.onsuccess = () => {
      clearTimeout(timeout);
      if (settled) request.result.close();
      else {
        settled = true;
        resolve(request.result);
      }
    };
    const fail = (error: unknown) => {
      settled = true;
      clearTimeout(timeout);
      reject(error);
    };
    request.onerror = () => fail(request.error);
    request.onblocked = () =>
      fail(new Error("Session coordination is unavailable"));
  });
}
function changeLease(
  db: IDBDatabase,
  owner: string,
  release = false,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("locks", "readwrite");
    const store = tx.objectStore("locks");
    let acquired = false;
    const read = store.get(lockName);
    read.onsuccess = () => {
      const lease = read.result as Lease | undefined;
      if (release) {
        if (lease?.owner === owner) store.delete(lockName);
      } else if (
        !lease ||
        lease.owner === owner ||
        lease.expires <= Date.now()
      ) {
        store.put(
          { owner, expires: Date.now() + 30000 } satisfies Lease,
          lockName,
        );
        acquired = true;
      }
    };
    tx.oncomplete = () => resolve(acquired);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Session coordination was interrupted"));
  });
}
export async function withSessionLock<T>(work: () => Promise<T>): Promise<T> {
  if (navigator.locks)
    return navigator.locks.request(
      lockName,
      { signal: AbortSignal.timeout(45000) },
      work,
    );
  // IndexedDB transactions provide atomic coordination on browsers without Web Locks.
  // If storage is unavailable, fail closed rather than racing refresh tokens.
  const db = await leaseDatabase();
  const owner = crypto.randomUUID();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    const deadline = Date.now() + 45000;
    while (!(await changeLease(db, owner))) {
      if (Date.now() >= deadline)
        throw new Error("Session coordination timed out");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    heartbeat = setInterval(() => {
      void changeLease(db, owner).catch(() => {});
    }, 10000);
    return await work();
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await changeLease(db, owner, true).catch(() => {});
    db.close();
  }
}
