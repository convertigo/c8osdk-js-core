import { C8oBase } from "./c8oBase";
import { C8oHttpInterfaceCore } from "./c8oHttpInterfaceCore";
import { C8oLogger } from "./c8oLogger";
import { C8oLogLevel } from "./c8oLogLevel";
import { C8oSettings } from "./c8oSettings";
import { C8oUtilsCore } from "./c8oUtilsCore";

import { C8oFullSync, C8oFullSyncCbl } from "./c8oFullSync";
import { C8oResponseJsonListener, C8oResponseListener } from "./c8oResponse";
import { C8oExceptionMessage } from "./Exception/c8oExceptionMessage";

import { C8oCallTask } from "./c8oCallTask";
import { C8oFullSyncChangeListener } from "./c8oFullSyncChangeListener";
import { C8oPromise } from "./c8oPromise";
import { C8oCouchBaseLiteException } from "./Exception/c8oCouchBaseLiteException";
import { C8oException } from "./Exception/c8oException";
import { C8oExceptionListener } from "./Exception/c8oExceptionListener";
import { Observable, Subject } from 'rxjs';
import {C8oManagerNetwork} from "./c8oManagerNetwork";
import {C8oManagerDatabase} from "./c8oManagerDatabase";
import {C8oManagerSession} from "./c8oManagerSession";

declare var require: any;
/**
 * Allows to send requests to a Convertigo Server (or Studio), these requests are called c8o calls.<br/>
 * C8o calls are done thanks to a HTTP request or a CouchbaseLite usage.<br/>
 * An instance of C8o is connected to only one Convertigo and can't change it.<br/>
 * To use it, you have to first initialize the C8o instance with the Convertigo endpoint, then use call methods with Convertigo variables as parameter.
 */

// @dynamic
export abstract class C8oCore extends C8oBase {
    // Log:
    // - VERBOSE (v): methods parameters,
    // - DEBUG (d): methods calls,
    // - INFO (i):
    // - WARN (w):
    // - ERROR (e):

    /*** Regular expression ***/

    /**
     * The regex used to handle the c8o requestable syntax ("&lt;project&gt;.&lt;sequence&gt;" or "&lt;project&gt;.&lt;connector&gt;.&lt;transaction&gt;")
     */
    protected static RE_REQUESTABLE = /^([^.]*)\.(?:([^.]+)|(?:([^.]+)\.([^.]+)))$/;

    /**
     * The regex used to get the part of the endpoint before '/projects/...'
     */
    protected static RE_ENDPOINT = /^(https?:\/\/([^:/]+)(:[0-9]+)?\/?.*?)\/projects\/([^\/]+)$/;

    /**
     *  Engine reserved parameters
     */
    public static ENGINE_PARAMETER_PROJECT: string = "__project";
    public static ENGINE_PARAMETER_SEQUENCE: string = "__sequence";
    public static ENGINE_PARAMETER_CONNECTOR: string = "__connector";
    public static ENGINE_PARAMETER_TRANSACTION: string = "__transaction";
    public static ENGINE_PARAMETER_ENCODED: string = "__encoded";
    public static ENGINE_PARAMETER_DEVICE_UUID: string = "__uuid";
    public static ENGINE_PARAMETER_PROGRESS: string = "__progress";
    public static ENGINE_PARAMETER_FROM_LIVE: string = "__fromLive";

    /**
     * FULLSYNC parameters
     */

