import "rxjs/add/operator/retry";
import {C8oCore} from "./c8oCore";
import {C8oProgress} from "./c8oProgress";
import { C8oResponseListener, C8oResponseJsonListener} from "./c8oResponse";
import { C8oFullSyncCbl } from "./c8oFullSync";
import { C8oHttpRequestException } from "./Exception/c8oHttpRequestException";

import { C8oExceptionMessage } from "./Exception/c8oExceptionMessage";
import { Observable } from "rxjs";
import { url } from 'inspector';

declare const require: any;
export abstract class C8oHttpInterfaceCore {
    public c8o: C8oCore;
    public timeout: number;
    public firstCall: boolean = true;
    public p1: Promise<Object>;
    protected _isCordova = null;
    public firstcheckSessionR: boolean;
    private js = false;
    private session = "";
    private _timeout : any;
    private from: any;
    private requestLogin: any;
    private _loggedinSession: boolean;

    constructor(c8o: C8oCore) {
        /**
         * As we must support Angular 5.x, 6.x and 7.x, they need as peerDependencies diffrent versions of Rxjs.
         * We alson need rxjs, but switch version of rxjs methods and paths to import are diffrents.
         * So we test presence or not of module in some paths into rxjs to define in which version we are and execute the good import.
        */
        let rxjs = require('rxjs');
        if(rxjs !=  undefined){
            if(rxjs.from != undefined){
                this.from  = rxjs.from;
                c8o.log.trace("[C8oHttpInterfaceCore] Detect rxjs 6.x")
            }
            else{
                rxjs = require('rxjs/observable/fromPromise');
                c8o.log.trace("[C8oHttpInterfaceCore] Detect rxjs 5.x")
                if(rxjs != undefined){
                    this.from = rxjs.fromPromise;
                }
            }
        }
        
        this.c8o = c8o;
        this.timeout = this.c8o.timeout;
        this.firstcheckSessionR = false;

        /**
         *  As this package will be used in two diffrent library, wee need to test in which platform we are,
         *  to perform diffrent platform specific actions.
         */
        if(this.c8o.httpPublic.constructor.name !== "HttpClient"){
            this.js = true;
        }
    }

    /**
     * Method to bastract http get
     * @param uri the uri for given request
     */
    public httpGetObservable(uri, param1, param2){
        if(this.js){
            return this.from(this.c8o.httpPublic.get(uri, param1, param2));
        }
        else{
            return this.c8o.httpPublic.get(uri, param1, param2);
        }
    }

    /**
     * Method to bastract http post
     * @param uri the uri for given request
     */
    public httpPostObservable(uri, param1, param2){
        if(this.js){
            return this.from(this.c8o.httpPublic.post(uri, param1, param2));
        }
        else{
            return this.c8o.httpPublic.post(uri, param1, param2);
        }
    }
    /**
     * Call user service
     * @param headers headers for request
     */
    private getUserService(headers:any): Observable<any>{
        return this.httpPostObservable(this.c8o.endpointConvertigo+"/services/user.Get", {}, {
            headers: headers,
            withCredentials: true
        });
    }

    /**
     * Check if session is ok
     * @param parameters 
     */
    public checkSession(): Observable<any>{
        let headersObject = {'Accept':'application/json', 'x-convertigo-sdk': this.c8o.sdkVersion};
        Object.assign(headersObject, this.c8o.headers);
        let headers = this.getHeaders(headersObject);
        return this.httpPostObservable(this.c8o.endpointConvertigo+"/services/user.Get", {}, {
            headers: headers,
            withCredentials: true
        });
    }

