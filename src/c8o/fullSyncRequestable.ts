import {C8oCore, FullSyncPolicy, FullSyncPostDocumentParameter} from "./c8oCore";
import {C8oFullSync, C8oFullSyncCbl} from "./c8oFullSync";
import {
    C8oResponseJsonListener,
    C8oResponseListener,
    C8oResponseProgressListener,
} from "./c8oResponse";
import {C8oUtilsCore} from "./c8oUtilsCore";
import {FullSyncAttachmentParameter} from "./fullSyncAttachmentParameter";
import {FullSyncGetDocumentParameter} from "./fullSyncGetDocumentParameter";
import {FullSyncGetViewParameter} from "./fullSyncGetViewParameter";
/**
 * Created by charlesg on 10/01/2017.
 */
// @dynamic
export class FullSyncRequestable {

    //noinspection JSUnusedLocalSymbols
    public static GET: FullSyncRequestable = new FullSyncRequestable("get", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve, reject) => {
            const docid: string = C8oUtilsCore.peekParameterStringValue(parameters, FullSyncGetDocumentParameter.DOCID.name, true);
            resolve(c8oFullSync.handleGetDocumentRequest(databaseName, docid, parameters));
        }).catch((error) => {
            throw error;
        });
    });

    //noinspection JSUnusedLocalSymbols
    public static DELETE: FullSyncRequestable = new FullSyncRequestable("delete", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve, reject) => {
            const docid: string = C8oUtilsCore.peekParameterStringValue(parameters, FullSyncGetDocumentParameter.DOCID.name, true);
            c8oFullSync.handleDeleteDocumentRequest(databaseName, docid, parameters).then((result) => {
                resolve(result);
            }).catch((error) => {
                reject(error);
            });
        })
            .catch((error) => {
                throw error;
            });
    });

    //noinspection JSUnusedLocalSymbols
    public static POST: FullSyncRequestable = new FullSyncRequestable("post", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve, reject) => {
            try {
                const fullSyncPolicyParameter: string = C8oUtilsCore.peekParameterStringValue(parameters, FullSyncPostDocumentParameter.POLICY.name, false);
                const fullSyncPolicy: FullSyncPolicy = FullSyncPolicy.getFullSyncPolicy(fullSyncPolicyParameter);
                let fullSyncPolicySubMerge = [];
                if(fullSyncPolicyParameter == "merge"){
                    for(let elem in parameters){
                        if(elem.indexOf("_use_merge") == 0){
                            let key = elem.substring(11);
                            let value = parameters[elem];
                            fullSyncPolicySubMerge.push({key:key, value: value});
                        }
                    }
                }
                resolve(c8oFullSync.handlePostDocumentRequest(databaseName, fullSyncPolicy, parameters, fullSyncPolicySubMerge));
            } catch (error) {
                reject(error);
            }

        }).catch((error) => {
            throw error;
        });

    });

    //noinspection JSUnusedLocalSymbols
    public static PUT_ATTACHMENT: FullSyncRequestable = new FullSyncRequestable("put_attachment", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve) => {
            const docid: string = C8oUtilsCore.peekParameterStringValue(parameters, FullSyncGetDocumentParameter.DOCID.name, false);
            const name: string = C8oUtilsCore.getParameterStringValue(parameters, FullSyncAttachmentParameter.NAME.name, false);
            const contentType: string = C8oUtilsCore.getParameterStringValue(parameters, FullSyncAttachmentParameter.CONTENT_TYPE.name, false);
            const content = C8oUtilsCore.getParameterObjectValue(parameters, FullSyncAttachmentParameter.CONTENT.name, false);
            resolve(c8oFullSync.handlePutAttachmentRequest(databaseName, docid, name, contentType, content));
        }).catch((error) => {
            throw error;
        });
    });

    public static GET_ATTACHMENT: FullSyncRequestable = new FullSyncRequestable("get_attachment", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve) => {
            const docid: string = C8oUtilsCore.peekParameterStringValue(parameters, FullSyncGetDocumentParameter.DOCID.name, false);
            const name: string = C8oUtilsCore.getParameterStringValue(parameters, FullSyncAttachmentParameter.NAME.name, false);
            resolve(c8oFullSync.handleGetAttachmentRequest(databaseName, docid, name, parameters));
        }).catch((error) => {
            throw error;
        });
    });

    //noinspection JSUnusedLocalSymbols
    public static DELETE_ATTACHMENT: FullSyncRequestable = new FullSyncRequestable("delete_attachment", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve) => {
            const docid: string = C8oUtilsCore.peekParameterStringValue(parameters, FullSyncGetDocumentParameter.DOCID.name, false);
            const name: string = C8oUtilsCore.getParameterStringValue(parameters, FullSyncAttachmentParameter.NAME.name, false);
            resolve(c8oFullSync.handleDeleteAttachmentRequest(databaseName, docid, name));
        }).catch((error) => {
            throw error;
        });
    });

    //noinspection JSUnusedLocalSymbols
    public static ALL: FullSyncRequestable = new FullSyncRequestable("all", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve) => {
            c8oFullSync.handleAllDocumentsRequest(databaseName, parameters)
            .then((result) => {
                resolve(result);
            });
        }).catch((error) => {
            throw error;
        });
    });
    //noinspection JSUnusedLocalSymbols
    public static ALL_LOCAL: FullSyncRequestable = new FullSyncRequestable("all_local", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve) => {
            c8oFullSync.handleAllLocalDocumentsRequest(databaseName, parameters)
            .then((result) => {
                resolve(result);
            });
        }).catch((error) => {
            throw error;
        });
    });

    //noinspection JSUnusedLocalSymbols
    public static VIEW: FullSyncRequestable = new FullSyncRequestable("view", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve, reject) => {
            const ddoc: string = C8oUtilsCore.peekParameterStringValue(parameters, FullSyncGetViewParameter.DDOC.name, false);
            const view: string = C8oUtilsCore.peekParameterStringValue(parameters, FullSyncGetViewParameter.VIEW.name, false);
            c8oFullSync.handleGetViewRequest(databaseName, ddoc, view, parameters).then((result) => {
                resolve(result);
            }).catch((error) => {
                reject(error);
            });
        }).catch((error) => {
            throw error;
        });
    });

    //noinspection JSUnusedLocalSymbols
    public static CREATEINDEX: FullSyncRequestable = new FullSyncRequestable("createIndex", async (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
            try{
                const fields: string = C8oUtilsCore.peekParameterObjectValue(parameters, "fields", false);
                let result = await c8oFullSync.handleCreateIndexRequest(databaseName, fields, parameters);
                return result;
            }
            catch(e){
                return e;
            }
    });

    //noinspection JSUnusedLocalSymbols
    public static FIND: FullSyncRequestable = new FullSyncRequestable("find", async (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        try{
            const selector: string = C8oUtilsCore.peekParameterObjectValue(parameters, "selector", false);
            let result = await c8oFullSync.handleGetFindRequest(databaseName, selector, parameters);
            return result;
        }
        catch(e){
            return e;
        }
    });

    //noinspection JSUnusedLocalSymbols
    public static EXPLAIN: FullSyncRequestable = new FullSyncRequestable("explain", async (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        try{
            const selector: string = C8oUtilsCore.peekParameterObjectValue(parameters, "selector", false);
            let result = await c8oFullSync.handleExplainRequest(databaseName, selector, parameters);
            return result;
        }
        catch(e){
            return e;
        }
    });

    //noinspection JSUnusedLocalSymbols
    public static GETINDEXES: FullSyncRequestable = new FullSyncRequestable("getIndexes", async (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        try{
            let result = await c8oFullSync.handleGetIndexesRequest(databaseName, parameters);
            return result;
        }
        catch(e){
            return e;
        }
    });

    //noinspection JSUnusedLocalSymbols
    public static DELETEINDEX: FullSyncRequestable = new FullSyncRequestable("deleteIndex", async (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        try{
            let result = await c8oFullSync.handleDeleteIndexRequest(databaseName, parameters);
            return result;
        }
        catch(e){
            return e;
        }
    });

    //noinspection JSUnusedLocalSymbols
    public static SEARCH: FullSyncRequestable = new FullSyncRequestable("search", async (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        try{
            const query: string = C8oUtilsCore.peekParameterObjectValue(parameters, "query", false);
            const fields: string = C8oUtilsCore.peekParameterObjectValue(parameters, "fields", false);
            let result = await c8oFullSync.handleSearchRequest(databaseName, query, fields, parameters);
            return result;
        }
        catch(e){
            return e;
        }
    });

    
    public static SYNC: FullSyncRequestable = new FullSyncRequestable("sync", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        let pullFinish: boolean = false;
        let pushFinish: boolean = false;
        return new Promise((resolve, reject) => {
            c8oFullSync.handleSyncRequest(databaseName, parameters, new C8oResponseProgressListener((progress, parameters) => {
                if(parameters["cancel"] == true){
                    resolve({ok: true});
                }
                else{
                    if (!pullFinish && progress.pull && progress.finished) {
                        pullFinish = true;
                        c8oFullSync.c8o.log._debug("handleFullSyncRequest pullFinish = true: " + progress.toString());
                    }
                    if (!pushFinish && progress.push && progress.finished) {
                        pushFinish = true;
                        c8oFullSync.c8o.log._debug("handleFullSyncRequest pushFinish = true: " + progress.toString());
                    }
                    if (c8oResponseListener instanceof C8oResponseJsonListener) {
                        c8oFullSync.c8o.log._debug("handleFullSyncRequest onJsonResponse: " + progress.toString());
                        const varNull: JSON = null;
                        (c8oResponseListener as C8oResponseJsonListener).onJsonResponse(varNull, parameters);
                    }
                    if (pullFinish || pushFinish) {
                        resolve({ok: true});
                    }
                }
            })).catch((error) => {
                reject(error);
            });
        })
            .catch((error) => {
                throw error;
            });
    });

    public static REPLICATE_PULL: FullSyncRequestable = new FullSyncRequestable("replicate_pull", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve, reject) => {
            c8oFullSync.handleReplicatePullRequest(databaseName, parameters, new C8oResponseProgressListener((progress, param) => {
                if(parameters["cancel"] == true){
                    resolve({ok: true});
                }
                else{
                    if (progress.finished) {
                        resolve({ok: true});
                    }
                    if (c8oResponseListener instanceof C8oResponseJsonListener) {
                        const varNull: JSON = null;
                        (c8oResponseListener as C8oResponseJsonListener).onJsonResponse(varNull, param);
                    }
                }
            })).catch((error) => {
                reject(error);
            });
        })
            .catch((error) => {
                throw error;
            });
    });

    public static REPLICATE_PUSH: FullSyncRequestable = new FullSyncRequestable("replicate_push", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve, reject) => {
            c8oFullSync.handleReplicatePushRequest(databaseName, parameters, new C8oResponseProgressListener((progress, param) => {
                if(parameters["cancel"] == true){
                    resolve({ok: true});
                }
                else{
                    if (progress.finished) {
                        resolve({ok: true});
                    }
                    if (c8oResponseListener instanceof C8oResponseJsonListener) {
                        const varNull: JSON = null;
                        (c8oResponseListener as C8oResponseJsonListener).onJsonResponse(varNull, param);
                    }
                }
            })).catch((error) => {
                reject(error);
            });
        })
            .catch((error) => {
                throw error;
            });
    });

    //noinspection JSUnusedLocalSymbols,JSUnusedLocalSymbols
    public static RESET: FullSyncRequestable = new FullSyncRequestable("reset", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve, reject) => {
            c8oFullSync.handleResetDatabaseRequest(databaseName).then((response) => {
                c8oFullSync.c8o.subscriber_database_reset.next({ databaseName: databaseName, success: true, error: false });
                resolve(response);
            }).catch((error) => {
                c8oFullSync.c8o.subscriber_database_reset.error({ databaseName: databaseName, success: false, error: true, nativeError: error });
                reject(error);
            });
        })
    });

    //noinspection JSUnusedLocalSymbols,JSUnusedLocalSymbols
    public static CREATE: FullSyncRequestable = new FullSyncRequestable("create", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve) => {
            resolve(c8oFullSync.handleCreateDatabaseRequest(databaseName));
        }).catch((error) => {
            throw error;
        });
    });

    //noinspection JSUnusedLocalSymbols,JSUnusedLocalSymbols
    public static BULK: FullSyncRequestable = new FullSyncRequestable("bulk", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve) => {
            resolve(c8oFullSync.handleBulkRequest(databaseName, parameters));
        }).catch((error) => {
            throw error;
        });
    });

    public static INFO: FullSyncRequestable = new FullSyncRequestable("info", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve) => {
            resolve(c8oFullSync.handleInfoRequest(databaseName));
        }).catch((error) => {
            throw error;
        });
    });    


    //noinspection JSUnusedLocalSymbols,JSUnusedLocalSymbols
    public static DESTROY: FullSyncRequestable = new FullSyncRequestable("destroy", (c8oFullSync: C8oFullSyncCbl, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener) => {
        return new Promise((resolve, reject) => {
            c8oFullSync.handleDestroyDatabaseRequest(databaseName).then((response) => {
                resolve(response);
            }).catch((error) => {
                reject(error);
            });
        }).catch((error) => {
            throw error;
        });

    });

    private value: string;
    private handleFullSyncRequestOp: (c8oFullSyncCbl: C8oFullSync, str: string, dictionary: Object, c8oResponseListener: C8oResponseListener) => any;

    constructor(value: string, handleFullSyncRequestOp: (c8oFullSyncCbl: C8oFullSyncCbl, str: string, dictionary: Object, c8oResponseListener: C8oResponseListener) => any) {
        this.value = value;
        this.handleFullSyncRequestOp = handleFullSyncRequestOp;
    }

    public handleFullSyncRequest(c8oFullSync: C8oFullSync, databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener): Promise<any> {
        return new Promise((resolve, reject) => {
            this.handleFullSyncRequestOp(c8oFullSync, databaseName, parameters, c8oResponseListener).then((result) => {
                resolve(result);
            }).catch((error) => {
                reject(error);
            });
        });

    }

    public static getFullSyncRequestable(value: string): FullSyncRequestable {
        const fullSyncRequestableValues: FullSyncRequestable[] = FullSyncRequestable.values();
        for (let i = 0; i < fullSyncRequestableValues.length; i++) {
            if (fullSyncRequestableValues[i].value === value) {
                return fullSyncRequestableValues[i];
            }
        }
    }

    public static values(): FullSyncRequestable[] {
        return [this.GET, this.DELETE, this.POST, this.ALL, this.ALL_LOCAL, this.VIEW, this.SYNC, this.REPLICATE_PULL, this.REPLICATE_PUSH, this.RESET, this.CREATE, this.DESTROY, this.PUT_ATTACHMENT, this.GET_ATTACHMENT,this.DELETE_ATTACHMENT, this.BULK, this.INFO, this.CREATEINDEX, this.FIND, this.DELETEINDEX, this.GETINDEXES, this.EXPLAIN, this.SEARCH];

    }
}