    public static use_merge_prefix: string = "_use_merge";
    /**
     * Constant to use as a parameter for a Call of "fs://.post" and must be followed by a FS_POLICY_* constant.
     * <pre>{@code
     * c8o.callJson("fs://.post",
     *   C8o.FS_POLICY, C8o.FS_POLICY_MERGE,
     *   "docid", myid,
     *   "mykey", myvalue
     * ).sync();
     * }</pre>
     */
    public static FS_POLICY: string = "_use_policy";
    /**
     Use it with "fs://.post" and C8o.FS_POLICY.

     This is the default post policy that don't alter the document before the CouchbaseLite's insertion.
     */
    public static FS_POLICY_NONE: string = "none";
    /**
     Use it with "fs://.post" and C8o.FS_POLICY.

     This post policy remove the "_id" and "_rev" of the document before the CouchbaseLite's insertion.
     */
    public static FS_POLICY_CREATE: string = "create";
    /**
     Use it with "fs://.post" and C8o.FS_POLICY.

     This post policy inserts the document in CouchbaseLite even if a document with the same "_id" already exists.
     */
    public static FS_POLICY_OVERRIDE: string = "override";
    /**
     Use it with "fs://.post" and C8o.FS_POLICY.

     This post policy merge the document with an existing document with the same "_id" before the CouchbaseLite's insertion.
     */
    public static FS_POLICY_MERGE: string = "merge";
    /**
     Use it with "fs://.post". Default value is ".".

     This key allow to override the sub key separator in case of document depth modification.
     */
    public static FS_SUBKEY_SEPARATOR: string = "_use_subkey_separator";
    /**
     Use it with "project.sequence". Default value is ".".

     This key allow to disable autologin feature for a given callJson
     */
    public static SEQ_AUTO_LOGIN_OFF: string = "__disableAutologin";

    /**
     * Use it with "fs://" request as parameter to enable the live request feature.<br/>
     * Must be followed by a string parameter, the 'liveid' that can be use to cancel the live
     * request using c8o.cancelLive(liveid) method.<br/>
     * A live request automatically recall the then or thenUI handler when the database changed.
     */
    public static FS_LIVE: string = "__live";

    /** Local cache keys **/
    public static LOCAL_CACHE_DOCUMENT_KEY_RESPONSE: string = "response";
    public static LOCAL_CACHE_DOCUMENT_KEY_RESPONSE_TYPE: string = "responseType";
    public static LOCAL_CACHE_DOCUMENT_KEY_EXPIRATION_DATE: string = "expirationDate";

    public static LOCAL_CACHE_DATABASE_NAME: string = "c8olocalcache";

    /** Response type **/
    public static RESPONSE_TYPE_XML: string = "pxml";
    public static RESPONSE_TYPE_JSON: string = "json";

    /* Static configuration */
    private static deviceUUID: string;

    /** Network **/

    /**
     * The Convertigo endpoint, syntax: &lt;protocol&gt;://&lt;host&gt;:&lt;port&gt;/&lt;Convertigo web app path&gt;/projects/&lt;project name&gt; (Example: http://127.0.0.1:18080/convertigo/projects/MyProject)
     */
    protected _endpoint: string;
    protected _endpointConvertigo: string;
    protected _endpointIsSecure: boolean;
    protected _endpointHost: string;
    protected _endpointPort: string;
    protected _endpointProject: string;
    protected _automaticRemoveSplashsCreen: boolean = true;

    /**
     * Used to run HTTP requests.
     */
    public httpInterface: C8oHttpInterfaceCore;

    /**
     * Allows to log locally and remotely to the Convertigo server.
     */
    public c8oLogger: C8oLogger;

    /**
     * Used to run fullSync requests.
     */
    public c8oFullSync: C8oFullSync;

    public lives: C8oCallTask[] = [];
    public livesDb: string[] = [];

    public subscriber_session: Subject<any>;
    public subscriber_network: Subject<any>;
    public subscriber_login: Subject<any>;

    private _reply = new Subject<any>();

    protected data: any;
    protected _http: any;
    protected _couchUrl: string = null;
    protected promiseConstructor: Promise<any>;
    protected promiseInit: Promise<any>;
    public promiseFinInit: Promise<any>;
    protected promiseReachable: Promise<any>;
    private promiseManagerNetwork: Promise<any>;
    protected replicationsToRestart : Array<any>;
    private _waitingForInit;
    public reachable;

    public network: C8oManagerNetwork;
    public database: C8oManagerDatabase;
    public session: C8oManagerSession;

    public get couchUrl(): string {
        return this._couchUrl;
    }

    public set couchUrl(value: string) {
        this._couchUrl = value;
    }

    public get logC8o(): boolean {
        return this._logC8o;
    }

    public set logC8o(value: boolean) {
        this._logC8o = value;
    }

