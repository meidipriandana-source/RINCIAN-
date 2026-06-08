import { BudgetCategory, RealisasiTransaction } from "./types";

const DB_NAME = "ApbdBludDatabase_2026";
const DB_VERSION = 1;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("state")) {
        db.createObjectStore("state");
      }
    };
    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };
    request.onerror = (event: any) => {
      reject(event.target.error);
    };
  });
}

export async function saveToDB(key: string, value: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      const store = tx.objectStore("state");
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Gagal menyimpan ke IndexedDB:", err);
  }
}

export async function loadFromDB(key: string): Promise<any> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("state", "readonly");
      const store = tx.objectStore("state");
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Gagal memuat dari IndexedDB:", err);
    return null;
  }
}