    /**
     * Check session status recursivly
     * @param headers 
     * @param time 
     * @param session 
     */
    private checkSessionR(headers: any, time: number, session: string){
        setTimeout(()=>{
                this.c8o.log.debug("[C8o][C8oHttpsession][checkSessionR] Checking for session");
                this.checkSession()
                .retry(1)
                .subscribe(
                    response => {
                        if(!response["authenticated"]){
                            this.c8o.subscriber_session.next();
                            this.c8o.log.debug("[C8o][C8oHttpsession][checkSessionR] Session dropped");
                        }
                        else{
                            if((this.c8o.c8oFullSync as C8oFullSyncCbl).canceled == true){
                                (this.c8o.c8oFullSync as C8oFullSyncCbl).restartStoppedReplications();
                            }
                            let timeR = +response['maxInactive'] * 0.85 * 1000;
                            this.c8o.log.debug("[C8o][C8oHttpsession][checkSessionR] Pooling for session, next check will be in " +timeR + "ms");
                            this._timeout = this.checkSessionR(headers, timeR, session);
                            (this.c8o.c8oFullSync as C8oFullSyncCbl).restartStoppedReplications();
                        }
                    },
                    error => {
                        this.c8o.log.error("[C8o][C8oHttpsession][checkSessionR] error happened pooling session", error);
                     }
                );
        }, time)
    }

    /**
     * checkSessionOnce
     * We test session status and perform actions from its result
     */
    public checkSessionOnce(){
        this.checkSession()
            .retry(1)
            .subscribe(
                response => {
                    if(!response["authenticated"]){
                        this.c8o.log.debug("[C8o][online][checkSession] Session has been dropped");
                        if(this.requestLogin !=  undefined){
                            let resolve = (response)=>{
                                this.c8o.log.debug("[C8o] Auto Logins works");
                            }
                            let reject = (err)=>{
                                this.c8o.log.debug("[C8o] Auto Logins failed");
                                this.c8o.subscriber_session.next();
                            }
                            this.execHttpPosts(this.requestLogin.url, this.requestLogin.parameters, this.requestLogin.headers, resolve, reject);
                        
                        }
                        else{
                            this.c8o.subscriber_session.next();
                        }
                    }
                    else{
                        this.c8o.log.debug("[C8o][online][checkSession] Session still Alive we will restart replications");
                        (this.c8o.c8oFullSync as C8oFullSyncCbl).restartStoppedReplications();
                    }
                },
                error => {
                    this.c8o.log.error("[C8o][online][checkSession][online] error happened pooling session", error);
                }
            );
    }

    /**
     * 
     * @param response 
     * @param headers 
     */
    public triggerSessionCheck(response: any, headers: any, urlReq, parametersReq, headersReq){
        // if we had still not bee loggedin and we want to keep alive session
        if(!this.firstcheckSessionR && this.c8o.keepSessionAlive == true){
            var val = response.headers.get("x-convertigo-authenticated");
            // if headers response contains x-convertigo-authenticated 
            if(val != null){
                // Define that we have been loggedIn for the first time
                this._loggedinSession = true;
                // Save that request as it's the one that will allow us to perform auto login
                this.requestLogin = {url: urlReq, parameters: parametersReq, headers: headersReq};
                // Save session id for further uses
                this.session = val;
                // Define that we have done the first checksession  
                this.firstcheckSessionR = true;
                // Restart stopped replications
                (this.c8o.c8oFullSync as C8oFullSyncCbl).restartStoppedReplications();
                // If we have already a recursive check for the session cancel it
                if(this._timeout != null){
                    clearTimeout(this._timeout);
                    this.c8o.log.debug("[C8o][C8oHttpsession][checkSessionR] Remove ChecksessionR for older session");
                }
                // Launch a new check Session recursive
                this.checkSessionR(headers, 0, val);
            }
        }
        // if we had still not bee loggedin and don't want to keep alive sessions 
        else if(!this.firstcheckSessionR && this.c8o.keepSessionAlive == false){
            
                var val = response.headers.get("x-convertigo-authenticated");
                // if headers response contains x-convertigo-authenticated (means that we are authentified)
                if(val != null){
                    // Define that we have been loggedIn for the first time
                    this._loggedinSession = true;
                    // Save session id for further uses
                    this.session = val;
                    // Define that we have done the first checksession  
                    this.firstcheckSessionR = true;
                    // Check single time for session details
                    this.checkSession()
                    .retry(1)
                    .subscribe(
                        response => {
                            // if we are not authenticated => this would be strange
                            if(!response["authenticated"]){
                                this.c8o.log.debug("[C8o][C8oHttpsession][checkSessionR] Session dropped");
                                this.firstcheckSessionR = false;
                                this.c8o.subscriber_session.next();
                            }
                            // else we are athenticated
                            else{
                                // launch an handler in 85% percent of session life to tell user that session will be down
                                let timeR = +response['maxInactive'] * 0.85 * 1000;
                                setTimeout(()=>{
                                    this.c8o.log.debug("[C8o][triggerSessionCheck] session will be down");
                                    this.c8o.subscriber_session.next();
                                },timeR );
                            }
                        },
                        error => {
                            this.c8o.log.error("[C8o][triggerSessionCheck] checking session", error);
                        }
                    );
            }
        }
        // if we were logged in but session has been down then notify
        else {
            var val = response.headers.get("x-convertigo-authenticated");
            if(val == undefined && this._loggedinSession){
                this.c8o.log.debug("[C8o][C8oHttpsession][checkSessionR] Session dropped");
                this.c8o.subscriber_session.next();
            }
        }
    }