    public get logRemote(): boolean {
        return this._logRemote;
    }

    public set logRemote(value: boolean) {
        this._initalLogLevel = value;
        this._logRemote = value;
    }

    public get logLevelLocal(): C8oLogLevel {
        return this._logLevelLocal;
    }

    public set logLevelLocal(value: C8oLogLevel) {
        this._logLevelLocal = value;
    }

    public get log(): C8oLogger {
        return this.c8oLogger;
    }

    public toString(): string {
        return "C8o[" + this._endpoint + "]";
    }

    public get endpoint(): string {
        return this._endpoint;
    }

    public set endpoint(value: string) {
        this._endpoint = value;
    }

    public get endpointConvertigo(): string {
        return this._endpointConvertigo;
    }

    public set endpointConvertigo(value: string) {
        this._endpointConvertigo = value;
    }

    //noinspection JSUnusedGlobalSymbols
    public get endpointIsSecure(): boolean {
        return this._endpointIsSecure;
    }

    public set endpointIsSecure(value: boolean) {
        this._endpointIsSecure = value;
    }

    //noinspection JSUnusedGlobalSymbols
    public get endpointHost(): string {
        return this._endpointHost;
    }

    public set endpointHost(value: string) {
        this._endpointHost = value;
    }

    //noinspection JSUnusedGlobalSymbols
    public get endpointPort(): string {
        return this._endpointPort;
    }

    public set endpointPort(value: string) {
        this._endpointPort = value;
    }

    public get endpointProject(): string {
        return this._endpointProject;
    }

    public set endpointProject(value: string) {
        this._endpointProject = value;
    }

    public get deviceUUID(): Promise<string> {
        
            return new Promise((resolve)=>{
                if(window["cordova"]!=undefined){
                    document.addEventListener("deviceready", ()=>{
                        if(C8oCore.deviceUUID == undefined){
                            C8oCore.deviceUUID = C8oUtilsCore.getNewGUIDString();
                        }
                        resolve(C8oCore.deviceUUID);
                    }, false);
                }
                else{
                    if(C8oCore.deviceUUID == undefined){
                        C8oCore.deviceUUID = C8oUtilsCore.getNewGUIDString();
                    }
                    resolve(C8oCore.deviceUUID);
                }
        
        
        
            
        })
        
    }

    public get httpPublic(): any {
        return this._http;
    }

    public get resetBase(): boolean {
        return this._resetBase;
    }

    public set resetBase(resetBase: boolean) {
        this._resetBase = resetBase;
    }

    public get prefixBase(): boolean {
        return this._prefixBase;
    }

    public set prefixBase(resetBase: boolean) {
        this._prefixBase = resetBase;
    }

    

    public abstract get sdkVersion(): string;

    public get coreVersion(): string {
        return "1.0.7";//require("../../package.json").version;
    }

    public xsrfUsed = false;

    /**
     * This is the base object representing a Convertigo Server end point. This object should be instantiated
     * when the apps starts and be accessible from any class of the app. Although this is not common , you may have
     * several C8o objects instantiated in your app.
     *
     * @param http
     *
     * @throws C8oException In case of invalid parameter or initialization failure.
     */
    constructor() {
        super();
        this.data = null;
        this.c8oLogger = new C8oLogger(this, true);
        this.subscriber_session = new Subject<any>();
        this.subscriber_network = new Subject<any>();
        this.subscriber_login = new Subject<any>();
        this.network = new C8oManagerNetwork(this);
        this.database= new C8oManagerDatabase(this);
        this.session = new C8oManagerSession(this);
        this.promiseManagerNetwork = this.network.init();
    }

    public importLoginState(c8o: C8oCore){
        let session = c8o.session;
        this.session = session;
    }

    protected extractendpoint() {
        if (!C8oUtilsCore.isValidUrl(this.endpoint)) {
            throw new C8oException(C8oExceptionMessage.illegalArgumentInvalidURL(this.endpoint).toString());
        }
        const matches = C8oCore.RE_ENDPOINT.exec(this.endpoint.toString());
        if (matches === null) {
            throw new C8oException(C8oExceptionMessage.illegalArgumentInvalidEndpoint(this.endpoint.toString()));
        }
        this.endpointConvertigo = matches[0].substring(0, (matches[0].indexOf("/projects")));
        this.endpointIsSecure = matches[1] != null;
        this.endpointHost = matches[2];
        this.endpointPort = matches[3];
        this.endpointProject = matches[4];
    }


