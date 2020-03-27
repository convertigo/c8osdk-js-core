import { C8oBase } from "./c8oBase";
import { C8oCore, FullSyncPolicy } from "./c8oCore";
import { C8oFullSyncChangeListener } from "./c8oFullSyncChangeListener";
import { C8oFullSyncTranslator } from "./c8oFullSyncTranslator";
import { C8oLocalCacheResponse } from "./c8oLocalCacheResponse";
import { C8oResponseJsonListener, C8oResponseListener } from "./c8oResponse";
import { C8oUtilsCore, Semaphore } from "./c8oUtilsCore";
import { C8oCouchBaseLiteException } from "./Exception/c8oCouchBaseLiteException";
import { C8oException } from "./Exception/c8oException";
import { C8oExceptionMessage } from "./Exception/c8oExceptionMessage";
import { C8oRessourceNotFoundException } from "./Exception/c8oRessourceNotFoundException";
import { C8oUnavailableLocalCacheException } from "./Exception/c8oUnavailableLocalCacheException";
import { C8oFullSyncDatabase } from "./fullSyncDatabase";
import { FullSyncDeleteDocumentParameter } from "./fullSyncDeleteDocumentParameter";
import { FullSyncRequestable } from "./fullSyncRequestable";
import { FullSyncDefaultResponse, FullSyncDocumentOperationResponse } from "./fullSyncResponse";

export class C8oFullSync {
    private static FULL_SYNC_URL_PATH: string = "/fullsync/";
    /**
     * The project requestable value to execute a fullSync request.
     */
    public static FULL_SYNC_PROJECT: string = "fs://";
    public static FULL_SYNC__ID: string = "_id";
    public static FULL_SYNC__REV: string = "_rev";
    public static FULL_SYNC__ATTACHMENTS: string = "_attachments";

    public c8o: C8oCore;
    protected fullSyncDatabaseUrlBase: string;
    protected localSuffix: string;

    public constructor(c8o: C8oCore) {
        this.c8o = c8o;
        this.fullSyncDatabaseUrlBase = c8o.endpointConvertigo + C8oFullSync.FULL_SYNC_URL_PATH;
        this.localSuffix = (c8o.fullSyncLocalSuffix !== null) ? c8o.fullSyncLocalSuffix : "_device";
    }

    /**
     * Handles a fullSync request.<br/>
     * It determines the type of the request thanks to parameters.
     *
     * @param _parameters
     * @param listener
     * @return promise<any>
     * @throws C8oException
     */
    public async handleFullSyncRequest(_parameters: Object, listener: C8oResponseListener): Promise<any> {
        return new Promise((resolve, reject) => {

            const parameters = {};
            for (const val in _parameters) {
                if (_parameters[val] instanceof Blob != true) {
                    //if it's not a blob then stringify and parse the value to make some values like true case insensitive ( from string to boolean)
                    parameters[val] = JSON.parse(JSON.stringify(_parameters[val]));
                } else {
                    parameters[val] = _parameters[val];
                }
            }
            const projectParameterValue: string = C8oUtilsCore.peekParameterStringValue(parameters, C8oCore.ENGINE_PARAMETER_PROJECT, true);
            if (projectParameterValue.indexOf(C8oFullSync.FULL_SYNC_PROJECT) !== 0) {
                reject(new C8oException(C8oExceptionMessage.invalidParameterValue(projectParameterValue, "its don't start with" + C8oFullSync.FULL_SYNC_PROJECT)));
            }
            let fullSyncRequestableValue: string = C8oUtilsCore.peekParameterStringValue(parameters, C8oCore.ENGINE_PARAMETER_SEQUENCE, true);

            //  get rid of the optional trailing #RouteHint present in the sequence
            if (fullSyncRequestableValue.indexOf("#") !== -1) {
                fullSyncRequestableValue = fullSyncRequestableValue.substring(0, fullSyncRequestableValue.indexOf("#"));
            }

            const fullSyncRequestable: FullSyncRequestable = FullSyncRequestable.getFullSyncRequestable(fullSyncRequestableValue);
            if (fullSyncRequestable === null) {
                reject(new C8oException(C8oExceptionMessage.invalidParameterValue(C8oCore.ENGINE_PARAMETER_PROJECT, C8oExceptionMessage.unknownValue("fullSync requestable", fullSyncRequestableValue))));
            }
            let databaseName: string = projectParameterValue.substring(C8oFullSync.FULL_SYNC_PROJECT.length);
            if (databaseName.length < 1) {
                databaseName = this.c8o.defaultDatabaseName;
                if (databaseName === null) {
                    reject(new C8oException(C8oExceptionMessage.invalidParameterValue(C8oCore.ENGINE_PARAMETER_PROJECT, C8oExceptionMessage.missingValue("fullSync database name"))));
                }
            }

            let response: any;

            fullSyncRequestable.handleFullSyncRequest(this, databaseName, parameters, listener).then((result) => {
                response = result;
                if (response === null || response === undefined) {
                    reject(new C8oException(C8oExceptionMessage.couchNullResult()));
                }
                resolve(this.handleFullSyncResponse(response, listener));
            }).catch((error) => {
                if (error instanceof C8oException) {
                    reject(error);
                } else {
                    reject(new C8oException(C8oExceptionMessage.FullSyncRequestFail(), error));
                }
            });
        });
    }