     /**
     * Make an http post
     * @param {string} url
     * @param {Object} parameters
     * @return {Promise<any>}
     */
    public httpPost(url: string, parameters: Object): Promise<any>{
        parameters = this.transformRequest(parameters);
        let headersObject = {"Content-Type": "application/x-www-form-urlencoded", "x-convertigo-sdk": this.c8o.sdkVersion};
        Object.assign(headersObject, this.c8o.headers);
        let headers = this.getHeaders(headersObject);
        if (this.firstCall) {
            this.p1 = new Promise((resolve, reject) => {
                this.firstCall = false;
                this.execHttpPosts(url, parameters, headers, resolve, reject);
            });
            return this.p1;
        }
        else {
            return new Promise((resolve, reject) => {
                Promise.all([this.p1]).then(() => {
                    this.execHttpPosts(url, parameters, headers, resolve, reject);
                }).catch((error) => {
                    reject(error);
                });
            });
        }
    }
    
    /**
     * Execute http Posts 
     * @param url 
     * @param parameters 
     * @param headers 
     * @param resolve 
     * @param reject 
     */
    private execHttpPosts(url:string, parameters:any, headers:any, resolve, reject){
        this.httpPostObservable(url, parameters, {
            headers: headers,
            withCredentials: true,
            observe: 'response'
        })
        .retry(1)
        .subscribe(
            response =>{
                this.handleResponseHttpPost(response, headers, resolve, url, parameters, headers);
            },
            error => {
                this.handleErrorHttpPost(error, reject);
            }
        );
    }

    /**
     * Handle response of http Posts
     * @param response 
     * @param headers 
     * @param resolve 
     */
    private handleResponseHttpPost(response:any, headers:any , resolve:any, urlReq: string, parametersReq: any, headersReq: any){
        this.triggerSessionCheck(response, headers, urlReq, parametersReq, headersReq);                 
        resolve(response.body)
    }

    /**
     * Handle errors of http Posts
     * @param error 
     * @param reject 
     */
    private handleErrorHttpPost(error:any, reject:any){
        reject((new C8oHttpRequestException(C8oExceptionMessage.runHttpRequest(), error)));
    }

    /**
     * Check type of file given in parameters
     * 0 : No file to upload
     * 1 : FileList Or File
     * 2 : url when running in cordova
     * @param {Object} parameters
     * @return {number}
     */
    public checkFile(parameters: Object): number{
        for (let p in parameters) {
            if (parameters[p] instanceof Array) {
                for (let p1 in parameters[p]) {
                    //noinspection JSUnfilteredForInLoop
                    if(parameters[p][p1] instanceof FileList){
                        return 1;
                    }
                    else if (parameters[p][p1] instanceof File) {
                        return 1;
                    }
                    else if(this.isCordova()){
                        if(parameters[p][p1] instanceof URL){
                            return 2;
                        }
                    }
                }
            }
            else {
                if(parameters[p] instanceof FileList){
                    return 1;
                }
                if(parameters[p] instanceof File){
                    return 1;
                }
                else if(this.isCordova()){
                    if(parameters[p]instanceof URL){
                        return 2;
                    }
                }
            }
        }
        return 0;
    }

    /**
     * Check if we are in cordova environment
     * @return {boolean}
     */
    protected isCordova():boolean{
        if(this._isCordova == null){
            if(window["cordova"]!= undefined){
                this._isCordova = true;
            }
            else{
                this._isCordova = false;
            }
        }
        return this._isCordova;
    }