    /**
     * Makes a c8o call with c8o requestable out of parameters.<br/>
     * To not use a C8oExceptionListener you can set the parameter to null
     *
     * @param requestable - Contains the Convertigo Sequence or Transaction targeted  (Syntax: "<project>.<sequence>" or "<project>.<connector>.<transaction>")
     * @param parameters - Contains c8o variables
     * @param c8oResponseListener - Define the behavior with the c8o call response
     * @param c8oExceptionListener - Define the behavior when there is an exception during execution
     */
    public call(requestable: string, parameters: Object = null, c8oResponseListener: C8oResponseListener = null, c8oExceptionListener: C8oExceptionListener = null) {
        try {
            if (requestable === null || requestable === undefined) {
                //noinspection ExceptionCaughtLocallyJS
                throw new C8oException(C8oExceptionMessage.illegalArgumentNullParameter("resquestable"));
            }
            if (parameters === null || parameters === undefined) {
                parameters = {};
            } else {
                if (this._normalizeParameters == true) {
                    try {
                        parameters = (JSON.parse(JSON.stringify(parameters)));
                    }
                    catch (error) {
                        this.log.debug("[C8o] can't normalize parameters due to cyclic error. We will use parameters non normalized");
                    }

                }
            }
            const regex = C8oCore.RE_REQUESTABLE.exec(requestable);
            if (regex === null || regex === undefined) {
                //noinspection ExceptionCaughtLocallyJS
                throw new C8oException(C8oExceptionMessage.InvalidArgumentInvalidEndpoint(this._endpoint));
            }
            if (regex[1] !== "") {
                parameters[C8oCore.ENGINE_PARAMETER_PROJECT.toString()] = regex[1];
            }
            if (regex[2] != null) {
                parameters[C8oCore.ENGINE_PARAMETER_SEQUENCE.toString()] = regex[2];
            } else {
                parameters[C8oCore.ENGINE_PARAMETER_CONNECTOR.toString()] = regex[3];
                parameters[C8oCore.ENGINE_PARAMETER_TRANSACTION.toString()] = regex[4];
            }
            return this._call(parameters, c8oResponseListener, c8oExceptionListener);
        } catch (error) {
            this.handleCallException(c8oExceptionListener, parameters, error);
        } finally {
        }
    }

    /**
     * Makes a c8o call with c8o requestable in parameters ('__project' and ('__sequence' or ('__connector' and '__transaction'))).<br/>
     * To not use a C8oExceptionListener you can set the parameter to null.
     *
     * @param parameters - Contains c8o variables
     * @param c8oResponseListener - Define the behavior with the c8o call response
     * @param c8oExceptionListener - Define the behavior when there is an exception during execution
     */
    public _call(parameters: Object = null, c8oResponseListener: C8oResponseListener = null, c8oExceptionListener: C8oExceptionListener = null) {
        // IMPORTANT: all c8o calls have to end here !
        Promise.all([this.promiseFinInit, this.promiseManagerNetwork]).then(() => {
            try {
                this.c8oLogger.logMethodCall("call", parameters, c8oResponseListener, c8oExceptionListener);
                if (parameters == null) {
                    parameters = {};
                } else {
                    if (this._normalizeParameters == true) {
                        try {
                            parameters = (JSON.parse(JSON.stringify(parameters)));
                        }
                        catch (error) {
                            this.log.debug("[C8o] can't normalize parameters due to cyclic error. We will use parameters non normalized");
                        }
                    }
                }
                const task: C8oCallTask = new C8oCallTask(this, parameters, c8oResponseListener, c8oExceptionListener);
                task.run();
            } catch (error) {
                this.handleCallException(c8oExceptionListener, parameters, error);
            } finally {

            }
        });

    }

