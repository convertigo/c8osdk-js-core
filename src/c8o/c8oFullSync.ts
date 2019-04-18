import { C8oBase } from "./c8oBase";
import { C8oCore, FullSyncPolicy } from "./c8oCore";
import { C8oFullSyncChangeListener } from "./c8oFullSyncChangeListener";
import { C8oFullSyncTranslator } from "./c8oFullSyncTranslator";
import { C8oLocalCacheResponse } from "./c8oLocalCacheResponse";
import { C8oResponseJsonListener, C8oResponseListener } from "./c8oResponse";
import { C8oUtilsCore } from "./c8oUtilsCore";
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
import {ReplicationState} from "./fullSyncDatabase"
export class C8oFullSyncCbl extends C8oFullSync {
    private static ATTACHMENT_PROPERTY_KEY_CONTENT_URL: string = "content_url";
    private fullSyncDatabases: Object;
    private fullSyncChangeListeners: C8oFullSyncChangeListener[][] = [];
    private cblChangeListeners: any[] = [];
    public replicationsToRestart: Array<ReplicationState>  = [];
    public canceled = false;

    constructor(c8o: C8oCore) {
        super(c8o);
        this.fullSyncDatabases = {};
    }

    

    /**
     * Get all actives replications, cancel and store them 
     */
    public cancelActiveReplications(){
        this.replicationsToRestart = [];
        for(let db in this.fullSyncDatabases){
            if(!(this.fullSyncDatabases[db] as C8oFullSyncDatabase).pullState == false && (this.fullSyncDatabases[db] as C8oFullSyncDatabase).pullState != "cancelled"){
                let rState: ReplicationState = (this.fullSyncDatabases[db] as C8oFullSyncDatabase).cancelPullReplication();
                rState.database = this.fullSyncDatabases[db];
                rState.stopped = true;
                this.replicationsToRestart.push(rState);
                this.c8o.log._debug("[cancelActiveReplications] stopping replication " + rState.database.getdatabseName + ".replicate_pull " + (rState.parameters["continuous"] == true ? " in continous mode" : "since replication was not finished"));
            }
            if(!(this.fullSyncDatabases[db] as C8oFullSyncDatabase).pushState == false && (this.fullSyncDatabases[db] as C8oFullSyncDatabase).pushState != "cancelled"){
                let rState: ReplicationState = (this.fullSyncDatabases[db] as C8oFullSyncDatabase).cancelPushReplication();
                rState.database = this.fullSyncDatabases[db];
                rState.stopped = true;
                this.replicationsToRestart.push(rState);
                this.c8o.log._debug("[cancelActiveReplications] stopping replication for database " + rState.database.getdatabseName + ".replicate_push" + (rState.parameters["continuous"] == true ? " in continous mode" : "since replication was not finished"));
            }
            if(!(this.fullSyncDatabases[db] as C8oFullSyncDatabase).syncState == false && (this.fullSyncDatabases[db] as C8oFullSyncDatabase).syncState != "cancelled"){
                let rState: ReplicationState = (this.fullSyncDatabases[db] as C8oFullSyncDatabase).cancelSyncReplication();
                rState.database = this.fullSyncDatabases[db];
                rState.stopped = true;
                this.replicationsToRestart.push(rState);
                this.c8o.log._debug("[cancelActiveReplications] stopping replication for database " + rState.database.getdatabseName + ".sync" + (rState.parameters["continuous"] == true ? " in continous mode" : "since replication was not finished"));
            }
        }
        this.canceled == true;
    }
    /**
     * Get all paused replications, (due to offline or session losses) and restart them 
     */
    public restartStoppedReplications(){
        this.canceled == false;
        for(let el of this.replicationsToRestart){
            el.stopped = false;
            switch(el.type){
                case "sync":
                    this.c8o.log._debug("restartStoppedReplications] restarting replication for database " + el.database.getdatabseName + " and verb sync " + (el.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                    el.database.startAllReplications(el.parameters, el.listener);
                break;
                case "push":
                    this.c8o.log._debug("[restartStoppedReplications] restarting replication for database " + el.database.getdatabseName + " and verb push " + (el.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                    el.database.startPushReplication(el.parameters, el.listener);
                break;
                case "pull":
                    this.c8o.log._debug("[restartStoppedReplications] restarting replication for database " + el.database.getdatabseName + " and verb pull " + (el.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                    el.database.startPullReplication(el.parameters, el.listener);
                break;
            }
        }
        let nb = this.replicationsToRestart.length;
        let str = "";
        if(nb == 0 || nb == undefined){
            str = "There is no replication to restart";
        }
        else if(nb == 1){
            str  = " "+ nb +" replication has been restarted"
        }
        else if(nb > 1){
            str  = " "+ nb +" replications has been restarted"
        }
        this.c8o.log._debug("[restartStoppedReplications] "+ str);
        this.replicationsToRestart = [];
    }

    /**
     * Returns the database with this name in the list.<br/>
     * If it does not already exist yet then creates it and adds it to the list.
     *
     * @param databaseName
     * @return C8oFullSyncDatabase
     * @throws C8oException Failed to create a new fullSync database.
     */
    public getOrCreateFullSyncDatabase(databaseName: string): C8oFullSyncDatabase {
        const localDatabaseName: string = databaseName + this.localSuffix;

        if (this.fullSyncDatabases[localDatabaseName] == null) {
            this.fullSyncDatabases[localDatabaseName] = new C8oFullSyncDatabase(this.c8o, databaseName, this.fullSyncDatabaseUrlBase, this.localSuffix);
        }
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

    public handleGetAttachmentUrlRequest(fullSyncDatabaseName: string, docid: string, parameters: Object): Promise<any> {
        let fullSyncDatabase: C8oFullSyncDatabase = null;
        fullSyncDatabase = this.getOrCreateFullSyncDatabase(fullSyncDatabaseName);
        const attachmentName = C8oUtilsCore.getParameterStringValue(parameters, "attachment_name", false);
        return new Promise((resolve) => {
            fullSyncDatabase.getdatabase.getAttachment(docid, attachmentName).then((buffer) => {
                resolve(buffer);
            });
        });
    }

    public handleGetDocumentRequest(fullSyncDatabaseName: string, docid: string, parameters: Object): Promise<any> {
        let fullSyncDatabase: C8oFullSyncDatabase = null;
        let dictDoc: Object = {};
        let param: Object;
        param = parameters["attachments"] ? { attachments: true } : {};
        parameters["binary"] ? param["binary"] = true : {};

        fullSyncDatabase = this.getOrCreateFullSyncDatabase(fullSyncDatabaseName);
        return new Promise((resolve, reject) => {
            fullSyncDatabase.getdatabase.get(docid, param).then((document) => {
                if (document != null) {
                    dictDoc = document;
                    const attachments = document[C8oFullSync.FULL_SYNC__ATTACHMENTS];
                    if (attachments != null) {
                        for (const attachmentName of attachments) {
                            const url = attachments.url;
                            const attachmentDesc: Object = attachments[attachmentName];
                            attachmentDesc[C8oFullSyncCbl.ATTACHMENT_PROPERTY_KEY_CONTENT_URL] = url.toString();
                            const dictAny: Object = {};
                            dictAny[attachmentName] = attachmentDesc;
                            dictDoc[C8oFullSyncCbl.FULL_SYNC__ATTACHMENTS] = dictAny;
                        }
                    }
                } else {
                    reject(new C8oRessourceNotFoundException((C8oExceptionMessage.ressourceNotFound("requested document \"" + docid + "\""))));
                }
                if (dictDoc === null) {
                    dictDoc = {};
                }
                resolve(dictDoc);
            })
                .catch((error) => {
                    reject(error);
                });

        });
    }

    public handleDeleteDocumentRequest(DatabaseName: string, docid: string, parameters: Object): Promise<any> {
        return new Promise((resolve, reject) => {
            let fullSyncDatabase: C8oFullSyncDatabase = null;

            fullSyncDatabase = this.getOrCreateFullSyncDatabase(DatabaseName);
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

    public handlePostDocumentRequest(databaseName: string, fullSyncPolicy: FullSyncPolicy, parameters: Object): Promise<FullSyncDocumentOperationResponse> {
        let fullSyncDatabase: C8oFullSyncDatabase;
        fullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);
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
        const db = fullSyncDatabase.getdatabase;
        return new Promise((resolve, reject) => {
            fullSyncPolicy.action(db, newProperties).then((createdDocument) => {
                const fsDocOpeResp: FullSyncDocumentOperationResponse = new FullSyncDocumentOperationResponse(createdDocument.id, createdDocument.rev, createdDocument.ok);
                resolve(fsDocOpeResp);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    public handlePutAttachmentRequest(databaseName: string, docid: string, attachmentName: string, attachmentType: string, attachmentContent: any): Promise<any> {
        let document: any = null;
        const fullSyncDatabase: C8oFullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);

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

    public handleDeleteAttachmentRequest(databaseName: string, docid: string, attachmentName: string): Promise<any> {
        let document: any = null;
        const fullSyncDatabase: C8oFullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);

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

    public handleAllDocumentsRequest(databaseName: string, parameters: Object): Promise<any> {
        let fullSyncDatabase = null;

        fullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);
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

    public handleGetViewRequest(databaseName: string, ddocName: string, viewName: string, parameters: Object): Promise<any> {
        let fullSyncDatabase = null;
        fullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);
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
    private checkState(): boolean{
        return this.c8o.reachable == undefined ? false : this.c8o.reachable;
    }

    public handleSyncRequest(databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener): Promise<any> {
        const fullSyncDatabase: C8oFullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);
        if(this.checkState()){
            return fullSyncDatabase.startAllReplications(parameters, c8oResponseListener);
        }
        else{
            fullSyncDatabase.assignState(c8oResponseListener,parameters,"push");
            fullSyncDatabase.assignState(c8oResponseListener,parameters,"pull");
            let rState: ReplicationState = {listener:c8oResponseListener, database:fullSyncDatabase, parameters: parameters, type:"sync", stopped:true};
            rState.database = fullSyncDatabase;
            this.replicationsToRestart.push(rState);
            this.c8o.log._debug("[c8ofullsync] waiting for network to start replication");
            return new Promise(()=>{});
        }
    }

    public handleReplicatePullRequest(databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener): Promise<any> {
        const fullSyncDatabase: C8oFullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);
        if(this.checkState()){
            return fullSyncDatabase.startPullReplication(parameters, c8oResponseListener);
        }
        else{
            fullSyncDatabase.assignState(c8oResponseListener,parameters,"pull");
            let rState: ReplicationState = {listener:c8oResponseListener, database:fullSyncDatabase, parameters: parameters, type:"pull", stopped:true};
            rState.database = fullSyncDatabase;
            this.replicationsToRestart.push(rState);
            this.c8o.log._debug("[c8ofullsync] waiting for network to start replication");
            return new Promise(()=>{});
        }

        
    }

    public handleReplicatePushRequest(databaseName: string, parameters: Object, c8oResponseListener: C8oResponseListener): Promise<any> {
        const fullSyncDatabase: C8oFullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);
        if(this.checkState()){
            return fullSyncDatabase.startPushReplication(parameters, c8oResponseListener);
        }
        else{
            fullSyncDatabase.assignState(c8oResponseListener,parameters,"push");
            let rState: ReplicationState = {listener:c8oResponseListener, database:fullSyncDatabase, parameters: parameters, type:"push", stopped:true};
            rState.database = fullSyncDatabase;
            this.replicationsToRestart.push(rState);
            this.c8o.log._debug("[c8ofullsync] waiting for network to start replication");
            return new Promise(()=>{});
        }
    }

    public handleResetDatabaseRequest(databaseName: string): Promise<FullSyncDefaultResponse> {
        return new Promise((resolve) => {
            this.handleDestroyDatabaseRequest(databaseName).then(() => {
                resolve(this.handleCreateDatabaseRequest(databaseName));
            });
        });

    }

    public handleCreateDatabaseRequest(databaseName: string): FullSyncDefaultResponse {
        this.getOrCreateFullSyncDatabase(databaseName);
        return new FullSyncDefaultResponse(true);
    }

    public handleBulkRequest(databaseName: string, parameters: Object): Promise<FullSyncDefaultResponse> {
        const fullSyncDatabase: C8oFullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);
        return new Promise((resolve, reject) => {
            fullSyncDatabase.getdatabase.load(parameters["data"], {
                proxy: this.c8o.endpointConvertigo + "/fullsync/" + fullSyncDatabase.getdatabseName
            }).then(() => {
                resolve(new FullSyncDefaultResponse(true));
            }).catch((err) => {
                //this.c8o.log._error("Error loading the " + parameters["data"] + " database resource" + JSON.stringify(err, Object.getOwnPropertyNames(err)))
                reject(new C8oException("Bulk Load failed", err));
            })
        })
    }

    public handleInfoRequest(databaseName: string): Promise<FullSyncDefaultResponse> {
        const fullSyncDatabase: C8oFullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);
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

    public handleDestroyDatabaseRequest(databaseName: string): Promise<FullSyncDefaultResponse> {
        return new Promise((resolve, reject) => {
            const localDatabaseName = databaseName + this.localSuffix;
            this.getOrCreateFullSyncDatabase(databaseName).deleteDB().then((response) => {
                if (this.fullSyncDatabases[localDatabaseName] !== null) {
                    delete this.fullSyncDatabases[localDatabaseName];
                }
                resolve(new FullSyncDefaultResponse(response.ok));
            }).catch((err) => {
                reject(new C8oException(err.message, err));
            });
        });
    }

    public static mergeProperties(newProperties: Object, oldProperties: Object) {
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
    public getDocucmentFromDatabase(c8o: C8oCore, databaseName: string, documentId: string): Promise<any> {
        return new Promise((resolve, reject) => {
            let c8oFullSyncDatabase: C8oFullSyncDatabase;
            try {
                c8oFullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);
            } catch (err) {
                reject(new C8oException(C8oExceptionMessage.fullSyncGetOrCreateDatabase(databaseName)));
            }
            c8oFullSyncDatabase.getdatabase().get(documentId).then((result) => {
                resolve(result);
            });
        });
    }

    public overrideDocument(document: any, properties: Object, databaseName) {
        properties[C8oFullSync.FULL_SYNC__REV] = document._rev;
        let c8oFullSyncDatabase: C8oFullSyncDatabase;
        try {
            c8oFullSyncDatabase = this.getOrCreateFullSyncDatabase(databaseName);
        } catch (err) {
            throw new C8oException(C8oExceptionMessage.fullSyncGetOrCreateDatabase(databaseName));
        }

        c8oFullSyncDatabase.getdatabase().put(properties)
            .catch((err) => {
                throw new C8oException(err.message, err);
            });

    }

    public async getResponseFromLocalCache(c8oCallRequestIdentifier: string): Promise<any> {
        const fullSyncDatabase = this.getOrCreateFullSyncDatabase(C8oCore.LOCAL_CACHE_DATABASE_NAME);
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
                    resolve(new C8oUnavailableLocalCacheException(C8oExceptionMessage.localCacheDocumentJustCreated()));
                } else {
                    reject(err);
                }
            });
        });

    }

    public async saveResponseToLocalCache(c8oCallRequestIdentifier: string, localCacheResponse: C8oLocalCacheResponse): Promise<any> {
        const fullSyncDatabase: C8oFullSyncDatabase = this.getOrCreateFullSyncDatabase(C8oCore.LOCAL_CACHE_DATABASE_NAME);
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

    public addFullSyncChangeListener(db: string, listener: C8oFullSyncChangeListener) {
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
            const evtHandler = this.getOrCreateFullSyncDatabase(db).getdatabase
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

    public removeFullSyncChangeListener(db: string, listener: C8oFullSyncChangeListener) {
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
                this.getOrCreateFullSyncDatabase(db).getdatabase.cancel();
                this.cblChangeListeners[db].cancel();
                delete this.fullSyncChangeListeners[db];
                delete this.cblChangeListeners[db];
            }
        }
    }
}
