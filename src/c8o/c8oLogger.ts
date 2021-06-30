import {C8oCore} from "./c8oCore";
import {C8oLogLevel} from "./c8oLogLevel";
import {Queue} from "./c8oUtilsCore";
import {C8oException} from "./Exception/c8oException";
import {C8oExceptionMessage} from "./Exception/c8oExceptionMessage";
import { Observable } from "rxjs";

export class C8oLogger {

    // *** Constants ***//
    // private static LOG_TAG: string = "c8o";
    private static LOG_INTERNAL_PREFIX: string = "[c8o] ";

    public static REMOTE_LOG_LIMIT: number = 100;

    private static JSON_KEY_REMOTE_LOG_LEVEL: string = "remoteLogLevel";
    private static JSON_KEY_TIME: string = "time";
    private static JSON_KEY_LEVEL: string = "level";
    private static JSON_KEY_MESSAGE: string = "msg";
    private static JSON_KEY_LOGS: string = "logs";
    private static JSON_KEY_ENV: string = "env";

    /** Attributes */

    private remoteLogUrl: string;
    private remoteLogs: Queue<JSON>;
    //noinspection JSMismatchedCollectionQueryUpdate
    private alreadyRemoteLogging: boolean[];
    private remoteLogLevel: C8oLogLevel;
    private uidRemoteLogs: string;
    private startTimeRemoteLog: number;
    public initDone: boolean = false;
    private pending_remoteLogs: Queue<JSON>;
    private pending_remoteLogsLevel: Queue<C8oLogLevel>;

    private c8o: C8oCore;

    private env: string;
    private pInit: Promise<any>;
    constructor(c8o: C8oCore, first: boolean) {
        this.pInit = this.affect_val(c8o, first);
    }
    public affect_val(c8o: C8oCore, first: boolean) {
        return new Promise<void>(async (resolve)=>{

            if (first) {
                this.c8o = c8o;
                this.remoteLogUrl = "";
                this.remoteLogs = new Queue<JSON>();
                this.pending_remoteLogsLevel = new Queue<C8oLogLevel>();
                this.pending_remoteLogs = new Queue<JSON>();
                this.alreadyRemoteLogging = [];
                this.alreadyRemoteLogging.push(false);
                this.remoteLogLevel = C8oLogLevel.TRACE;
                this.startTimeRemoteLog = new Date().getTime();
                this.uidRemoteLogs = Math.round((new Date().getTime() * Math.random())).toString(36);
                const obj = {};
                obj["uid"] = this.uidRemoteLogs.toUpperCase();
                obj["uuid"] = (await this.c8o.deviceUUID).toUpperCase();
                obj["project"] = "";
                this.env = JSON.stringify(obj);
                resolve();
            } else {
                this.c8o = c8o;
    
                this.remoteLogUrl = c8o.endpointConvertigo + "/admin/services/logs.Add";
                this.remoteLogs = new Queue<JSON>();
                this.alreadyRemoteLogging = [];
                this.alreadyRemoteLogging.push(false);
    
                this.remoteLogLevel = C8oLogLevel.TRACE;
                this.startTimeRemoteLog = new Date().getTime();
                this.uidRemoteLogs = Math.round((new Date().getTime() * Math.random())).toString(36);
                const obj = {};
                obj["uid"] = this.uidRemoteLogs.toUpperCase();
                obj["uuid"] = (await this.c8o.deviceUUID).toUpperCase();
                obj["project"] = encodeURIComponent(c8o.endpointProject.toString());
                this.env = JSON.stringify(obj);
                resolve();
            }
        });

    }

    private isLoggableRemote(logLevel: C8oLogLevel): boolean {
        return this.c8o.logRemote && logLevel != null && C8oLogLevel.TRACE.priority <= this.remoteLogLevel.priority && this.remoteLogLevel.priority <= logLevel.priority;
    }

    private isLoggableConsole(logLevel: C8oLogLevel): boolean {
        return logLevel != null && C8oLogLevel.TRACE.priority <= this.c8o.logLevelLocal.priority && this.c8o.logLevelLocal.priority <= logLevel.priority;
    }

    public canLog(logLevel: C8oLogLevel): boolean {
        return this.isLoggableConsole(logLevel) || this.isLoggableRemote(logLevel);
    }

    //noinspection JSUnusedGlobalSymbols
    public get isFatal(): boolean {
        return this.canLog(C8oLogLevel.FATAL);
    }

    //noinspection JSUnusedGlobalSymbols
    public get isError(): boolean {
        return this.canLog(C8oLogLevel.ERROR);
    }

    //noinspection JSUnusedGlobalSymbols
    public get isWarn(): boolean {
        return this.canLog(C8oLogLevel.WARN);
    }