    /**
     * Makes a c8o call with c8o requestable out of parameters, expecting a JSON response through a C8oPromise.<br/>
     * The C8oPromise allow to register response handler with .then and .thenUI,
     * error handler with .fail and failUI,
     * replication handler with .progress
     * and synchronous response with .sync().
     *
     * @param requestable - Contains the Convertigo Sequence or Transaction targeted  (Syntax: "<project>.<sequence>" or "<project>.<connector>.<transaction>")
     * @param parameters: Object - Contains c8o variables as key/value pair in the Map
     * @return A C8oPromise that can deliver the JSON response
     */
    public callJsonObject(requestable: string, parameters: Object): C8oPromise<JSON> {
        this.removeNull(parameters)
        const promise: C8oPromise<JSON> = new C8oPromise<JSON>(this);
        this.call(requestable, parameters, new C8oResponseJsonListener((response: any, requestParameters: Object) => {
            if (requestParameters == null) {
                requestParameters = {};
            }
            if (response == null && requestParameters[C8oCore.ENGINE_PARAMETER_PROGRESS]) {
                promise.onProgress(requestParameters[C8oCore.ENGINE_PARAMETER_PROGRESS]);
            } else {
                promise.onResponse(response, requestParameters);
            }
        }),
            new C8oExceptionListener((exception: C8oException, data: Object) => {
                promise.onFailure(exception, data);
            }));
        return promise;
    }

    /**
     * Makes a c8o call with c8o requestable out of parameters, expecting a JSON response through a C8oPromise.<br/>
     * The C8oPromise allow to register response handler with .then and .thenUI,
     * error handler with .fail and failUI,
     * replication handler with .progress
     * and synchronous response with .sync().
     *
     * @param requestable - Contains the Convertigo Sequence or Transaction targeted  (Syntax: "<project>.<sequence>" or "<project>.<connector>.<transaction>")
     * @param parameters - Contains c8o variables as key/value
     * @return A C8oPromise that can deliver the JSON response
     */
    public callJson(requestable: string, ...parameters: any[]): C8oPromise<JSON> {
        return this.callJsonObject(requestable, C8oCore.toParameters(parameters));
    }

    /**
     * Transforms siblings values as key/value of a Map.
     *
     * @param parameters pair of values to transform a object
     * @return a Map that contains all parameters
     */
    public static toParameters(parameters: any): Object {
        const newParameters: Object = {};
        if (0 !== parameters.length % 2) {
            throw new C8oException("Incorrect number of parameters");
        }
        for (let i = 0; i < parameters.length; i += 2) {
            newParameters[parameters[i]] = parameters[i + 1];
        }
        return newParameters;
    }
    /**
     * Remove null value from parameters
     *
     * @param parameters an object
     * @return a Map that contains all parameters
     */
    public removeNull(parameters: any){
        for(let val in parameters){
            if(parameters[val]== null){
                delete parameters[val];
                this.log._trace("remove parameters "+ val+ " since its value is null or undefined");
            }
        }
    }

    /**
     * Calls the exception listener callback if it is not null, else prints the exception stack trace.
     *
     * @param c8oExceptionListener
     * @param requestParameters
     * @param exception
     */
    public handleCallException(c8oExceptionListener: C8oExceptionListener, requestParameters: Object, exception: Error) {
        this.c8oLogger.warn("Handle a call exception", exception);
        if (c8oExceptionListener != null) {
            c8oExceptionListener.onException(exception, requestParameters);
        }
    }

    /**
     * Return an subject that call next if session has been lost
     */
    public handleSessionLost(): Subject<any> {
        this.subscriber_session.subscribe((res)=>{
            this.c8oLogger.debug("[C8o][handleSessionLost] Handle a session lost");

/*            (this.c8oFullSync as C8oFullSyncCbl).canceled = false;
            (this.c8oFullSync as C8oFullSyncCbl).cancelActiveReplications();
  */
           
        });
        return this.subscriber_session;
    }

    /**
     * Return an subject that call next if network has change
     */
    public handleNetworkEvents(): Subject<any> {
        return this.subscriber_network;
    }