    //noinspection JSUnusedLocalSymbols
    /**
     *
     * @param response
     * @param listener
     * @return response
     * @throws C8oException Failed to parse response.
     */
    public handleFullSyncResponse(response: any, listener: C8oResponseListener): any {
        return response;
    }

    /**
     * Checks if request parameters correspond to a fullSync request.
     */
    public static isFullSyncRequest(requestParameter: Object): boolean {
        if (C8oUtilsCore.getParameterStringValue(requestParameter, C8oCore.ENGINE_PARAMETER_PROJECT, false) !== null) {
            return C8oUtilsCore.getParameterStringValue(requestParameter, C8oCore.ENGINE_PARAMETER_PROJECT, false).indexOf(C8oFullSync.FULL_SYNC_PROJECT) === 0;
        } else {
            return false;
        }
    }

}
import { ReplicationState } from "./fullSyncDatabase"
import { C8oAlldocsLocal } from './c8oAlldocsLocal';
export class C8oFullSyncCbl extends C8oFullSync {
    private static ATTACHMENT_PROPERTY_KEY_CONTENT_URL: string = "content_url";
    private fullSyncDatabases: Object;
    private fullSyncChangeListeners: C8oFullSyncChangeListener[][] = [];
    private cblChangeListeners: any[] = [];
    public replicationsToRestart: Array<ReplicationState> = [];
    public canceled = false;

    constructor(c8o: C8oCore) {
        super(c8o);
        this.fullSyncDatabases = {};
        if (window["C8oFullSyncCbl"] == undefined) {
            window["C8oFullSyncCbl"] = [];
        }
    }

    /**
     * Returns the database with this name in the list.<br/>
     * If it does not already exist yet then creates it and adds it to the list.
     *
     * @param databaseName
     * @return C8oFullSyncDatabase
     * @throws C8oException Failed to create a new fullSync database.
     */
    public async getOrCreateFullSyncDatabase(databaseName: string): Promise<C8oFullSyncDatabase> {
        let mutex = window["C8oFullSyncCbl"][databaseName] == undefined ? window["C8oFullSyncCbl"][databaseName] = new Semaphore(1) : window["C8oFullSyncCbl"][databaseName];
        await mutex.acquire();
        let localDatabaseName: string = databaseName + this.localSuffix;

        localDatabaseName = this.c8o.database.localName(localDatabaseName, true);
        let prefix = this.c8o.prefixBase == true ? this.c8o.session.user.name + "_" : "";

        if (this.fullSyncDatabases[localDatabaseName] == null) {
            this.fullSyncDatabases[localDatabaseName] = new C8oFullSyncDatabase(this.c8o, databaseName, this.fullSyncDatabaseUrlBase, this.localSuffix, prefix);
        }
        mutex.release();
        return this.fullSyncDatabases[localDatabaseName];
    }

    public handleFullSyncResponse(response: any, listener: C8oResponseListener): any {
        response = super.handleFullSyncResponse(response, listener);
        if (listener instanceof C8oResponseJsonListener) {
            if (response instanceof FullSyncDocumentOperationResponse) {
                return C8oFullSyncTranslator.fullSyncDocumentOperationResponseToJson(response as FullSyncDocumentOperationResponse);
            } else if (response instanceof FullSyncDefaultResponse) {
                return C8oFullSyncTranslator.fullSyncDefaultResponseToJson(response as FullSyncDefaultResponse);
            } else if (response instanceof Object) {
                return response as JSON;
            } else {
                throw new C8oException(C8oExceptionMessage.illegalArgumentIncompatibleListener(listener.toString(), typeof response));
            }
        }
    }

    public async handleGetAttachmentUrlRequest(fullSyncDatabaseName: string, docid: string, parameters: Object): Promise<any> {
        let fullSyncDatabase: C8oFullSyncDatabase = null;
        fullSyncDatabase = await this.getOrCreateFullSyncDatabase(fullSyncDatabaseName);
        const attachmentName = C8oUtilsCore.getParameterStringValue(parameters, "attachment_name", false);
        return new Promise((resolve) => {
            fullSyncDatabase.getdatabase.getAttachment(docid, attachmentName).then((buffer) => {
                resolve(buffer);
            });
        });
    }