    /**
     * Url encode parameters
     * @param {Object} parameters
     * @return {string}
     */
    public transformRequest(parameters: Object): string {
        let str = [];
        for (let p in parameters) {
            if (parameters[p] instanceof Array) {
                for (let p1 in parameters[p]) {
                    //noinspection JSUnfilteredForInLoop
                    str.push(encodeURIComponent(p) + "=" + encodeURIComponent(parameters[p][p1]));
                }
            }
            else {
                str.push(encodeURIComponent(p) + "=" + encodeURIComponent(parameters[p]));
            }
        }
        let query = str.join("&");
        // Add this to instruct Convertigo server to remove any name space in the jSON keys
        // to prevent keys like this:  'namespace:key'
        return (query + "&__removeNamespaces=true");
    }

    /**
     * Transform FormData parameters
     * @param {Object} parameters
     * @return {FormData}
     */
    public transformRequestformdata(parameters: Object): FormData {
        let formdata : FormData=  new FormData();
        for (let p in parameters) {
            if (parameters[p] instanceof Array) {
                for (let p1 in parameters[p]) {
                    if(parameters[p][p1] instanceof FileList){
                        for (var i = 0; i < parameters[p][p1].length; i++) {
                            formdata.append(p, parameters[p][p1][i], parameters[p][p1][i].name);
                        }
                    }
                    else if(parameters[p][p1] instanceof FileList){
                        formdata.append(p, parameters[p][p1], parameters[p][p1].name)
                    }
                    else{
                        formdata.append(p, parameters[p][p1])
                    }
                }
            }
            else {
                if(parameters[p] instanceof FileList) {
                    for (var j = 0; j < parameters[p].length; j++) {
                        formdata.append(p, parameters[p][j], parameters[p][j].name);
                    }
                }
                else if(parameters[p] instanceof File) {
                    formdata.append(p, parameters[p], parameters[p].name);
                }
                else{
                    formdata.append(p, parameters[p]);
                }
            }
        }
        return formdata;
    }

    /**
     * Extract file from parameters and return and array containing a file and params
     * @param {Object} parameters
     * @return {any}
     */
    public transformRequestfileNative(parameters: Object): any{
        let file: Array<any> = new Array();
        let params: Object = new Object();
        for (let p in parameters) {
            if (parameters[p] instanceof Array) {
                for (let p1 in parameters[p]) {
                    if(parameters[p][p1] instanceof URL){
                        file.push([p1, parameters[p][p1]]);
                    }
                    else{
                        params[p1] = parameters[p][p1]["href"];
                    }
                }
            }
            else {
                if(parameters[p] instanceof URL) {
                    file.push([p, parameters[p]["href"]]);
                }
                else{
                    params[p] = parameters[p];
                }
            }
        }
        return [file, params];
    }

    /**
     * Handle the request
     * @param {string} url
     * @param {Object} parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @return {Promise<any>}
     */
    async handleRequest(url: string, parameters: Object, c8oResponseListener?: C8oResponseListener): Promise<any> {
        if (parameters["__sequence"] !== undefined) {
            if (parameters["__sequence"].indexOf("#") !== -1) {
                parameters["__sequence"] = parameters["__sequence"].substring(0, parameters["__sequence"].indexOf("#"));
            }
        }
        switch (this.checkFile(parameters)){
            case 0: {
                return this.httpPost(url, parameters);
            }
            case 1: {
                let form = this.transformRequestformdata(parameters);
                return this.uploadFileHttp(url,form,parameters,c8oResponseListener);
            }
            case 2: {
                return this.uploadFilePluginNative(url, parameters, c8oResponseListener);
            }
        }

    }

