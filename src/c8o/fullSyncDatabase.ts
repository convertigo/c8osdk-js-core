import { C8oCore } from "./c8oCore";
import { C8oProgress } from "./c8oProgress";
import { C8oResponseListener, C8oResponseProgressListener } from "./c8oResponse";
import { FullSyncReplication } from "./fullSyncReplication";

import PouchDB from "pouchdb-browser";
import PouchDBFind from "pouchdb-find";
import PouchDBQuickSearch from "pouchdb-quick-search";

import {C8oLoad} from "./c8oload";
import { C8oUtilsCore } from "./c8oUtilsCore";

/**
 * Created by charlesg on 10/01/2017.
 */
export class C8oFullSyncDatabase {

    /**
     * Used to log.
     */
    private c8o: C8oCore;

    /** TAG Attributes **/

    /**
     * The fullSync database name.
     */
    private databaseName: string;
    private remotedatabaseName: string;
    private c8oFullSyncDatabaseUrl: string;
    /**
     * The fullSync Database instance.
     */
    private database = null;
    /**
     * Used to make pull replication (uploads changes from the local database to the remote one).
     */
    private pullFullSyncReplication: FullSyncReplication = new FullSyncReplication(true);
    /**
     * Used to make push replication (downloads changes from the remote database to the local one).
     */
    private pushFullSyncReplication: FullSyncReplication = new FullSyncReplication(false);
    /**
     * Used to make pull replication (uploads changes from the local database to the remote one).
     */
    private syncFullSyncReplication: FullSyncReplication = new FullSyncReplication();

    private remotePouchHeader;
    private _id;
    private to_cancel = [];

    /**
     * Creates a fullSync database with the specified name and its location.
     *
     * @param c8o
     * @param databaseName
     * @param fullSyncDatabases
     * @param localSuffix
     * @throws C8oException Failed to get the fullSync database.
     */
    constructor(c8o: C8oCore, databaseName: string, fullSyncDatabases: string, localSuffix: string, localPrefix: string) {
        PouchDB.plugin(PouchDBFind);
        PouchDB.plugin(PouchDBQuickSearch);
        let c8oload: C8oLoad = new C8oLoad(c8o);
        window["PouchDB"] =PouchDB;
        this.c8o = c8o;
        const header = {
            "x-convertigo-sdk": this.c8o.sdkVersion,
        };
        if(this.c8o.xsrfUsed){
            const headerName = "x-xsrf-token";
            const fetch = "Fetch";
            header[headerName] = window.localStorage.getItem(headerName) != undefined ? window.localStorage.getItem(headerName) : fetch;
        }      
        Object.assign(header, this.c8o.headers);
        this.remotePouchHeader = {
            fetch: (url, opts) => {
                opts.credentials = 'include';
                for (let key in header) {
                    opts.headers.set(key, header[key]);
                }
                var fecthPouch: Promise<Response> = PouchDB.fetch(url, opts);
                fecthPouch.then((response)=>{
                    this.c8o.session.sort(response,header, null, null, null) 
                })
                .catch((e)=>{
                    
                });
                return fecthPouch;
            }
        };
        this.c8oFullSyncDatabaseUrl = fullSyncDatabases + databaseName;
        this.remotedatabaseName = databaseName;
        this.databaseName = localPrefix + databaseName + localSuffix;
        try {
            if (c8o.couchUrl != null) {
                this.database = new PouchDB(c8o.couchUrl + "/" + this.databaseName);
                this.c8o.log._debug("PouchDb launched on couchbaselite");
            } else {
                PouchDB.plugin(c8oload.plugin);
                this.database = new PouchDB(this.databaseName);
                this.c8o.log._debug("PouchDb launched normally");
            }
        } catch (error) {
            throw error;
        }
    }