    public async handleGetDocumentRequest(fullSyncDatabaseName: string, docid: string, parameters: Object): Promise<any> {
        let fullSyncDatabase: C8oFullSyncDatabase = null;
        let param: Object;
        param = parameters["attachments"] ? { attachments: true } : {};
        parameters["binary"] ? param["binary"] = true : {};

        fullSyncDatabase = await this.getOrCreateFullSyncDatabase(fullSyncDatabaseName);
        return new Promise((resolve, reject) => {
            fullSyncDatabase.getdatabase.get(docid, param).then((document) => {
                if (document == null) {
                    reject(new C8oRessourceNotFoundException((C8oExceptionMessage.ressourceNotFound("requested document \"" + docid + "\""))));
                }
                if (document === null) {
                    document = {};
                }
                resolve(document);
            })
                .catch((error) => {
                    reject(error);
                });

        });
    }

    public async handleDeleteDocumentRequest(DatabaseName: string, docid: string, parameters: Object): Promise<any> {
        return new Promise(async (resolve, reject) => {
            let fullSyncDatabase: C8oFullSyncDatabase = null;

            fullSyncDatabase = await this.getOrCreateFullSyncDatabase(DatabaseName);
            const revParameterValue: string = C8oUtilsCore.getParameterStringValue(parameters, FullSyncDeleteDocumentParameter.REV.name, false);
            let documentRevision: string;
            if (revParameterValue === null) {
                fullSyncDatabase.getdatabase.get(docid).then((doc) => {
                    if (doc === null) {
                        reject(new C8oRessourceNotFoundException("Cannot find document"));
                    }
                    documentRevision = doc._rev;
                    return fullSyncDatabase.getdatabase.remove(doc);
                }).then((result) => {
                    resolve(new FullSyncDocumentOperationResponse(docid, documentRevision, result.ok));
                }).catch((err) => {
                    reject(new C8oException(C8oExceptionMessage.couchRequestDeleteDocument(), err));
                });
            } else {

                fullSyncDatabase.getdatabase.remove(docid, revParameterValue)
                    .then((result) => {
                        resolve(new FullSyncDocumentOperationResponse(docid, documentRevision, result.ok));
                    }).catch((err) => {
                        reject(new C8oException(C8oExceptionMessage.couchRequestDeleteDocument(), err));
                    });


            }
        });
    }

    public async handlePostDocumentRequest(databaseName: string, fullSyncPolicy: FullSyncPolicy, parameters: Object, fullsyncPolicySubMerge = null): Promise<any> {
        let fullSyncDatabase: C8oFullSyncDatabase;
        fullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
        let subkeySeparatorParameterValue: string = C8oUtilsCore.getParameterStringValue(parameters, C8oCore.FS_SUBKEY_SEPARATOR, false);
        if (subkeySeparatorParameterValue == null) {
            subkeySeparatorParameterValue = ".";
        }
        const newProperties = {};
        for (let i = 0; i < Object.keys(parameters).length; i++) {
            let parameterName: string = Object.keys(parameters)[i];
            if (parameterName.indexOf("__") !== 0 && parameterName.indexOf("_use_") !== 0) {
                let objectParameterValue: any = parameters[Object.keys(parameters)[i]];
                const paths: string[] = parameterName.split(subkeySeparatorParameterValue);
                if (paths.length > 1) {
                    parameterName = paths[0];
                    let count = paths.length - 1;
                    while (count > 0) {
                        const tmpObject: Object = {};
                        tmpObject[paths[count]] = objectParameterValue;
                        objectParameterValue = tmpObject;
                        count--;
                    }
                    const existProperty = newProperties[parameterName];
                    if (existProperty != null) {
                        C8oFullSyncCbl.mergeProperties(objectParameterValue, existProperty);
                    }
                }
                newProperties[parameterName] = objectParameterValue;
            }


        }
        if (fullsyncPolicySubMerge != null) {

        }
        const db = fullSyncDatabase.getdatabase;
        return new Promise((resolve, reject) => {
            fullSyncPolicy.action(db, newProperties, { fullsyncPolicySubMerge: fullsyncPolicySubMerge, subkeySeparatorParameterValue: subkeySeparatorParameterValue })
                .then((createdDocument: any) => {
                    const fsDocOpeResp: FullSyncDocumentOperationResponse = new FullSyncDocumentOperationResponse(createdDocument.id, createdDocument.rev, createdDocument.ok);
                    resolve(fsDocOpeResp);
                }).catch((error) => {
                    reject(error);
                });
        });
    }


