import {C8oCore} from "./c8oCore";
import {C8oFullSync, C8oFullSyncCbl} from "./c8oFullSync";
import {C8oLocalCache} from "./c8oLocalCache";
import {C8oLocalCacheResponse} from "./c8oLocalCacheResponse";
import {C8oResponseJsonListener, C8oResponseListener} from "./c8oResponse";
import {C8oTranslator} from "./c8oTranslator";
import {C8oUtilsCore} from "./c8oUtilsCore";
import {C8oException} from "./Exception/c8oException";
import {C8oExceptionListener} from "./Exception/c8oExceptionListener";
import {C8oExceptionMessage} from "./Exception/c8oExceptionMessage";
import {C8oHttpRequestException} from "./Exception/c8oHttpRequestException";
import {C8oUnavailableLocalCacheException} from "./Exception/c8oUnavailableLocalCacheException";
import {sha256} from "js-sha256";

export class C8oCallTask {
    private c8o: C8oCore;
    private _parameters: Object;
    private c8oResponseListener: C8oResponseListener;
    private c8oExceptionListener: C8oExceptionListener;
    private c8oCallUrl: string;
    private _sha: string;

    public get parameters() {
        return this._parameters;
    }

    public set parameters(value: any) {
        this._parameters = value;
    }

    constructor(c8o: C8oCore, parameters: Object, c8oResponseListener: C8oResponseListener, c8oExceptionListener: C8oExceptionListener) {
        this.c8o = c8o;
        this.parameters = parameters;
        this.c8oResponseListener = c8oResponseListener;
        this.c8oExceptionListener = c8oExceptionListener;

        c8o.log.logMethodCall("C8oCallTask", parameters, c8oResponseListener, c8oExceptionListener);
    }

    // called execute() in others SDK...
    public run(fromLive = false) {
        try {
            this.handleRequest().then((response) => {
                try{
                    // if run has been triggered from live, check that response changed before calling handle response
                    if(fromLive){
                        let newHash = sha256(JSON.stringify(response.rows));
                        if(this._sha == undefined || this._sha != newHash){
                            this._sha = newHash;
                            this.handleResponse(response);
                        }
                    }
                    else{
                        this.handleResponse(response);
                    }
                }
                catch(e){
                    this.handleResponse(response);
                }
            }).catch((error) => {
                this.c8oExceptionListener.onException(error, this.parameters);
            });
        } catch (error) {
            this.c8oExceptionListener.onException(error, this.parameters);
        }
    }

    public executeFromLive() {
        delete this.parameters[C8oCore.FS_LIVE];
        this.parameters[C8oCore.ENGINE_PARAMETER_FROM_LIVE] = true;
        this.run(true);
    }