    public async remoteDatabaseVersion() {
        return new Promise((resolve)=>{
            let headersObject = { 'Accept': 'application/json', 'x-convertigo-sdk': this.c8o.sdkVersion };
            Object.assign(headersObject, this.c8o.headers);
            let headers =  this.c8o.httpInterface.getHeaders(headersObject);

            this.c8o.httpInterface.httpGetObservable(this.c8oFullSyncDatabaseUrl + "/_design/c8o", {
                headers: headers,
                withCredentials: true
            }, {})
            .subscribe(
                response => {
                    if (response != undefined && response["~c8oDbVersion"] != null) {
                        this.c8o.log._trace("Server support reset database, remote version for " + this.remotedatabaseName + " is " + response["~c8oDbVersion"]);
                        resolve(response["~c8oDbVersion"])
                    }
                    else {
                        resolve(false);
                    }
            },
            error => {
                this.c8o.log._trace("Server does not support reset database");
                resolve(false);
            })
        });
    }

    public async localDatabaseVersion() {
        try {
            let info = await this.database.info();
            let response = await this.database.get('_design/c8o')
            if (response["~c8oDbVersion"] != null) {
                this.c8o.log._trace("Version for local database,  " + this.databaseName + " is " + response["~c8oDbVersion"]);
                return response["~c8oDbVersion"];
            }
            else {
                return false;
            }
        }
        catch (error) {
            //there is no c8odesing base has been created in local
            return "_C8O_DO_NOTHING";
        }

    }

    public async checkResetBase() {
        let remoteVersion = await this.remoteDatabaseVersion();
        let localVersion = await this.localDatabaseVersion();
        let reset = false;
        if(localVersion == "_C8O_DO_NOTHING"){
            this.c8o.log._trace("Local database version do not contains, _design/c8o, it has been created in local, no reset needed");
        }
        else{
            if (remoteVersion != false) {
                if (localVersion != false) {
                    if (remoteVersion != localVersion) {
                        // reset
                        reset = true;
                    }
                }
                else{
                    reset = true;
                }
            }
            if (reset) {
                this.c8o.log._trace("Since remote database version is diffrent from local database, we will reset it");
                await this.resetMyBase()
            }
            else {
                this.c8o.log._trace("Remote database version and local database, had the same version, reset not needed");
            }
        }
        
    }

    async resetMyBase() {
        try {
            await this.database.destroy();
            if (this.c8o.couchUrl != null) {
                this.database = new PouchDB(this.c8o.couchUrl + "/" + this.databaseName);
                this.c8o.log._debug("PouchDb launched on couchbaselite");
            } else {
                let c8oload: C8oLoad = new C8oLoad(this.c8o);
                PouchDB.plugin(c8oload.plugin)
                this.database = new PouchDB(this.databaseName);
                this.c8o.log._debug("PouchDb launched normally");
            }
            this.c8o.log._debug("Database resetted sucessfully");
        } catch (error) {
            this.c8o.log._error("error resetting database");
        }

    }

    /**
     * Start pull and push replications.
     * @returns Promise<any>
     */
    public async startAllReplications(parameters: Object, c8oResponseListener: C8oResponseListener, handler: any, id = null, mutex = null): Promise<any> {
        if(this.c8o.resetBase){
            await this.checkResetBase()
        }
        let resp =  await this.c8o.log.logTest();
        return this.startSync(this.syncFullSyncReplication, parameters, c8oResponseListener, handler, id, mutex);
        
    }

    /**
     * Start pull replication.
     * @returns Promise<any>
     */
    public async startPullReplication(parameters: Object, c8oResponseListener: C8oResponseListener, handler: any, id = null, mutex = null): Promise<any> {
        if(this.c8o.resetBase){
            await this.checkResetBase()
        }
        let resp =  await this.c8o.log.logTest();
        return this.startReplication(this.pullFullSyncReplication, parameters, c8oResponseListener, handler, id, mutex);

    }

    /**
     * Start push replication.
     * @returns Promise<any>
     */
    public async startPushReplication(parameters: Object, c8oResponseListener: C8oResponseListener, handler: any, id = null, mutex = null): Promise<any> {
        if(this.c8o.resetBase){
            await this.checkResetBase()
        }
        let resp =  await this.c8o.log.logTest();
        return this.startReplication(this.pushFullSyncReplication, parameters, c8oResponseListener, handler, id, mutex);

    }