    public async handlePutAttachmentRequest(databaseName: string, docid: string, attachmentName: string, attachmentType: string, attachmentContent: any): Promise<any> {
        let document: any = null;
        const fullSyncDatabase: C8oFullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);

        return new Promise((resolve, reject) => {
            fullSyncDatabase.getdatabase.get(docid).then((result) => {
                document = result;

                if (document !== null) {
                    fullSyncDatabase.getdatabase.putAttachment(docid, attachmentName, result._rev, attachmentContent, attachmentType)
                        .then((result) => {
                            //  handle result
                            resolve(new FullSyncDocumentOperationResponse(result._id, result._rev, result.ok));
                        }).catch((err) => {
                            reject(new C8oCouchBaseLiteException("Unable to put the attachment " + attachmentName + " to the document " + docid + ".", err));
                        });
                } else {
                    reject(new C8oRessourceNotFoundException("Cannot find document"));
                }

            });
        });

    }

    public async  handleGetAttachmentRequest(databaseName: string, docid: string, attachmentName: string, parameters: any): Promise<any> {
        let document: any = null;
        const fullSyncDatabase: C8oFullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
        return new Promise((resolve, reject) => {
            fullSyncDatabase.getdatabase.getAttachment(docid, attachmentName, parameters)
                .then((buffer) => {
                    resolve(buffer);
                }).catch((err) => {
                    reject(new C8oCouchBaseLiteException("Unable to put the attachment " + attachmentName + " to the document " + docid + ".", err));
                });
        });

    }

    public async handleDeleteAttachmentRequest(databaseName: string, docid: string, attachmentName: string): Promise<any> {
        let document: any = null;
        const fullSyncDatabase: C8oFullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);

        return new Promise((resolve, reject) => {
            fullSyncDatabase.getdatabase.get(docid).then((result) => {
                document = result;
            }).then(() => {
                if (document !== null) {
                    fullSyncDatabase.getdatabase.removeAttachment(docid, attachmentName, document._rev).catch((err) => {
                        reject(new C8oCouchBaseLiteException("Unable to delete the attachment " + attachmentName + " to the document " + docid + ".", err));
                    });
                } else {
                    reject(new C8oRessourceNotFoundException("Document do not exists"));
                }
                resolve(new FullSyncDocumentOperationResponse(document._id, document._rev, true));
            })
                .catch((err) => {
                    reject(new C8oException(err.message, err));
                })
        });
    }

    public async handleAllDocumentsRequest(databaseName: string, parameters: Object): Promise<any> {
        let fullSyncDatabase = null;

        fullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
        return new Promise((resolve, reject) => {
            fullSyncDatabase.getdatabase
                .allDocs(parameters)
                .then((res) => {
                    resolve(res);
                })
                .catch((err) => {
                    reject(new C8oException(err.stack));
                });
        });
    }
    public async handleAllLocalDocumentsRequest(databaseName: string, parameters: Object): Promise<any> {
        let fullSyncDatabase = null;
        fullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
        let c8oAlldocsLocal = new C8oAlldocsLocal(this.c8o);
        return new Promise((resolve, reject) => {
            c8oAlldocsLocal.alldocs(parameters, fullSyncDatabase.database)
                .then((res) => {
                    if (!res.err) {
                        resolve(res.result);
                    }
                    else {
                        if (res["err"]["stack"] != undefined) {
                            reject(new C8oException(res["err"]["stack"]));
                        }
                        else {
                            reject(new C8oException(JSON.stringify(res["err"])))
                        }
                    }

                })
                .catch((err) => {
                    if (err["err"]["stack"] != undefined) {
                        reject(new C8oException(err["err"]["stack"]));
                    }
                    else {
                        reject(new C8oException(JSON.stringify(err["err"])))
                    }
                });
        });
    }

    public async handleGetViewRequest(databaseName: string, ddocName: string, viewName: string, parameters: Object): Promise<any> {
        let fullSyncDatabase = null;
        fullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
        let attachments;
        let binary;
        let include_docs;
        if (parameters["attachments"] && window["cblite"] !== undefined) {
            attachments = C8oUtilsCore.getParameterStringValue(parameters, "attachments", false);
            binary = C8oUtilsCore.getParameterStringValue(parameters, "binary", false);
            include_docs = C8oUtilsCore.getParameterStringValue(parameters, "include_docs", false);
        }

        return new Promise((resolve, reject) => {
            fullSyncDatabase.getdatabase.query(ddocName + "/" + viewName, parameters)
                .then((result) => {
                    if (attachments) {
                        const array: Object[] = [];
                        let len = 0;
                        for (const resp of result.rows) {
                            this.handleGetDocumentRequest(databaseName, resp.id, {
                                attachments: true,
                                binary: true,
                                include_docs: true,
                            }).then((getResult) => {
                                array.push(getResult);
                                len++;
                                if (len === result.rows.length) {
                                    result.rows = array;
                                    resolve(result);
                                }
                            });
                        }
                    } else {
                        resolve(result);
                    }

                }).catch((error) => {
                    reject(new C8oException(C8oExceptionMessage.couchRequestGetView(), error));
                });
        });

    }

    /**
     * Check network status before starting a replication
     */
    private checkState(): boolean {
        return this.c8o.reachable == undefined ? false : this.c8o.reachable;
    }

    public async handleSyncRequest(databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener): Promise<any> {
        const fullSyncDatabase: C8oFullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
        let resp = this.c8o.database.registerRequest(c8oResponseListener, parameters, "sync", fullSyncDatabase);
        if (!resp[0]) {
            return fullSyncDatabase.startAllReplications(parameters, c8oResponseListener, resp[1]);
        }
        else {
            this.c8o.log._trace("[c8ofullsync] waiting for network to start replication");
            return new Promise(() => { });
        }
    }

    public async handleReplicatePullRequest(databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener): Promise<any> {
        const fullSyncDatabase: C8oFullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
        let resp = this.c8o.database.registerRequest(c8oResponseListener, parameters, "pull", fullSyncDatabase);
        if (!resp[0]) {
            return fullSyncDatabase.startPullReplication(parameters, c8oResponseListener, resp[1]);
        }
        else {
            this.c8o.log._trace("[c8ofullsync] waiting for network to start replication");
            return new Promise(() => { });
        }
    }

    public async handleReplicatePushRequest(databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener): Promise<any> {
        const fullSyncDatabase: C8oFullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
        let resp = this.c8o.database.registerRequest(c8oResponseListener, parameters, "push", fullSyncDatabase);
        if (!resp[0]) {
            return fullSyncDatabase.startPushReplication(parameters, c8oResponseListener, resp[1]);
        }
        else {
            this.c8o.log._trace("[c8ofullsync] waiting for network to start replication");
            return new Promise(() => { });
        }
    }

    public handleResetDatabaseRequest(databaseName: string): Promise<FullSyncDefaultResponse> {
        return new Promise((resolve, reject) => {
            this.handleDestroyDatabaseRequest(databaseName).then(() => {
                this.handleCreateDatabaseRequest(databaseName).
                    then((res) => {
                        resolve(res);
                    })
                    .catch((err) => {
                        reject(err);
                    })

            })
                .catch((err) => {
                    reject(err);
                })
        });

    }

    public async handleCreateDatabaseRequest(databaseName: string): Promise<FullSyncDefaultResponse> {
        await this.getOrCreateFullSyncDatabase(databaseName);
        return new FullSyncDefaultResponse(true);
    }

    public async handleBulkRequest(databaseName: string, parameters: Object): Promise<any> {
        const fullSyncDatabase: C8oFullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
        return new Promise((resolve, reject) => {
            const header = {
                "x-convertigo-sdk": this.c8o.sdkVersion,
            };
            Object.assign(header, this.c8o.headers);
            let remotePouchHeader = {
                fetch: (url, opts) => {
                    opts.credentials = 'include';
                    for (let key in header) {
                        opts.headers.set(key, header[key]);
                    }
                    return PouchDB.fetch(url, opts);
                }
            };
            fullSyncDatabase.getdatabase.c8oload(parameters["data"],

                {
                    proxy: this.c8o.endpointConvertigo + "/fullsync/" + (fullSyncDatabase.getdatabseName).replace("_device", ""),
                    fetch: (url, opts) => {
                        opts.credentials = 'include';
                        for (let key in header) {
                            opts.headers.set(key, header[key]);
                        }
                        return PouchDB.fetch(url, opts);
                    }
                },
                this.c8o
            )
                .then(() => {
                    resolve(new FullSyncDefaultResponse(true));
                }).catch((err) => {
                    //this.c8o.log._error("Error loading the " + parameters["data"] + " database resource" + JSON.stringify(err, Object.getOwnPropertyNames(err)))
                    reject(new C8oException("Bulk Load failed", err));
                })
            /*fullSyncDatabase.getdatabase.load(parameters["data"], {
                proxy: this.c8o.endpointConvertigo + "/fullsync/" + (fullSyncDatabase.getdatabseName).replace("_device", ""),
                credentials: 'include',
                ajax: {
                    withCredentials: true
                }
            },remotePouchHeader
            ).then(() => {
                resolve(new FullSyncDefaultResponse(true));
            }).catch((err) => {
                //this.c8o.log._error("Error loading the " + parameters["data"] + " database resource" + JSON.stringify(err, Object.getOwnPropertyNames(err)))
                reject(new C8oException("Bulk Load failed", err));
            })*/
        })
    }

    public async handleInfoRequest(databaseName: string): Promise<any> {
        const fullSyncDatabase: C8oFullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
        return new Promise((resolve, reject) => {
            fullSyncDatabase.getdatabase.info()
                .then((response) => {
                    resolve(response);
                }).catch((err) => {
                    //this.c8o.log._error("Error loading the " + parameters["data"] + " database resource" + JSON.stringify(err, Object.getOwnPropertyNames(err)))
                    reject(new C8oException("Get info failed", err));
                })
        })
    }

    public async handleDestroyDatabaseRequest(databaseName: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
            const localDatabaseName = databaseName + this.localSuffix;
            (await this.getOrCreateFullSyncDatabase(databaseName)).deleteDB().then((response) => {
                if (this.fullSyncDatabases[this.c8o.database.localName(localDatabaseName)] !== null) {
                    delete this.fullSyncDatabases[this.c8o.database.localName(localDatabaseName)];
                }
                resolve(new FullSyncDefaultResponse(response.ok));
            }).catch((err) => {
                reject(new C8oException(err.name, err));
            });
        });
    }

    /**
     * Allow to clone object whithout reference
     * 
     * @param obj Object: object to be cloned 
     */
    public static deepCloneObject(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        var temporarystorage = obj.constructor();
        for (var key in obj) {
            temporarystorage[key] = C8oFullSyncCbl.deepCloneObject(obj[key]);
        }
        return temporarystorage;
    }

    /**
     * Recursive function that browse object to be modified and apply delete
     * 
     * @param objToChange Object: the object to be modified
     * @param path string: The path where to find object to be modified
     * @param index number: index
     * @param subPolicy Object: subPolicy to be applied
     */
    public static applySubPolicyDelete (objToChange, path, index, subPolicy) {
        let arrayPath = path.split(subPolicy.subkeySeparatorParameterValue);
        let length = arrayPath.length;
        if(index + 1 == length){
            // delete key
            delete objToChange[arrayPath[index]];
        }
        else{
            //recursive call to navigate to property
            C8oFullSyncCbl.applySubPolicyDelete(objToChange[arrayPath[index]],path, index + 1, subPolicy);
        }
    }

    /**
     * Recursive function that browse object to be modified and apply override
     * 
     * @param objToChange Object: the object to be modified
     * @param path string: The path where to find object to be modified
     * @param index number: index
     * @param source Object: the object posted
     * @param subPolicy Object: subPolicy to be applied
     */
    public static applySubPolicyOverride(objToChange, path, index, source, subPolicy) {
        let arrayPath = path.split(subPolicy.subkeySeparatorParameterValue);
        let length = arrayPath.length;
        if(index + 1 == length){
            // change key
            // user has not given object to override
            if(source == undefined){
               
            }
            else if(source[arrayPath[index]] != null){
                objToChange[arrayPath[index]] = source[arrayPath[index]];
            }
        }
        else{
            //recursive call to navigate to property
            C8oFullSyncCbl.applySubPolicyOverride(objToChange[arrayPath[index]],path, index + 1, source[arrayPath[index]], subPolicy);
        }
    }

    /**
     * Global function that will apply sub policy for merge
     * 
     * @param override boolean: if we have to perform override sub policy or not
     * @param source Object: the object posted
     * @param objToChange Object: the object to be modified
     * @param subPolicy Object: subPolicy to be applied
     */
    public static applySubPolicyForMerge(override, source, objToChange, subPolicy){
        for(let elem of subPolicy.fullsyncPolicySubMerge){
            switch(elem.value){
                case "override":
                    if(override){
                        C8oFullSyncCbl.applySubPolicyOverride(objToChange, elem.key, 0, source, subPolicy);
                    }
                break;
                case "delete":
                    C8oFullSyncCbl.applySubPolicyDelete(objToChange,elem.key, 0,subPolicy);
                break;
            }
        }
    }

    public static mergeProperties(newProperties: Object, oldProperties: Object, useMergePolicy = "none") {
        for (let i = 0; i < Object.keys(oldProperties).length; i++) {
            const oldPropertyKey = Object.keys(oldProperties)[i];
            const oldPropertyValue = oldProperties[Object.keys(oldProperties)[i]];
            // Checks if the new document contains the same key
            if (newProperties[oldPropertyKey] !== null && newProperties[oldPropertyKey] !== undefined) {
                const newDocumentValue = newProperties[oldPropertyKey];
                if (Object.prototype.toString.call(newDocumentValue) === "[object Array]" && Object.prototype.toString.call(oldPropertyValue) === "[object Array]") {
                    C8oFullSyncCbl.mergeArrayProperties(newDocumentValue, oldPropertyValue);
                } else if (typeof (newDocumentValue) === "object" && typeof (oldPropertyValue) === "object") {
                    C8oFullSyncCbl.mergeProperties(newDocumentValue, oldPropertyValue);
                } else {
                    // If the new document has the same key but its value is not the same type than the old one or if their type are "simple"
                    // Does nothing cause the right value is the new one
                }
            } else {
                // If the new document does not contain the key then adds it
                newProperties[oldPropertyKey] = oldPropertyValue;
            }
        }
    }

    public static mergeArrayProperties(newArray: any, oldArray: any) {
        const newArraySize = newArray.length;
        const oldArraySize = oldArray.length;
        for (let i = 0; i < oldArraySize; i++) {
            let newArrayValue: any = null;
            if (i < newArraySize) {
                newArrayValue = newArray[i];
            }
            const oldArrayValue = oldArray[i];

            if (newArrayValue !== null) {
                if (newArrayValue instanceof Array && oldArrayValue instanceof Array) {
                    C8oFullSyncCbl.mergeArrayProperties(newArrayValue, oldArrayValue);
                } else if (typeof (newArrayValue) === "object" && typeof (oldArrayValue) === "object") {
                    C8oFullSyncCbl.mergeProperties(newArrayValue, oldArrayValue);
                } else {
                    // If the new array value is not the same type than the old one or if their type are "simple"
                    // Does nothing cause the right value is the new one
                }
            } else {
                // If the new array value is null then it means that it size is reach so we can add objects at its end
                newArray.push(oldArrayValue);
            }
        }
    }

    //noinspection JSUnusedLocalSymbols
    public async getDocucmentFromDatabase(c8o: C8oCore, databaseName: string, documentId: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
            let c8oFullSyncDatabase: C8oFullSyncDatabase;
            try {
                c8oFullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
            } catch (err) {
                reject(new C8oException(C8oExceptionMessage.fullSyncGetOrCreateDatabase(databaseName), err));
            }
            c8oFullSyncDatabase.getdatabase().get(documentId).then((result) => {
                resolve(result);
            });
        });
    }

    public async overrideDocument(document: any, properties: Object, databaseName) {
        properties[C8oFullSync.FULL_SYNC__REV] = document._rev;
        let c8oFullSyncDatabase: C8oFullSyncDatabase;
        try {
            c8oFullSyncDatabase = await this.getOrCreateFullSyncDatabase(databaseName);
        } catch (err) {
            throw new C8oException(C8oExceptionMessage.fullSyncGetOrCreateDatabase(databaseName));
        }

        c8oFullSyncDatabase.getdatabase().put(properties)
            .catch((err) => {
                throw new C8oException(err.message, err);
            });

    }

    public async getResponseFromLocalCache(c8oCallRequestIdentifier: string): Promise<any> {
        const fullSyncDatabase = await this.getOrCreateFullSyncDatabase(C8oCore.LOCAL_CACHE_DATABASE_NAME);
        let localCacheDocument = null;
        return new Promise((resolve, reject) => {
            fullSyncDatabase.getdatabase.get(c8oCallRequestIdentifier).then((result) => {
                localCacheDocument = result;

                const response = JSON.stringify(localCacheDocument[C8oCore.LOCAL_CACHE_DOCUMENT_KEY_RESPONSE]);
                const responseType = localCacheDocument[C8oCore.LOCAL_CACHE_DOCUMENT_KEY_RESPONSE_TYPE];
                const expirationDate = localCacheDocument[C8oCore.LOCAL_CACHE_DOCUMENT_KEY_EXPIRATION_DATE];

                let responseString: string = null;
                let responseTypeString: string = null;
                let expirationDateNumber: number = -1;

                if (response != null) {
                    if (typeof response === "string") {
                        responseString = response;
                    } else {
                        reject(new C8oException(C8oExceptionMessage.InvalidLocalCacheResponseInformation()));
                    }
                }
                if (responseType != null) {
                    if (typeof responseType === "string") {
                        responseTypeString = responseType;
                    } else {
                        reject(new C8oException(C8oExceptionMessage.InvalidLocalCacheResponseInformation()));
                    }
                }
                if (expirationDate != null) {
                    if (typeof expirationDate === "number") {
                        expirationDateNumber = expirationDate;
                        const currentTime = new Date().getTime();
                        if (expirationDateNumber < currentTime) {
                            reject(new C8oUnavailableLocalCacheException(C8oExceptionMessage.timeToLiveExpired()));
                        }
                    } else {
                        reject(new C8oException(C8oExceptionMessage.InvalidLocalCacheResponseInformation()));
                    }
                }
                resolve(new C8oLocalCacheResponse(responseString, responseTypeString, expirationDateNumber));
            }).catch((err) => {
                if (err.status === 404) {
                    resolve(new C8oUnavailableLocalCacheException(C8oExceptionMessage.localCacheDocumentJustCreated(), err));
                } else {
                    reject(err);
                }
            });
        });

    }

    public async saveResponseToLocalCache(c8oCallRequestIdentifier: string, localCacheResponse: C8oLocalCacheResponse): Promise<any> {
        const fullSyncDatabase: C8oFullSyncDatabase = await this.getOrCreateFullSyncDatabase(C8oCore.LOCAL_CACHE_DATABASE_NAME);
        return new Promise((resolve) => {
            fullSyncDatabase.getdatabase.get(c8oCallRequestIdentifier).then((localCacheDocument) => {
                const properties = {};
                properties[C8oFullSync.FULL_SYNC__ID] = c8oCallRequestIdentifier;
                properties[C8oCore.LOCAL_CACHE_DOCUMENT_KEY_RESPONSE] = localCacheResponse.getResponse();
                properties[C8oCore.LOCAL_CACHE_DOCUMENT_KEY_RESPONSE_TYPE] = localCacheResponse.getResponseType();
                if (localCacheResponse.getExpirationDate() > 0) {
                    properties[C8oCore.LOCAL_CACHE_DOCUMENT_KEY_EXPIRATION_DATE] = localCacheResponse.getExpirationDate();
                }
                const currentRevision = localCacheDocument._rev;
                if (currentRevision !== null) {
                    properties[C8oFullSyncCbl.FULL_SYNC__REV] = currentRevision;
                }
                fullSyncDatabase.getdatabase.put(properties).then((result) => {
                    resolve(result);
                });
            }).catch((error) => {
                if (error.status === 404) {
                    const properties = {};
                    properties[C8oFullSync.FULL_SYNC__ID] = c8oCallRequestIdentifier;
                    properties[C8oCore.LOCAL_CACHE_DOCUMENT_KEY_RESPONSE] = localCacheResponse.getResponse();
                    properties[C8oCore.LOCAL_CACHE_DOCUMENT_KEY_RESPONSE_TYPE] = localCacheResponse.getResponseType();
                    if (localCacheResponse.getExpirationDate() > 0) {
                        properties[C8oCore.LOCAL_CACHE_DOCUMENT_KEY_EXPIRATION_DATE] = localCacheResponse.getExpirationDate();
                    }
                    fullSyncDatabase.getdatabase.put(properties).then((result) => {
                        resolve(result);
                    });
                } else {
                    resolve(error);
                }
            });
        });
    }

    public async addFullSyncChangeListener(db: string, listener: C8oFullSyncChangeListener) {
        if (db === null || db === "") {
            db = this.c8o.defaultDatabaseName;
        }

        const listeners: C8oFullSyncChangeListener[][] = [];
        if (this.fullSyncChangeListeners[db] != null) {
            listeners[0] = this.fullSyncChangeListeners[db];
        } else {
            listeners[0] = [];
            this.fullSyncChangeListeners[db] = listeners[0];
            //noinspection UnnecessaryLocalVariableJS
            const evtHandler = (await this.getOrCreateFullSyncDatabase(db)).getdatabase
                .changes({
                    since: "now",
                    live: true,
                    include_docs: true,
                }).on("change", function (change) {
                    const changes: Object = {};
                    const docs: Object[] = [];
                    // docs["isExternal"] = false;
                    const doc: Object = {};
                    doc["id"] = change.doc._id;
                    doc["rev"] = change.doc._rev;
                    doc["isConflict"] = change.doc._conflicts;
                    if (change.source != null) {
                        doc["sourceUrl"] = change.source;
                    }
                    docs.push(doc);
                    changes["changes"] = docs;
                    for (const handler of listeners[0]) {
                        if (handler !== undefined) {
                            handler.onChange(changes);
                        }
                    }

                });
            this.cblChangeListeners[db] = evtHandler;
        }
        listeners[0].push(listener);
    }

    public async removeFullSyncChangeListener(db: string, listener: C8oFullSyncChangeListener) {
        if (db === null || db === "") {
            db = this.c8o.defaultDatabaseName;
        }
        if (this.fullSyncChangeListeners[db] != null) {
            const listeners: C8oFullSyncChangeListener[] = this.fullSyncChangeListeners[db];
            for (const list in listeners) {
                if (listeners[list] === listener) {
                    delete listeners[list];
                }
            }
            if (listeners.length === 0 || listeners == null) {
                (await this.getOrCreateFullSyncDatabase(db)).getdatabase.cancel();
                this.cblChangeListeners[db].cancel();
                delete this.fullSyncChangeListeners[db];
                delete this.cblChangeListeners[db];
            }
        }
    }
}