    //noinspection JSUnusedGlobalSymbols
    public get isInfo(): boolean {
        return this.canLog(C8oLogLevel.INFO);
    }

    public get isDebug(): boolean {
        return this.canLog(C8oLogLevel.DEBUG);
    }

    public get isTrace(): boolean {
        return this.canLog(C8oLogLevel.TRACE);
    }

    private log(logLevel: C8oLogLevel, message: string, exception: Error) {
        const isLogConsole: boolean = this.isLoggableConsole(logLevel);
        const isLogRemote: boolean = this.isLoggableRemote(logLevel);
        let copyMsg = "" + message;
        if (isLogConsole || isLogRemote) {
            if (exception != null) {
                let messageB = false;
                let messageS = false;
                try {
                    if(exception.message != undefined){
                        message += " : " + JSON.stringify(exception.message);
                    }
                    else{
                        messageB = true;
                    }
                    if(exception.stack != undefined){
                        message += "\n" + JSON.stringify(exception.stack); 
                    }
                    else{
                        messageS = true;
                    }
                }
                catch(e){
                    message += "\n" + exception.toString();
                }
                if(messageB && messageS){
                    try{
                        message += "\n" + JSON.stringify(exception);
                    }
                    catch(e){
                        message += "\n" + exception.toString();
                    }
                }
                
            }

            const time: string = (((new Date().getTime().valueOf()) - (this.startTimeRemoteLog)) / 1000).toString();
            if (!this.initDone) {
                const obj = {};
                obj[(C8oLogger.JSON_KEY_TIME.valueOf())] = time;
                obj[(C8oLogger.JSON_KEY_LEVEL.valueOf())] = logLevel.name;
                obj[(C8oLogger.JSON_KEY_MESSAGE.valueOf())] = message.toString();
                const objJson: JSON = obj as JSON;
                this.pending_remoteLogs.push(objJson);
                this.pending_remoteLogsLevel.push(logLevel);
            } else {
                if (isLogRemote) {
                    const obj = {};
                    obj[(C8oLogger.JSON_KEY_TIME.valueOf())] = time;
                    obj[(C8oLogger.JSON_KEY_LEVEL.valueOf())] = logLevel.name;
                    obj[(C8oLogger.JSON_KEY_MESSAGE.valueOf())] = message.toString();
                    const objJson: JSON = obj as JSON;
                    this.remoteLogs.push(objJson);
                    this.logRemote();
                }
                if (isLogConsole) {
                    let verb = logLevel.name.toLowerCase();
                    if(logLevel.name == "FATAL"){
                        verb = "error";
                    }
                    try{
                        if(exception != undefined){
                            if(exception.message != undefined && exception["cause"] != undefined){
                                console[verb]("(" + time + ") [" + logLevel.name + "] " + copyMsg, exception.message, exception["cause"]);
                            }
                            else{
                                console[verb]("(" + time + ") [" + logLevel.name + "] " + copyMsg, exception);
                            }
                        }
                        else{
                            console[verb]("(" + time + ") [" + logLevel.name + "] " + copyMsg);
                        }
                        
                    }
                    catch(e){
                        console.log("(" + time + ") [" + logLevel.name + "] " + message);
                    }
                    
                }
            }

        }
    }

    public fatal(message: string, exceptions: Error = null) {
        this.log(C8oLogLevel.FATAL, message, exceptions);
    }

    public error(message: string, exceptions: Error = null) {
        this.log(C8oLogLevel.ERROR, message, exceptions);
    }

    public warn(message: string, exceptions: Error = null) {
        this.log(C8oLogLevel.WARN, message, exceptions);
    }

    public info(message: string, exceptions: Error = null) {
        this.log(C8oLogLevel.INFO, message, exceptions);
    }

    public debug(message: string, exceptions: Error = null) {
        this.log(C8oLogLevel.DEBUG, message, exceptions);
    }

    public trace(message: string, exceptions: Error = null) {
        this.log(C8oLogLevel.TRACE, message, exceptions);
    }

    private _log(logLevel: C8oLogLevel, messages: string, exceptions: Error = null) {
        if (this.c8o.logC8o) {
            this.log(logLevel, C8oLogger.LOG_INTERNAL_PREFIX.toString() + messages.toString(), exceptions);
        }
    }

    public _fatal(message: string, exceptions: Error = null) {
     this._log(C8oLogLevel.FATAL, message, exceptions);
    }

    public _error(message: string, exceptions: Error = null) {
     this._log(C8oLogLevel.ERROR, message, exceptions);
    }

    public _warn(message: string, exceptions: Error = null) {
     this._log(C8oLogLevel.WARN, message, exceptions);
    }