    private startSync(fullSyncReplication: FullSyncReplication, parameters: Object, c8oResponseListener: C8oResponseListener, handler, id = null, mutex = null): Promise<any> {
        let continuous: boolean = false;
        let cancel: boolean = false;
        const parametersObj: Object = {};
        //stop replication if exists
        if (fullSyncReplication.replication != null) {
            fullSyncReplication.replication.cancel();
        }
        this._id = id;
        //check continuous flag
        if (parameters["continuous"] != null) {
            if (parameters["continuous"] as boolean === true) {
                continuous = true;
            } else {
                continuous = false;
            }
        }
        //check cancel flag
        if (parameters["cancel"] != null) {
            //noinspection RedundantIfStatementJS
            if (parameters["cancel"] as boolean === true) {
                cancel = true;
            } else {
                cancel = false;
            }
        }
        // Set retry true by default...
        parametersObj["retry"] = true;

        //check parameters to throw to pouchDB
        if (parameters["retry"] != null) {
            parametersObj["retry"] = parameters["retry"];
        }
        if (parameters["filter"] != null) {
            parametersObj["filter"] = parameters["filter"];
        }
        if (parameters["doc_ids"] != null) {
            parametersObj["doc_ids"] = parameters["doc_ids"];
        }
        if (parameters["query_params"] != null) {
            parametersObj["query_params"] = parameters["query_params"];
        }
        if (parameters["view"] != null) {
            parametersObj["view"] = parameters["view"];
        }
        if (parameters["since"] != null) {
            parametersObj["since"] = parameters["since"];
        }
        if (parameters["heartbeat"] != null) {
            parametersObj["heartbeat"] = parameters["heartbeat"];
        }
        if (parameters["timeout"] != null) {
            parametersObj["timeout"] = parameters["timeout"];
        }
        if (parameters["batch_size"] != null) {
            parametersObj["batch_size"] = parameters["batch_size"];
        }
        if (parameters["batches_limit"] != null) {
            parametersObj["batches_limit"] = parameters["batches_limit"];
        }
        if (parameters["back_off_function"] != null) {
            parametersObj["back_off_function"] = parameters["back_off_function"];
        }
        if (parameters["checkpoint"] != null) {
            parametersObj["checkpoint"] = parameters["checkpoint"];
        }
        if (parameters["seq_interval"] != null) {
            parametersObj["seq_interval"] = parameters["seq_interval"];
        }

        const remoteDB = new PouchDB(this.c8oFullSyncDatabaseUrl, this.remotePouchHeader);
        let rep = fullSyncReplication.replication = this.database.sync(remoteDB, parametersObj);
        const param = parameters;
        const progress: C8oProgress = new C8oProgress();
        progress.raw = rep;
        progress.continuous = false;

        return new Promise((resolve, reject) => {
            rep.on("change", (info) => {
                progress.finished = false;
                if (info.direction === "pull") {
                    progress.pull = true;
                    progress.status = rep.pull.state;
                    progress.finished = rep.pull.state !== "active";
                } else if (info.direction === "push") {
                    progress.pull = false;
                    progress.status = rep.push.state;
                    progress.finished = rep.push.state !== "active";
                }
                progress.total = info.change.docs_read;
                progress.current = info.change.docs_written;
                param[C8oCore.ENGINE_PARAMETER_PROGRESS] = progress;
                (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, param);

            }).on("complete", (info) => {
                progress.finished = true;
                progress.pull = false;
                progress.total = info.push.docs_read;
                progress.current = info.push.docs_written;
                progress.status = info.status;
                progress.finished = true;
                param[C8oCore.ENGINE_PARAMETER_PROGRESS] = progress;
                (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, param);
                progress.pull = true;
                progress.total = info.pull.docs_read;
                progress.current = info.pull.docs_written;
                (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, param);
                if(rep.canceled == true && continuous){
                    this.c8o.log._trace("Replication is continuous but has been canceled");
                    rep.cancel();
                    if(mutex != undefined){
                        mutex.release();
                    }
                    handler();
                }
                else if (continuous) {
                    rep.cancel();
                    parametersObj["live"] = true;
                    rep = fullSyncReplication.replication = this.database.sync(remoteDB, parametersObj);
                    progress.continuous = true;
                    progress.raw = rep;
                    progress.taskInfo = "n/a";
                    progress.pull = true;
                    progress.status = "live";
                    progress.finished = false;
                    progress.pull = true;
                    progress.total = 0;
                    progress.current = 0;
                    (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, param);
                    progress.pull = false;
                    (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, param);

                    if(mutex != undefined){
                        mutex.release();
                    }
                    rep.on("change", (info) => {
                        progress.finished = false;
                        if (info.direction === "pull") {
                            progress.pull = true;
                            progress.status = rep.pull.state;
                        } else if (info.direction === "push") {
                            progress.pull = false;
                            progress.status = rep.push.state;
                        }
                        progress.total = info.change.docs_read;
                        progress.current = info.change.docs_written;
                        param[C8oCore.ENGINE_PARAMETER_PROGRESS] = progress;
                        (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, param);
                    })
                        .on("paused", () => {
                            try{
                                if(((<Array<any>>this.c8o.database["replications"]).map(x=>x.id == id)).length > 0){
                                    rep.cancel();
                                }
                            }
                            catch(e){
                                
                            }
                            
                            progress.finished = true;
                            (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, param);
                            if (progress.total === 0 && progress.current === 0) {
                                progress.pull = !progress.pull;
                                (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, param);
                            }
                        })
                        .on("error", (err) => {
                            if (err.message === "Unexpected end of JSON input") {
                                progress.finished = true;
                                progress.status = "live";
                                (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, parameters);
                            } else {
                                rep.cancel();
                                if (err.code === "ETIMEDOUT" && err.status === 0) {
                                    if (parameters["force_retry"] == true) {
                                        this.c8o.log._warn("Timeout handle during fullsync replication (fs://.sync) \n Forcing Restarting replication");
                                        this.database.sync(remoteDB, { timeout: 600000, retry: true });
                                    } else {
                                        this.c8o.log._warn("Timeout handle during fullsync replication (fs://.sync) \n Restarting automatically replication");
                                    }
                                } else if (err.name === "unknown" && err.status === 0 && err.message === "getCheckpoint rejected with ") {
                                    reject("NO_NETWORK");
                                } else {
                                    reject(err);
                                }
                            }
                        });

                }
                else if (!continuous) {
                    rep.cancel();
                    if(mutex != undefined){
                        mutex.release();
                    }
                    this.c8o.log._trace("Replication is finished, modifying its state");
                    handler();
                }
            }).on("error", (err) => {
                rep.cancel();
                if(mutex != undefined){
                    mutex.release();
                }
                if (err.message === "Unexpected end of JSON input") {
                    progress.finished = true;
                    progress.status = "Complete";
                    (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, parameters);
                    rep.cancel();

                } else if (err.code === "ETIMEDOUT" && err.status === 0) {
                    if (parameters["force_retry"] == true) {
                        this.c8o.log._warn("Timeout handle during fullsync replication (fs://.sync) \n Forcing Restarting replication");
                        this.database.sync(remoteDB, { timeout: 600000, retry: true });
                    } else {
                        this.c8o.log._warn("Timeout handle during fullsync replication (fs://.sync) \n Restarting automatically replication");
                    }
                } else if (err.name === "unknown" && err.status === 0 && err.message === "getCheckpoint rejected with ") {
                    reject("NO_NETWORK");
                } else {
                    reject(err);
                }
            });

            if (cancel) {
                if (rep != null) {
                    this.c8o.log._trace("Replication canceled called, modifying its state");
                    handler();
                    rep.cancel();
                    progress.finished = true;
                    if (c8oResponseListener != null && c8oResponseListener instanceof C8oResponseProgressListener) {
                        c8oResponseListener.onProgressResponse(progress, parameters);
                    }
                }
                if(mutex != undefined){
                    mutex.release();
                }
            }
        }).catch((error) => {
            throw error.toString();
        });
    }

