// Local blob storage for uploaded documents. Metadata lives in the project;
// the file itself lives in IndexedDB so it never leaves the machine.
const DB_NAME = "skeletonkey-case-docs";
const STORE = "files";

function key(projectId: string, docId: string): string {
  return `${projectId}:${docId}`;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function putCaseFile(
  projectId: string,
  docId: string,
  blob: Blob,
): Promise<void> {
  await tx("readwrite", (store) => store.put(blob, key(projectId, docId)));
}

export async function getCaseFile(
  projectId: string,
  docId: string,
): Promise<Blob | null> {
  const blob = await tx<Blob | undefined>("readonly", (store) =>
    store.get(key(projectId, docId)),
  );
  return blob ?? null;
}

export async function deleteCaseFile(
  projectId: string,
  docId: string,
): Promise<void> {
  await tx("readwrite", (store) => store.delete(key(projectId, docId)));
}

export async function deleteProjectFiles(projectId: string): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (String(cursor.key).startsWith(`${projectId}:`)) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}