    public _info(message: string, exceptions: Error = null) {
     this._log(C8oLogLevel.INFO, message, exceptions);
    } 

    public _debug(message: string, exceptions: Error = null) {
        this._log(C8oLogLevel.DEBUG, message, exceptions);
    }

    public _trace(message: string, exceptions: Error = null) {
        this._log(C8oLogLevel.TRACE, message, exceptions);
    }

    public async logRemoteInit() {
        this.pInit.then(async()=>{
            this.initDone = true;

            let count: number = 0;
            const listSize: number = this.pending_remoteLogs.count();
            const logsArray = new Array<any>();
    
            while (count < listSize && count < C8oLogger.REMOTE_LOG_LIMIT) {
                const logLvl = this.pending_remoteLogsLevel.pop();
                const mvar = this.pending_remoteLogs.pop();
    
                if (this.isLoggableConsole(logLvl)) {
                    console.log("(" + mvar["time"] + ") [" + logLvl.name + "] " + mvar["msg"]);
                }
                if (this.isLoggableRemote(logLvl)) {
                    logsArray.push(mvar);
                    count += 1;
                }
    
            }
            //noinspection JSUnusedAssignment
            let canLog: boolean = false;
            canLog = logsArray.length > 0;
            if (canLog) {
                this.alreadyRemoteLogging[0] = true;
            }
            const parameters: Object = {};
            parameters[C8oLogger.JSON_KEY_LOGS.valueOf()] = JSON.stringify(logsArray);
            parameters[C8oCore.ENGINE_PARAMETER_DEVICE_UUID] = await this.c8o.deviceUUID;
            parameters[C8oLogger.JSON_KEY_ENV] = this.env;
    
            this.c8o.httpInterface.handleRequest(this.remoteLogUrl, parameters)
                .then((response) => {
                    if (response !== undefined) {
                        if (response.error !== undefined) {
                            this.c8o.logRemote = false;
                            if (this.c8o.logOnFail != null) {
                                this.c8o.logOnFail(new C8oException(C8oExceptionMessage.RemoteLogFail(), response.error), null);
                            }
                        }
                    }
                    const logLevelResponse = response[C8oLogger.JSON_KEY_REMOTE_LOG_LEVEL.toString()];
                    if (logLevelResponse != null) {
                        const logLevelResponseStr: string = logLevelResponse.toString();
                        const c8oLogLevel = C8oLogLevel.getC8oLogLevel(logLevelResponseStr);
                        if (c8oLogLevel != null) {
                            this.remoteLogLevel = c8oLogLevel;
                        }
                        this.alreadyRemoteLogging[0] = false;
                        this.logRemote();
                    }
                })
                .catch((error) => {
                    this.c8o.logRemote = false;
                    if (this.c8o.logOnFail != null) {
                        this.c8o.logOnFail(new C8oException(C8oExceptionMessage.RemoteLogFail(), error), null);
                    }
                });
        })
        
    }

    checkInitDone(resolve = null):Promise<any>{
        if(resolve == null){
            return new Promise<void>((resolve)=>{
                if(!this.initDone){
                    setTimeout(()=>{
                        this.checkInitDone(resolve)
                    }, 100);
                }   
                else{resolve()}
            })
            
        }
        else{
            if(!this.initDone){
                setTimeout(()=>{
                    this.checkInitDone(resolve)
                }, 100);
            }
            else{
                resolve();
            }   
        }
        
    }
    public async logTest(): Promise<any>{
        
        await this.checkInitDone()
        return this.logTestAction();
        
            /*if (!this.initDone) {
                setTimeout(()=>{
                    return this.logTest();
                },100)
            }
            else{
                return this.logTestAction();
            } */   
    }

    private logTestAction(): Promise<any>{
        return new Promise(async (resolve, reject)=>{
                const message = "[c8o] Testing if endpoint is reachable";
                const time: string = (((new Date().getTime().valueOf()) - (this.startTimeRemoteLog)) / 1000).toString();
                const obj = {};
                obj[(C8oLogger.JSON_KEY_TIME.valueOf())] = time;
                obj[(C8oLogger.JSON_KEY_LEVEL.valueOf())] = C8oLogLevel.DEBUG.name;
                obj[(C8oLogger.JSON_KEY_MESSAGE.valueOf())] = message;
                const parameters: Object = {};
                parameters[C8oLogger.JSON_KEY_LOGS.valueOf()] = JSON.stringify([obj]);
                parameters[C8oCore.ENGINE_PARAMETER_DEVICE_UUID] = await this.c8o.deviceUUID;
                parameters[C8oLogger.JSON_KEY_ENV] = this.env;
                this.c8o.httpInterface.handleRequest(this.remoteLogUrl, parameters)
                .then((response) => {
                    resolve(true);
                })
                .catch((error) => {
                    reject(false);
                });
            });
    }

