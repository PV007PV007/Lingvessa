import type { QueueRecord, QueueStorage } from '../../../../packages/api-client/src/lesson';
/** Namespaced by authenticated owner. Stores only bounded unsent learning commands, never session/CSRF/audio. */
export class IndexedAttemptStorage implements QueueStorage {
  constructor(private readonly ownerId: string) {
    if (!/^[0-9a-f-]{36}$/u.test(ownerId)) throw new TypeError('Owner namespace required');
  }
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve,reject) => {
      const request = indexedDB.open(`lingvessa-attempts-v1-${this.ownerId}`,1);
      request.onupgradeneeded=()=>request.result.createObjectStore('queue');
      request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
    });
  }
  async read(): Promise<QueueRecord[]> {
    const db=await this.open();
    try { return await new Promise((resolve,reject)=>{
      const tx=db.transaction('queue','readonly'); const request=tx.objectStore('queue').get('pending');
      request.onsuccess=()=>resolve((request.result as QueueRecord[]|undefined)??[]); request.onerror=()=>reject(request.error);
    }); } finally { db.close(); }
  }
  async write(records: QueueRecord[]): Promise<void> {
    const db=await this.open();
    try { await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction('queue','readwrite'); tx.objectStore('queue').put(records,'pending');
      tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error);
    }); } finally { db.close(); }
  }
}