    /**
     * Starts a replication taking into account parameters.<br/>
     * This action does not directly return something but setup a callback raised when the replication raises change events.
     *
     * @param fullSyncReplication
     * @param c8oResponseListener
     * @param parameters
     */
    private startReplication(fullSyncReplication: FullSyncReplication, parameters: Object, c8oResponseListener: C8oResponseListener, handler, id = null, mutex = null): Promise<any> {
        let continuous: boolean = false;
        let cancel: boolean = false;
        const parametersObj: Object = {};
        //stop replication if exists
        if (fullSyncReplication.replication != null) {
            fullSyncReplication.replication.cancel();
        }
        this._id = id;
        //check continuous flag
        if (parameters["continuous"] != null) {
            if (parameters["continuous"] as boolean == true) {
                continuous = true;
            } else {
                continuous = false;
            }
        }
        //check cancel flag
        if (parameters["cancel"] != null) {
            //noinspection RedundantIfStatementJS
            if (parameters["cancel"] as boolean == true) {
                cancel = true;
            } else {
                cancel = false;
            }
        }
        //check parameters to throw to pouchDB
        // Set retry true by default...
        parametersObj["retry"] = true;
        if (parameters["retry"] != null) {
            parametersObj["retry"] = parameters["retry"];
        }
        if (parameters["filter"] != null) {
            parametersObj["filter"] = parameters["filter"];
        }
        if (parameters["doc_ids"] != null) {
            parametersObj["doc_ids"] = parameters["doc_ids"];
        }
        if (parameters["query_params"] != null) {
            parametersObj["query_params"] = parameters["query_params"];
        }
        if (parameters["view"] != null) {
            parametersObj["view"] = parameters["view"];
        }
        if (parameters["since"] != null) {
            parametersObj["since"] = parameters["since"];
        }
        if (parameters["heartbeat"] != null) {
            parametersObj["heartbeat"] = parameters["heartbeat"];
        }
        if (parameters["timeout"] != null) {
            parametersObj["timeout"] = parameters["timeout"];
        }
        if (parameters["batch_size"] != null) {
            parametersObj["batch_size"] = parameters["batch_size"];
        }
        if (parameters["batches_limit"] != null) {
            parametersObj["batches_limit"] = parameters["batches_limit"];
        }
        if (parameters["back_off_function"] != null) {
            parametersObj["back_off_function"] = parameters["back_off_function"];
        }
        if (parameters["checkpoint"] != null) {
            parametersObj["checkpoint"] = parameters["checkpoint"];
        }
        if (parameters["seq_interval"] != null) {
            parametersObj["seq_interval"] = parameters["seq_interval"];
        }

        const remoteDB = new PouchDB(this.c8oFullSyncDatabaseUrl, this.remotePouchHeader);
        let rep = fullSyncReplication.replication = fullSyncReplication.pull ? this.database.replicate.from(remoteDB, parametersObj) : this.database.replicate.to(remoteDB, parametersObj);

        const progress: C8oProgress = new C8oProgress();
        progress.raw = rep;
        progress.pull = fullSyncReplication.pull;
        progress.continuous = false;
        return new Promise((resolve, reject) => {

            rep.on("change", (info) => {
                progress.total = info.docs_read;
                progress.current = info.docs_written;
                progress.status = "change";
                parameters[C8oCore.ENGINE_PARAMETER_PROGRESS] = progress;
                (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, parameters);
            }).on("complete", (info) => {
                progress.finished = true;
                progress.total = info.docs_read;
                progress.current = info.docs_written;
                progress.status = "complete";
                parameters[C8oCore.ENGINE_PARAMETER_PROGRESS] = progress;
                (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, parameters);
                if(rep.canceled == true && continuous){
                    this.c8o.log._trace("Replication is continuous but has been canceled");
                    rep.cancel();
                    if(mutex != undefined){
                        mutex.release();
                    }
                    handler();
                }
                if (continuous) {
                    rep.cancel();
                    if(mutex != undefined){
                        mutex.release();
                    }
                    parametersObj["live"] = true;
                    rep = fullSyncReplication.replication = fullSyncReplication.pull ? this.database.replicate.from(remoteDB, parametersObj) : this.database.replicate.to(remoteDB, parametersObj);
                    progress.continuous = true;
                    progress.raw = rep;
                    progress.taskInfo = "n/a";
                    rep.on("change", (info) => {
                        progress.finished = false;
                        progress.total = info.docs_read;
                        progress.current = info.docs_written;
                        progress.status = "change";
                        parameters[C8oCore.ENGINE_PARAMETER_PROGRESS] = progress;
                        (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, parameters);
                    })
                    .on("paused", () => {
                        try{
                            if(((<Array<any>>this.c8o.database["replications"]).map(x=>x.id == id)).length > 0){
                                rep.cancel();
                            }
                        }
                        catch(e){
                            
                        }
                    })
                    .on("error", (err) => {
                        if (err.message === "Unexpected end of JSON input") {
                            progress.finished = true;
                            progress.status = "live";
                            (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, parameters);

                        } else {
                            rep.cancel();
                            if (err.code === "ETIMEDOUT" && err.status === 0) {
                                reject("TIMEOUT");
                            } else if (err.name === "unknown" && err.status === 0 && err.message === "getCheckpoint rejected with ") {
                                reject("NO_NETWORK");
                            } else {
                                reject(err);
                            }
                        }
                    });
                }
                else if (!continuous) {
                    rep.cancel();
                    if(mutex != undefined){
                        mutex.release();
                    }
                    this.c8o.log._trace("Replication is finished, modifying its state");
                    handler();
                }
            }).on("error", (err) => {
                rep.cancel();
                if(mutex != undefined){
                    mutex.release();
                }
                if (err.message === "Unexpected end of JSON input") {
                    progress.finished = true;
                    progress.status = "complete";
                    parameters[C8oCore.ENGINE_PARAMETER_PROGRESS] = progress;
                    (c8oResponseListener as C8oResponseProgressListener).onProgressResponse(progress, parameters);
                    rep.cancel();
                } else if (err.code === "ETIMEDOUT" && err.status === 0) {
                    reject("TIMEOUT");
                } else if (err.name === "unknown" && err.status === 0 && err.message === "getCheckpoint rejected with ") {
                    reject("NO_NETWORK");
                } else {
                    reject(err);
                }
            });

            if (cancel) {
                if(mutex != undefined){
                    mutex.release();
                }
                if (rep != null) {
                    this.c8o.log._trace("Replication canceled called, modifying its state");
                    handler();
                    rep.cancel();
                    progress.finished = true;
                    if (c8oResponseListener != null && c8oResponseListener instanceof C8oResponseProgressListener) {
                        c8oResponseListener.onProgressResponse(progress, parameters);
                    }
                }
            }

        }).catch((error) => {
            throw error.toString();
        });

    }

