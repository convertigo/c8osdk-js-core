import {C8oExceptionMessage} from "./Exception/c8oExceptionMessage";
import {C8oFullSync} from "./c8oFullSync";
import {C8oFullSyncCbl} from "./c8oFullSyncCbl"
import {C8oCouchBaseLiteException} from "./Exception/c8oCouchBaseLiteException";
import {C8oCore} from "./c8oCore";
import {C8oUtilsCore} from "./c8oUtilsCore";

export class FullSyncPolicy {

    public static NONE: FullSyncPolicy = new FullSyncPolicy(C8oCore.FS_POLICY_NONE, (database: any, newProperties: Object) => {
        let documentId = C8oUtilsCore.getParameterStringValue(newProperties, C8oFullSync.FULL_SYNC__ID, false);
        if (documentId === "") {
            documentId = null;
        }
        return new Promise((resolve, reject) => {
            database.post(newProperties).then((createdDocument) => {
                resolve(createdDocument);
            }).catch((error) => {
                reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
            });
        });
    });


    public static CREATE: FullSyncPolicy = new FullSyncPolicy(C8oCore.FS_POLICY_CREATE, (database: any, newProperties: Object) => {
        try {
            delete newProperties[C8oFullSync.FULL_SYNC__ID];
            delete newProperties[C8oFullSync.FULL_SYNC__REV];
            return new Promise((resolve) => {
                database.post(newProperties).then((createdDocument) => {
                    resolve(createdDocument);
                });
            });
        }
        catch (error) {
            throw new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error);
        }
    });

    public static OVERRIDE: FullSyncPolicy = new FullSyncPolicy(C8oCore.FS_POLICY_OVERRIDE, (database: any, newProperties: Object) => {
        try {
            let documentId: string = C8oUtilsCore.getParameterStringValue(newProperties, C8oFullSync.FULL_SYNC__ID, false);
            delete newProperties[C8oFullSync.FULL_SYNC__ID];
            delete newProperties[C8oFullSync.FULL_SYNC__REV];

            if (documentId == null) {
                return new Promise((resolve) => {
                    database.post(newProperties).then((createdDocument) => {
                        resolve(createdDocument);
                    });
                });
            }
            else {
                return new Promise((resolve, reject) => {
                    database.get(documentId).then((doc) => {
                        newProperties["_id"] = documentId;
                        newProperties["_rev"] = doc._rev;
                        return database.put(newProperties);
                    }).then((createdDocument) => {
                        resolve(createdDocument);
                    }).catch((error) => {
                            if (error.status === "404" || error.status === 404) {
                                newProperties["_id"] = documentId;
                                return database.post(newProperties);
                            }
                            else {
                                reject(error);
                            }
                        }
                    ).then((createdDocument) => {
                        resolve(createdDocument);
                    });
                });
            }
        }
        catch (error) {
            throw new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error);
        }
    });

    public static MERGE: FullSyncPolicy = new FullSyncPolicy(C8oCore.FS_POLICY_MERGE, (database: any, newProperties: Object) => {
        try {
            let documentId: string = C8oUtilsCore.getParameterStringValue(newProperties, C8oFullSync.FULL_SYNC__ID, false);
            // delete newProperties[C8oFullSync.FULL_SYNC__ID];
            delete newProperties[C8oFullSync.FULL_SYNC__REV];

            if (documentId == null) {
                return new Promise((resolve, reject) => {

                    database.put(newProperties).then((createdDocument) => {
                        resolve(createdDocument);
                    }).catch((error) => {
                        reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
                    });
                });
            }
            else {
                return new Promise((resolve, reject) => {
                    database.get(documentId).then((doc) => {
                        C8oFullSyncCbl.mergeProperties(newProperties, doc);
                        database.put(newProperties).then((createdDocument) => {
                            resolve(createdDocument);
                        })
                            .catch((error) => {
                                reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
                            });
                    }).catch((error) => {
                        if (error.status === 404) {
                            database.put(newProperties).then((createdDocument) => {
                                resolve(createdDocument);
                            })
                                .catch((error) => {
                                    reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
                                });
                        }
                        else {
                            reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
                        }
                    });
                });
            }
        }
        catch (error) {
            throw new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error);
        }
    });

    public value: string;
    public action: (PouchDB, Object) => any;

    constructor(value: string, action: (_Object, Object) => any) {
        this.value = value;
        this.action = action;
    }

    public static values(): FullSyncPolicy[] {
        return [this.NONE, this.CREATE, this.OVERRIDE, this.MERGE];
    }

    public static getFullSyncPolicy(value: string): FullSyncPolicy {
        if (value != null) {
            let fullSyncPolicyValues: FullSyncPolicy[] = FullSyncPolicy.values();
            for (let fullSyncPolicy of fullSyncPolicyValues) {
                if (fullSyncPolicy.value === value) {
                    return fullSyncPolicy as FullSyncPolicy;
                }
            }
        }
        return this.NONE;
    }
}