    /**
     * Upload file with native plugin
     * @param {string} url
     * @param {Object} parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @return {Promise<any>}
     */
    public uploadFilePluginNative(url: string, parameters: Object, c8oResponseListener: C8oResponseListener):Promise<any>{
        let progress: C8oProgress = new C8oProgress();
        progress.pull = false;
        let varNull: JSON = null;
        let data = this.transformRequestfileNative(parameters);
        let files = data[0];
        let options = new window["FileUploadOptions"]();
        options.fileKey = files[0][0];
        options.fileName = files[0][1].substr(files[0][1].lastIndexOf('/') + 1);
        options.params = data[1];
        let headersObject = {'Accept':'application/json', 'x-convertigo-sdk': this.c8o.sdkVersion};
        Object.assign(headersObject, this.c8o.headers);
        options.headers = headersObject;
        return new Promise((resolve,reject)=>{
            Promise.all([this.p1]).then(() => {
                var ft = new window["FileTransfer"]();
                ft.onprogress = (progressEvent) => {
                    if (progressEvent.lengthComputable) {
                        this.handleProgress(progressEvent, progress, parameters, c8oResponseListener, varNull);
                    }
                };
                ft.upload(files[0][1], encodeURI(url), ((resp => {
                    resolve(resp);
                })), ((err) => {
                    reject(err);
                }), options);
            });
        });
    }

    /**
     * Upload File using an Http client
     * @param {string} url
     * @param {FormData} form
     * @param {Object} parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @return {Promise<any>}
     */
    uploadFileHttp(url: string, form: FormData, parameters: Object, c8oResponseListener: C8oResponseListener): Promise<any>{
        let headersObject = {'Accept':'application/json', 'x-convertigo-sdk': this.c8o.sdkVersion};
        Object.assign(headersObject, this.c8o.headers);
        let progress: C8oProgress = new C8oProgress();
        progress.pull = false;
        let varNull: JSON = null;

        if (this.firstCall) {
            this.p1 = new Promise((resolve) => {
                this.firstCall = false;
                this.getuploadRequester(url, form, headersObject)
                .subscribe(
                    event=>{
                        this.handleResponseFileUpload(event, progress, parameters, c8oResponseListener, varNull, resolve); 
                    },
                    error => { 
                        this.handleErrorFileUpload(error, resolve);
                    });
            });
            return this.p1;
        }
        else {
            return new Promise((resolve, reject) => {
                Promise.all([this.p1]).then(() => {
                    this.getuploadRequester(url, form, headersObject)
                    .subscribe(
                        event=>{
                            this.handleResponseFileUpload(event, progress, parameters, c8oResponseListener, varNull, resolve);      
                        },
                        error => { 
                            this.handleErrorFileUpload(error, resolve);
                        });
                });
            });
        }
    }

    /**
     * handle FileuploadResponses
     * @param event 
     * @param progress 
     * @param parameters 
     * @param c8oResponseListener 
     * @param varNull 
     * @param resolve 
     */
    public handleResponseFileUpload(event:any, progress: C8oProgress, parameters: Object, c8oResponseListener: C8oResponseListener, varNull:any, resolve):void{
        if(!this.js){
            if (event.type === 1) {
                this.handleProgress(event, progress, parameters, c8oResponseListener, varNull);
            } else if (this.isHttpResponse(event)) {
                resolve(event);
            }
        }
        else{
            console.error("MUST BE DONE");
        }
    }

    /**
     * Handle errors for file upload
     * @param error 
     * @param resolve 
     */
    private handleErrorFileUpload(error:any, resolve:any): void {
        resolve({"error": (new C8oHttpRequestException(C8oExceptionMessage.runHttpRequest(), error))});
    }

    /**
     * Handle progress
     * @param event
     * @param {C8oProgress} progress
     * @param parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @param {JSON} varNull
     */
    handleProgress(event: any, progress: C8oProgress, parameters: any, c8oResponseListener: C8oResponseListener, varNull: JSON): void{
        progress.current = event.loaded;
        progress.total = event.total;
        if(event.loaded != event.total){
            progress.finished = false;
        }
        else{
            progress.finished = true;
        }
        parameters[C8oCore.ENGINE_PARAMETER_PROGRESS] = progress;
        (c8oResponseListener as C8oResponseJsonListener).onJsonResponse(varNull, parameters);

    }
    
     /**
     * get headers;
     * @param object headers object
     */
    public abstract getHeaders(object):any;

    /**
     * Post with progress
     * @param url the url to post
     * @param form the form data to post
     * @param headersObject Headers to use
     */
    public abstract getuploadRequester(url:string, form: FormData, headersObject:any): Observable<any>;

    /**
     * test type of response
     * @param event any
     */
    public abstract isHttpResponse(event:any):boolean;
}
