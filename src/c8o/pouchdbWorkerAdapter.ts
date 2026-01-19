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
            const patchedBundle = workerPouchBundle
                .replace(
                    /document\.documentElement\.style/g,
                    "(self.document && self.document.documentElement ? self.document.documentElement.style : {})"
                )
                .replace(/window\.console/g, "self.console")
                .replace(
                    /navigator\.userAgent/g,
                    "(self.navigator && self.navigator.userAgent ? self.navigator.userAgent : '')"
                );
            // eslint-disable-next-line no-new-func
            const loader = new Function(patchedBundle);
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
