import { LitElement, html, css } from "https://esm.sh/lit@2.0.2";
import { openDB } from "https://esm.sh/idb";

const DB_VERSION = 1;

class BespeakDB extends LitElement {
    static styles = css`
        :host {
            display: block;
        }
    `;

    constructor() {
        super();
        this.db = this.initDb();
    }

    async initDb() {
        const db = await openDB("bespeak-db", DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("streams")) {
                    db.createObjectStore("streams", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("nodes")) {
                    db.createObjectStore("nodes", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("connections")) {
                    db.createObjectStore("connections", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("workspaces")) {
                    db.createObjectStore("workspaces", { keyPath: "id" });
                }
            },
        });
        return db;
    }

    async put(storeName, data) {
        const db = await this.db;
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        await store.put(data);
        await tx.done;
    }

    async get(storeName, id) {
        const db = await this.db;
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const data = await store.get(id);
        await tx.done;
        return data;
    }

    async getAll(storeName) {
        const db = await this.db;
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const data = await store.getAll();
        await tx.done;
        return data;
    }

    async delete(storeName, id) {
        const db = await this.db;
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        await store.delete(id);
        await tx.done;
    }
}

customElements.define("bespeak-db", BespeakDB);