    /**
     * Return an subject that call next if autologin is triggered with its result
     */
    public handleAutoLoginResponse(): Subject<any> {
        return this.subscriber_login;
    }

    /**
     * get an attachment for a given object
     *
     * @param id: string
     * @param attachment_name: string
     *
     * @returns a promise containing a buffer
     */
    public async get_attachment(id: string, attachment_name: string, database_name?: string): Promise<any> {
        return new Promise(async (resolve, reject) => {
            if (database_name == null) {
                database_name = this.defaultDatabaseName;
            }
            if ((this.c8oFullSync as C8oFullSyncCbl) != undefined) {
                const fullsyncdb = await (this.c8oFullSync as C8oFullSyncCbl).getOrCreateFullSyncDatabase(database_name);
                fullsyncdb.getdatabase.getAttachment(id, attachment_name).then((buffer) => {
                    resolve(buffer);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Add a listener to monitor all changes of the 'db'.
     *
     * @param db the name of the fullsync database to monitor. Use the default database for a blank or a null value.
     * @param listener the listener to trigger on change.
     */
    public addFullSyncChangeListener(db: string, listener: C8oFullSyncChangeListener) {
        (this.c8oFullSync as C8oFullSyncCbl).addFullSyncChangeListener(db, listener);
    }

    /**
     * Remove a listener for changes of the 'db'.
     *
     * @param db the name of the fullsync database to monitor. Use the default database for a blank or a null value.
     * @param listener the listener instance to remove.
     */
    public removeFullSyncChangeListener(db: string, listener: C8oFullSyncChangeListener) {
        (this.c8oFullSync as C8oFullSyncCbl).removeFullSyncChangeListener(db, listener);
    }

    public addLive(liveid: string, db: string, task: C8oCallTask) {
        this.cancelLive(liveid);
        this.lives[liveid] = task;
        this.livesDb[liveid] = db;
        this.addFullSyncChangeListener(db, this.handleFullSyncLive);
    }

    public cancelLive(liveid: string) {
        if (this.livesDb[liveid] !== undefined) {
            let db: string = this.livesDb[liveid];
            delete this.livesDb[liveid];
            if (this.livesDb[db] !== undefined) {
                db = null;
            }
            if (db !== null) {
                this.removeFullSyncChangeListener(db, this.handleFullSyncLive);
            }
        }
        delete this.lives[liveid];
    }

    //noinspection JSUnusedLocalSymbols
    protected handleFullSyncLive: C8oFullSyncChangeListener = new C8oFullSyncChangeListener(
        (changes: Object) => {
            for (const task in this.lives) {
                (this.lives[task] as C8oCallTask).executeFromLive();
            }
    });
    
    /**
     * Method to bastract http get
     * @param uri the uri for given request
     */
    public abstract httpGetObservable(uri): Observable<any>;

     /**
     * Init http interface in client sdk
     */
    abstract initC8oHttInterface(): void;

    /**
     * This is the base object representing a Convertigo Server end point. This object should be instantiated
     * when the apps starts and be accessible from any class of the app. Although this is not common , you may have
     * several C8o objects instantiated in your app.
     *
     * @param c8oSettings Initialization options.<br/>
     *                    Example: new C8oSettings().setLogRemote(false).setDefaultDatabaseName("sample")
     *
     * @throws C8oException In case of invalid parameter or initialization failure.
     */
    public init(c8oSettings?: C8oSettings): Promise<any> {
        let nullableEndpoint = true;
        if (c8oSettings !== undefined) {
            if (c8oSettings.endpoint != null) {
                nullableEndpoint = false;
            }
        }
        if (nullableEndpoint) {
            this.promiseConstructor = new Promise((resolve) => {
                // if project is running into web browser served by convertigo
                // get the url from window.location
                if (window.location.href.startsWith("http") && window.location.href.indexOf("/DisplayObjects") != -1) {
                    let n = window.location.href.indexOf("/DisplayObjects");
                    this.endpoint = window.location.href.substring(0, n);
                    resolve();
                }
                // else if project is running on device or serve by ionic serve
                // get the uri from env.json
                else {
                    let uri ="";
                    if(window.location.href.startsWith("file://")){
                        uri = (window.location.href.substring(0, window.location.href.indexOf("/index.html"))) + "/env.json"
                    }
                    else{
                        uri = window.location.origin + "/env.json";
                    }
                    this.httpGetObservable(uri)
                        .subscribe(
                            data => {
                                this.data = data;
                                //noinspection TypeScriptUnresolvedVariable
                                let remoteBase = data["remoteBase"].toString();
                                let n = remoteBase.indexOf("/_private");
                                this.endpoint = remoteBase.substring(0, n);
                                this._automaticRemoveSplashsCreen = data["splashScreenRemoveMode"] !== "manual";
                                resolve();
                            },
                            error=>{
                                alert("Missing env.json file");
                                let errMsg: string;
                                if (error instanceof Error) {
                                    errMsg = error.message;
                                } else {
                                    errMsg = `${error.status} - ${error.statusText || ""} ${error}`;
                                }
                                return Observable.throw(errMsg);
                            }
                        );
                }
            }).then(() => {
                this.extractendpoint();
            });
        }
        else {
            this.promiseConstructor = new Promise((resolve) => {
                this.endpoint = c8oSettings.endpoint;
                this.extractendpoint();
                resolve();
            });
        }

        this.promiseInit = Promise.all([this.promiseConstructor]).then(() => {
            return new Promise((resolve) => {
                this.copy(c8oSettings);
                this.initC8oHttInterface();
                this.session.getInitalState()
                this.c8oLogger.affect_val(this, false);
                this.c8oLogger.logRemoteInit()
                .then(()=>{
                    //Listen for offline status
                    //this.listenOffline();
                    //Listen for online status
                    //this.listenOnLine();
                    this.c8oLogger.logMethodCall("C8o Constructor");
                    this.c8oFullSync = new C8oFullSyncCbl(this);
                    resolve();
                })
                
            });
        });
        return this.promiseInit;
    }

    /**
     * This should be called OnPlatform Ready to remove splashscreen if necessary
     *
     */
    public finalizeInit(): Promise<any>{
        if(this.promiseFinInit != null){
            return this.promiseFinInit;
        }
        else{
            this.promiseFinInit = new Promise((resolve)=>{
                Promise.all([this.promiseInit]).then(() => {
                    /**
                     * Looking for splashScreen timeOut
                     */
                    if (this._automaticRemoveSplashsCreen) {
                        if (navigator["splashscreen"] !== undefined) {
                            navigator["splashscreen"].hide();
                        }
                    }
                    /**
                     * Looking for wkWebView
                     */
                    if (window["wkWebView"] != undefined) {
                        window["wkWebView"].injectCookie(this.endpointConvertigo)
                        this.log.debug("[C8O] wkWebView detected: We will inject Cookie for endpoint: "+ this.endpointConvertigo);
                    }
                    /**
                     * Looking for cblite
                     */
                    if (window["cblite"] != undefined) {
                        window["cblite"].getURL((err, url) => {
                            if (err) {
                                //this.checkReachable()
                                resolve();
                            }
                            else{
                                url = url.replace(new RegExp("/$"), "");
                                this.couchUrl = url;
                                //this.checkReachable()
                                resolve();
                            }
                        });
                    }
                    else {
                        //this.checkReachable()
                        resolve();
                    }
                });
            });
            return this.promiseFinInit;
        }
    }


}

// @dynamic
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
        return new Promise((resolve, reject) => {
            try {
                delete newProperties[C8oFullSync.FULL_SYNC__ID];
                delete newProperties[C8oFullSync.FULL_SYNC__REV];
                database.post(newProperties).then((createdDocument) => {
                    resolve(createdDocument);
                });
            } catch (error) {
                reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
            }
        });
    });

    public static OVERRIDE: FullSyncPolicy = new FullSyncPolicy(C8oCore.FS_POLICY_OVERRIDE, (database: any, newProperties: Object) => {
        return new Promise((resolve, reject) => {
            try {
                const documentId: string = C8oUtilsCore.getParameterStringValue(newProperties, C8oFullSync.FULL_SYNC__ID, false);
                delete newProperties[C8oFullSync.FULL_SYNC__ID];
                delete newProperties[C8oFullSync.FULL_SYNC__REV];
                if (documentId == null) {
                    database.post(newProperties).then((createdDocument) => {
                        resolve(createdDocument);
                    });
                } else {
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
                        } else {
                            reject(error);
                        }
                    },
                    ).then((createdDocument) => {
                        resolve(createdDocument);
                    });
                }
            } catch (error) {
                reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
            }
        });
    });