    public async logRemote() {

        //noinspection JSUnusedAssignment
        let canLog: boolean = false;
        canLog = this.remoteLogs.count() > 0;
        if (canLog) {
            this.alreadyRemoteLogging[0] = true;
        }

        if (canLog) {
            // We're using Angular Http provider to request the data,
            // then on the response it'll map the JSON data to a parsed JS object.
            // Next we process the data and resolve the promise with the new data.
            // "/admin/services/logs.Add";
            let count: number = 0;
            const listSize: number = this.remoteLogs.count() as number;
            const logsArray = [];
            while (count < listSize && count < C8oLogger.REMOTE_LOG_LIMIT) {
                logsArray.push(this.remoteLogs.pop());
                count += 1;
            }
            const parameters: Object = {};
            parameters[C8oLogger.JSON_KEY_LOGS.valueOf()] = JSON.stringify(logsArray);
            parameters[C8oCore.ENGINE_PARAMETER_DEVICE_UUID] = await this.c8o.deviceUUID;
            parameters[C8oLogger.JSON_KEY_ENV] = this.env;

            this.c8o.httpInterface.handleRequest(this.remoteLogUrl, parameters)
                .then((response) => {
                    if (response !== undefined) {
                        if (response.error !== undefined) {
                            this.c8o.logRemote = false;
                            if (this.c8o.logOnFail != null) {
                                this.c8o.logOnFail(new C8oException(C8oExceptionMessage.RemoteLogFail(), response.error), null);
                            }
                        }
                    }
                    const logLevelResponse = response[C8oLogger.JSON_KEY_REMOTE_LOG_LEVEL.toString()];
                    if (logLevelResponse != null) {
                        const logLevelResponseStr: string = logLevelResponse.toString();
                        const c8oLogLevel = C8oLogLevel.getC8oLogLevel(logLevelResponseStr);
                        if (c8oLogLevel != null) {
                            this.remoteLogLevel = c8oLogLevel;
                        }
                        this.alreadyRemoteLogging[0] = false;
                        this.logRemote();
                    }
                })
                .catch((error) => {
                    this.c8o.logRemote = false;
                    if (this.c8o.logOnFail != null) {
                        this.c8o.logOnFail(new C8oException(C8oExceptionMessage.RemoteLogFail(), error), null);
                    }
                });
        }
    }
    public logMethodCall(methodName: string, ...parameters: any[]) {
        if (this.c8o.logC8o && this.isDebug) {
            let methodCallLogMessage: string = "Method call: " + methodName;
            if (parameters == null || Object.keys(parameters).length === 0) {
                this._debug(methodCallLogMessage);
            }
            if (this.isTrace) {
                methodCallLogMessage += ", Parameters: [";
                for (const param of parameters) {
                    let paramStr = "null";
                    if (parameters != null) {
                        try{
                            paramStr = JSON.stringify(param);
                        }
                        catch(error){
                            paramStr = "cannot view value due to circular reference";
                        }
                        
                    }
                    methodCallLogMessage += "\n" + paramStr + ", ";
                }
                // Remove the last character
                methodCallLogMessage = methodCallLogMessage.substring(0, methodCallLogMessage.length - 2) + "]";

                this._trace(methodCallLogMessage);
            } else {
                this._debug(methodCallLogMessage);
            }
        }
    }

    public logC8oCall(url: string, parameters: any) {
        if (this.c8o.logC8o && this.isDebug) {
            let c8oCallLogMessage: string = "C8o call: " + url;
            if (parameters.length > 0) {
                c8oCallLogMessage += "\n" + String(parameters);
            }
            this._debug(c8oCallLogMessage);
        }
    }

    public logC8oCallJSONResponse(response: JSON, url: string, parameters: any) {
        this.logC8oCallResponse(JSON.stringify(response), "JSON", url, parameters);
    }

    public logC8oCallXMLResponse(response: Document, url: string, parameters: Object) {
        this.logC8oCallResponse(response.toString(), "XML", url, parameters);
    }

    public logC8oCallResponse(responseStr: string, responseType: string, url: string, parameters: any) {
        if (this.c8o.logC8o && this.isTrace) {
            let c8oCallResponseLogMessage: string;
            if (url == null) {
                c8oCallResponseLogMessage = "C8o call " + responseType + " response: ";
            } else {
                c8oCallResponseLogMessage = "C8o call " + responseType + " response: " + url;
            }
            if (parameters.count > 0) {
                c8oCallResponseLogMessage += "\n" + parameters.toString();
            }
            c8oCallResponseLogMessage += "\n" + responseStr;

            this._trace(c8oCallResponseLogMessage);
        }
    }
}