    public async handleRequest(): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const isFullSyncRequest: boolean = C8oFullSync.isFullSyncRequest(this.parameters);
                if (isFullSyncRequest) {
                    this.c8o.log._trace("Is FullSync request");

                    // FS_LIVE
                    const liveid = C8oUtilsCore.getParameterStringValue(this.parameters, C8oCore.FS_LIVE, false);
                    if (liveid !== null) {
                        const dbName: string = (C8oUtilsCore.getParameterStringValue(this.parameters, C8oCore.ENGINE_PARAMETER_PROJECT, true) as string).substring(C8oFullSync.FULL_SYNC_PROJECT.length);
                        this.c8o.addLive(liveid, dbName, this);
                    }
                    await this.c8o.c8oFullSync.handleFullSyncRequest(this.parameters, this.c8oResponseListener)
                        .then(
                            (result) => {
                                resolve(result);
                            })
                        .catch(
                            (error) => {
                                if (error instanceof C8oException) {
                                    reject(error);
                                } else {
                                    reject(new C8oException(C8oExceptionMessage.handleFullSyncRequest(), error));
                                }
                            });
                } else {
                    let responseType: string = "";
                    if (this.c8oResponseListener instanceof C8oResponseJsonListener) {
                        responseType = C8oCore.RESPONSE_TYPE_JSON;
                    } else {
                        // Return an Exception because the C8oListener used is unknown
                        reject(new C8oException(C8oExceptionMessage.wrongListener(this.c8oResponseListener)));
                    }
                    let c8oCallRequestIdentifier: string = null;
                    const localCache: C8oLocalCache = C8oUtilsCore.getParameterObjectValue(this.parameters, C8oLocalCache.PARAM, false);
                    let localCacheEnabled: boolean = false;

                    if (localCache != null) {
                        if (localCacheEnabled !== undefined) {
                            delete this.parameters[C8oLocalCache.PARAM];
                            localCacheEnabled = localCache.enabled;
                            if (localCacheEnabled) {
                                try {
                                    c8oCallRequestIdentifier = C8oUtilsCore.identifyC8oCallRequest(this.parameters, responseType);
                                } catch (error) {
                                    reject(new C8oException(C8oExceptionMessage.serializeC8oCallRequest(), error));
                                }
                                // here we are not testing if localcahe is available.
                                // if connection is not available this will generates an exception that will be caught
                                if (localCache.priority.isAvailable) {
                                    try {
                                        const result = await (this.c8o.c8oFullSync as C8oFullSyncCbl).getResponseFromLocalCache(c8oCallRequestIdentifier);
                                        if (result instanceof C8oUnavailableLocalCacheException) {
                                            // no entry
                                        } else {
                                            const localCacheResponse: C8oLocalCacheResponse = (result as C8oLocalCacheResponse);
                                            if (!localCacheResponse.isExpired()) {
                                                if (responseType === C8oCore.RESPONSE_TYPE_JSON) {
                                                    resolve(C8oTranslator.stringToJSON(localCacheResponse.getResponse()));
                                                    return;
                                                }
                                            }
                                        }
                                    } catch (error) {
                                        if (error instanceof C8oUnavailableLocalCacheException) {
                                            // no entry
                                        } else {
                                            reject(error);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    // Get Response
                    this.parameters[C8oCore.ENGINE_PARAMETER_DEVICE_UUID] = await this.c8o.deviceUUID;
                    this.c8oCallUrl = this.c8o.endpoint + "/." + responseType;
                    let params: Object = new Object();
                    params = Object.assign(params, this.parameters);
                    await this.c8o.httpInterface.handleRequest(this.c8oCallUrl, params, this.c8oResponseListener,
                    ).catch(
                        async (error) => {
                            if (localCacheEnabled) {
                                await (this.c8o.c8oFullSync as C8oFullSyncCbl).getResponseFromLocalCache(c8oCallRequestIdentifier,
                                ).then(
                                    (localCacheResponse: C8oLocalCacheResponse) => {
                                        try {
                                            if (!localCacheResponse.isExpired()) {
                                                if (responseType === C8oCore.RESPONSE_TYPE_JSON) {
                                                    resolve(C8oTranslator.stringToJSON(localCacheResponse.getResponse()));
                                                }
                                            }
                                        } catch (error) {
                                            // no entry
                                        }
                                    });
                            }
                            if (error.status === 0) {
                                reject(new C8oHttpRequestException("ERR_INTERNET_DISCONNECTED", error));
                            } else {
                                reject(error);
                            }
                        }).then(
                        async (result) => {
                            if (result !== undefined) {
                                let isErrorR = result["error"] != undefined ? result["error"]["code"] != undefined ? result["error"]["message"] != undefined ? result["error"]["details"] != undefined? true: false :false : false : false;
                                let isErrorDoc = result["document"] != undefined ? result["document"]["error"] != undefined ? result["document"]["error"]["code"] != undefined ? result["document"]["error"]["message"] != undefined ? result["document"]["error"]["details"] != undefined? true: false :false : false : false: false;
                                let isError = (isErrorR || isErrorDoc);
                                if(isError){
                                    if (localCacheEnabled) {
                                        await (this.c8o.c8oFullSync as C8oFullSyncCbl).getResponseFromLocalCache(c8oCallRequestIdentifier,
                                        ).then(
                                            (localCacheResponse: C8oLocalCacheResponse) => {
                                                try {
                                                    if (!localCacheResponse.isExpired()) {
                                                        if (responseType === C8oCore.RESPONSE_TYPE_JSON) {
                                                            resolve(C8oTranslator.stringToJSON(localCacheResponse.getResponse()));
                                                        }
                                                    }
                                                } catch (error) {
                                                    // no entry
                                                }
                                            });
                                    }
                                    if(this.c8o.errorConvertigoIntoFail){
                                        reject(result);
                                    }
                                    else{
                                        resolve(result);
                                    }
                                    
                                }
                                else{
                                    let response: any;
                                    let responseString: string;
                                    if (this.c8oResponseListener instanceof C8oResponseJsonListener) {
                                        try {
                                            try {
                                                responseString = result;
                                            } catch (error) {
                                                reject(new C8oException(C8oExceptionMessage.parseInputStreamToString(), error));
                                            }
                                            response = result;
                                        } catch (error) {
                                            reject(error);
                                        }
                                    } else {
                                        reject(new C8oException(C8oExceptionMessage.wrongListener(this.c8oResponseListener)));
                                    }
                                    if (localCacheEnabled) {
                                        try {
                                            let expirationDate: number = -1;
                                            if (localCache.ttl > 0) {
                                                expirationDate = localCache.ttl + (new Date).getTime();
                                            }
                                            const localCacheResponse: C8oLocalCacheResponse = new C8oLocalCacheResponse(responseString, responseType, expirationDate);
                                            try{
                                                /*const p1 = await */(this.c8o.c8oFullSync as C8oFullSyncCbl).saveResponseToLocalCache(c8oCallRequestIdentifier, localCacheResponse);
                                            }
                                            catch(e){
                                                console.log("an error occured while saving response to local cache");
                                            }
                                            
                                            /*Promise.all([p1])
                                                .then(() => {
                                                    resolve(response);
                                                })
                                                .catch((e)=>{
                                                    console.log("an error occured", e);
                                                })*/
                                            
                                        } catch (error) {
                                            reject(new C8oException(C8oExceptionMessage.saveResponseToLocalCache()));
                                        }
                                    }
                                    resolve(response);
                                }




                                    
                            }
                        });
                }
            } catch (error) {
                reject(error);
            }
        });

    }

    private handleResponse(result: any) {
        try {
            if (this.c8oResponseListener === null) {
                return;
            } else if (result instanceof Error || result instanceof C8oException) {
                this.c8o.handleCallException(this.c8oExceptionListener, this.parameters, result);
            } else if (result instanceof Object) {
                this.c8o.log.logC8oCallJSONResponse(result, this.c8oCallUrl, this.parameters);
                (this.c8oResponseListener as C8oResponseJsonListener).onJsonResponse(result, this.parameters);
            } else {
                this.c8o.handleCallException(this.c8oExceptionListener, this.parameters, new C8oException(C8oExceptionMessage.wrongResult(result)));
            }
        } catch (error) {
            this.c8o.handleCallException(this.c8oExceptionListener, this.parameters, error);
        }
    }
}
