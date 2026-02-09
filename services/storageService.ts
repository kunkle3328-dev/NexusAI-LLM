
import { ChatSession, CognitiveMemory } from '../types';

const DB_NAME = 'NexusAI_V3_Local';
const STORES = {
  SESSIONS: 'sessions',
  MEMORIES: 'cognitive_memory'
};

export class StorageService {
  private static async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 3);
      request.onupgradeneeded = (e) => {
        const db = request.result;
        Object.values(STORES).forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async saveSession(session: ChatSession): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.SESSIONS, 'readwrite');
    tx.objectStore(STORES.SESSIONS).put(session);
    return new Promise((r) => tx.oncomplete = () => r());
  }

  static async getAllSessions(): Promise<ChatSession[]> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.SESSIONS, 'readonly');
    const store = tx.objectStore(STORES.SESSIONS);
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.updatedAt - a.updatedAt));
    });
  }

  static async deleteSession(id: string): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.SESSIONS, 'readwrite');
    tx.objectStore(STORES.SESSIONS).delete(id);
    return new Promise((r) => tx.oncomplete = () => r());
  }

  static async saveCognitiveMemory(memory: CognitiveMemory): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.MEMORIES, 'readwrite');
    tx.objectStore(STORES.MEMORIES).put(memory);
    return new Promise((r) => tx.oncomplete = () => r());
  }

  static async getAllMemories(): Promise<CognitiveMemory[]> {
    const db = await this.getDB();
    const tx = db.transaction(STORES.MEMORIES, 'readonly');
    return new Promise((resolve) => {
      const request = tx.objectStore(STORES.MEMORIES).getAll();
      request.onsuccess = () => resolve(request.result);
    });
  }

  static async searchMemories(query: string): Promise<CognitiveMemory[]> {
    const all = await this.getAllMemories();
    const terms = query.toLowerCase().split(/\s+/);
    return all
      .filter(m => terms.some(t => m.content.toLowerCase().includes(t) || m.tags.some(tag => tag.includes(t))))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);
  }
}