    public static MERGE: FullSyncPolicy = new FullSyncPolicy(C8oCore.FS_POLICY_MERGE, (database: any, newProperties: Object, subPolicy = null) => {
        return new Promise((resolve, reject) => {
            try {
                const documentId: string = C8oUtilsCore.getParameterStringValue(newProperties, C8oFullSync.FULL_SYNC__ID, false);
                // delete newProperties[C8oFullSync.FULL_SYNC__ID];
                delete newProperties[C8oFullSync.FULL_SYNC__REV];
                // copy newProperties object to be able to apply subPolicy merge
                let copyNewProperties = C8oFullSyncCbl.deepCloneObject(newProperties);
                if (documentId == null) {
                    // Apply subPolicy for merge (here can only be delete since, there is no previous doc)
                    C8oFullSyncCbl.applySubPolicyForMerge(false, copyNewProperties, newProperties , subPolicy);
                    // Put document
                    database.put(newProperties)
                        .then((createdDocument) => {
                            resolve(createdDocument);
                        }).catch((error) => {
                            reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
                        });

                } else {
                    database.get(documentId)
                        .then((doc) => {
                            // Apply Policy merge
                            C8oFullSyncCbl.mergeProperties(newProperties, doc);
                            // Apply subPolicy for merge
                            C8oFullSyncCbl.applySubPolicyForMerge(true, copyNewProperties, newProperties , subPolicy);
                            // Put document
                            database.put(newProperties)
                                .then((createdDocument) => {
                                    resolve(createdDocument);
                                })
                                .catch((error) => {
                                    reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
                                });

                        }).catch((error) => {
                            if (error.status === 404) {
                                // Apply subPolicy for merge (here can only be delete since, there is no previous doc)
                                C8oFullSyncCbl.applySubPolicyForMerge(false, copyNewProperties, newProperties , subPolicy);
                                // Put document
                                database.put(newProperties)
                                    .then((createdDocument) => {
                                        resolve(createdDocument);
                                    })
                                    .catch((error) => {
                                        reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
                                    });
                            } else {
                                reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
                            }
                        });
                }
            } catch (error) {
                reject(new C8oCouchBaseLiteException(C8oExceptionMessage.fullSyncPutProperties(newProperties), error));
            }
        });
    });

