import { workerPouchBundle } from "./workerPouchBundle";

export function registerPouchDbWorkerAdapter(PouchDB: any): boolean {
    if (!PouchDB?.adapters) {
        return false;
    }

    if (PouchDB.adapters.worker) {
        return true;
    }

    if (typeof Worker === "undefined") {
        return false;
    }

    try {
        const globalObj: any = typeof window !== "undefined" ? window : globalThis;
        if (!globalObj.workerPouch) {
            // eslint-disable-next-line no-new-func
            const loader = new Function(workerPouchBundle);
            loader();
        }
        if (globalObj.workerPouch) {
            PouchDB.adapter("worker", globalObj.workerPouch);
            return true;
        }
    } catch (error) {
        return false;
    }

    return false;
}