    //noinspection JSUnusedGlobalSymbols
    public get getdatabseName(): string {
        return this.databaseName;
    }

    public get getdatabase(): any {
        return this.database;
    }

    public deleteDB(): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.database != null) {
                this.database.destroy().then((response) => {
                    this.database = null;
                    resolve(response);
                }).catch((error) => {
                    this.c8o.log._debug("Failed to close DB, will retry: ", error.message);
                    this.database.destroy().then((response) => {
                        this.database = null;
                        resolve(response);
                    }).catch((error) => {
                        this.c8o.log._debug("Failed to close DB, second attempt has failed ", error.message);
                        reject(error);
                    });
                });
            }
        });
    }

    /**
     * cancel Pull Replication
     */
    public cancelPullReplication(): void {
        if (this.pullFullSyncReplication.replication != undefined) {
            this.pullFullSyncReplication.replication.cancel();
        }
    }

    /**
     * cancel Push Replication
     */
    public cancelPushReplication(): void {
        if (this.pushFullSyncReplication.replication != undefined) {
            this.pushFullSyncReplication.replication.cancel();
        }
    }

    /**
     * cancel Sync Replication
     */
    public cancelSyncReplication(): void {
        if (this.syncFullSyncReplication.replication != undefined) {
            this.syncFullSyncReplication.replication.cancel();
        }
    }

    /**
     * return current pull replication state or false if replication does not exists
     */

}

export interface ReplicationState {
    listener: any;
    parameters: any;
    type: any;
    database: C8oFullSyncDatabase;
    stopped: Boolean
}
