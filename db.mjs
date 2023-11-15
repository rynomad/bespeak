import { createRxDatabase, addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";

addRxPlugin(RxDBDevModePlugin);

export default async function getDB() {
    if (window.indexedDB) {
        const { getRxStorageDexie } = await import(
            "rxdb/plugins/storage-dexie"
        );

        return createRxDatabase({
            name: "exampledb",
            storage: await getRxStorageDexie(),
        });
    } else {
        const { getRxStorageMemory } = await import(
            "rxdb/plugins/storage-memory"
        );

        return createRxDatabase({
            name: "exampledb",
            storage: await getRxStorageMemory(),
        });
    }
}