    public value: string;
    public action: (PouchDB, Object, subPolicy?) => any;

    constructor(value: string, action: (_Object, Object) => any) {
        this.value = value;
        this.action = action;
        
    }

    public static values(): FullSyncPolicy[] {
        return [this.NONE, this.CREATE, this.OVERRIDE, this.MERGE];
    }

    public static getFullSyncPolicy(value: string): FullSyncPolicy {
        if (value != null) {
            const fullSyncPolicyValues: FullSyncPolicy[] = FullSyncPolicy.values();
            for (const fullSyncPolicy of fullSyncPolicyValues) {
                if (fullSyncPolicy.value === value) {
                    return fullSyncPolicy as FullSyncPolicy;
                }
            }
        }
        return this.NONE;
    }
}

export class FullSyncPostDocumentParameter {
    public static POLICY: FullSyncPostDocumentParameter = new FullSyncPostDocumentParameter(C8oCore.FS_POLICY);
    public static SUBKEY_SEPARATOR: FullSyncPostDocumentParameter = new FullSyncPostDocumentParameter(C8oCore.FS_SUBKEY_SEPARATOR);

    public name: string;

    constructor(name: string) {
        this.name = name;
    }

    public static values(): FullSyncPostDocumentParameter[] {
        const array: FullSyncPostDocumentParameter[] = [];
        array.push(this.POLICY, this.SUBKEY_SEPARATOR);
        return array;
    }

}
