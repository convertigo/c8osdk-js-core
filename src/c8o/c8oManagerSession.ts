import "rxjs/add/operator/retry";
import { C8oCore } from "./c8oCore";
import { C8oSessionStatus } from './c8oSessionStatus';
import { C8oUtilsCore, Semaphore } from './c8oUtilsCore';
import { C8oManagerLogin } from './c8oManagerLogin';
import { C8oSessionUser } from './C8oSessionUser';

declare const require: any;
export class C8oManagerSession {
    public c8o: C8oCore;
    private _status: C8oSessionStatus;
    private id: string;
    private loginManager: C8oManagerLogin;
    private checker: any;
    private _user: C8oSessionUser;
    private _olduser: C8oSessionUser;
    private ignored;
    private resumeListener = undefined;
    public mutex : Semaphore;
    public mutexNetwork : Semaphore;
    public mutexCheckSession : Semaphore;

    constructor(c8o: C8oCore) {
        // When the app begins, session is not connected*
        this.c8o = c8o;
        this._status = C8oSessionStatus.Disconnected;
        this.loginManager = new C8oManagerLogin(c8o);
        this.ignored = 0;
        this._user = new C8oSessionUser();
        this.mutex = new Semaphore(1);
        this.mutexNetwork = new Semaphore(10000000000);
        this.mutexCheckSession = new Semaphore(1);
    }

    /**
     * Get status of the session
     * 
     * @returns: C8oSessionStatus
     * 
     * Can be:
     * C8oSessionStatus.Connected
     * C8oSessionStatus.HasBeenConnected
     * C8oSessionStatus.HasBeenDisconnected
     * C8oSessionStatus.Disconnected
     * C8oSessionStatus.Ignore
     */
    public get status(): C8oSessionStatus {
        return this._status;
    }

    public set status(status:C8oSessionStatus) {
        this._status = status;
    }

    /**
     * Get status of the session
     * 
     * @returns: C8oSessionStatus
     * 
     * Can be:
     * C8oSessionStatus.Connected
     * C8oSessionStatus.HasBeenConnected
     * C8oSessionStatus.HasBeenDisconnected
     * C8oSessionStatus.Disconnected
     * C8oSessionStatus.Ignore
     */
    public get user(): C8oSessionUser {
        return this._user;
    }
    /**
     * Get previous status of the session
     * 
     * @returns: C8oSessionStatus
     * 
     * Can be:
     * C8oSessionStatus.Connected
     * C8oSessionStatus.HasBeenConnected
     * C8oSessionStatus.HasBeenDisconnected
     * C8oSessionStatus.Disconnected
     * C8oSessionStatus.Ignore
     */
    public get olduser(): C8oSessionUser {
        return this._olduser;
    }

    public set user(user: C8oSessionUser){
        this._olduser = user;
        this._user = user;
    }

    public async sort(response: any, headers: any, urlReq, parametersReq, headersReq, resolve = null) {
        // update _status if this is a sequence
        return new Promise(async (resolve, reject)=>{
                let _status: C8oSessionStatus = await this.defineSessionStatus(response, headers, urlReq, parametersReq, headersReq);
                switch (_status) {
                    case C8oSessionStatus.Connected:
                        this.ignored = 0;
                        resolve();
                        break;
                    case C8oSessionStatus.HasBeenConnected:
                        this.checkSession(headers, 0, resolve);
                        break;
                    case C8oSessionStatus.HasBeenDisconnected:
                        if(this.c8o.keepSessionAlive){
                            let objParams  = parametersReq.split('&')
                                            .reduce((a, c) => {
                                                let [key, value] = c.split('=');
                                                a[key] = value;
                                                return a;
                                            }, {});

                            if(!(objParams[C8oCore.SEQ_AUTO_LOGIN_OFF] === "true")){
                                this.loginManager.doLogin()
                                .then((res)=>{
                                    resolve(true);
                                })
                            }
                            else{
                                this.c8o.database.stopReplications(this.user.name);
                                this._user = new C8oSessionUser();
                                this.c8o.subscriber_session.next();
                                resolve();
                            }
                        }
                        else{
                            this.c8o.database.stopReplications(this.user.name);
                            this._user = new C8oSessionUser();
                            this.c8o.subscriber_session.next();
                            resolve();
                        }
                        break;
                    case C8oSessionStatus.Disconnected:
                        resolve();
                        break;
                    case C8oSessionStatus.Ignore:
                        this.ignored = this.ignored + 1;
                        if (this.ignored >= 20) {
                            this._status = C8oSessionStatus.Connected;
                            this.c8o.log._trace("[C8oManagerSession] We ingored 20, no setting _status Connected");
                        }
                        else {
                            this.c8o.log._trace("[C8oManagerSession] Ignore this request to analyze loss of session, we ignored " + this.ignored + " at total");
                        }
                        resolve();
                        break;
                }
            
        })
    }


    public async doAuthReachable(){
        if(this.c8o.session.user.authenticated == true){
            await this.mutex.acquire();
            let err;
            try {
                let user = await this.c8o.httpInterface.getUserServiceStatus()
                if(user.authenticated == false || err != undefined){
                    if(this.c8o.keepSessionAlive){
                        let success = await this.loginManager.doLogin();
                        if (success.status == false) {
                            
                            this._status = C8oSessionStatus.HasBeenDisconnected;
                            this.c8o.subscriber_session.next();
                            this.mutex.release();
                        }
                        else {
                            this.c8o.database.restartReplications(this.user.name)
                            this.checkSession(null, 0);
                            this.mutex.release();
                        }
                    }
                    else{
                        this.c8o.subscriber_session.next();
                        this.mutex.release();
                    }
                }
                else{
                    this._status = C8oSessionStatus.Connected;
                    this.c8o.database.restartReplications(this.user.name)
                    this.checkSession(null, 0);
                    await this.mutex.release();
                }
            }
            catch(e){
                this._status = C8oSessionStatus.HasBeenDisconnected;
                this.mutex.release();
            }
            
            
        }
    }
    /**
     * defineSessionStatus
     * 
     * if haderStatus is not null => we are connected
     * else if headerStatus is not null and this.id is not null, we has lost session
     * else we were never connected 
     * 
     * @param response the http header response
     */
    public async defineSessionStatus(response, headers, urlReq, parametersReq, headersReq) {
        // get session id sent by header
        let headerStatus = C8oUtilsCore.checkHeaderArgument(response, "x-convertigo-authenticated");
        if (headerStatus != null) {
            if (this.id != null || this._status == C8oSessionStatus.HasBeenConnected) {
                this._status = C8oSessionStatus.Connected;
                this.id = headerStatus;
                return C8oSessionStatus.Connected;
            }
            else {
                this.loginManager.setRequestLogin(urlReq, parametersReq, headersReq);
                this._status = C8oSessionStatus.HasBeenConnected;
                this.id = headerStatus;
                return C8oSessionStatus.HasBeenConnected;
            }
        }
        else {
            if (this.id != null) {
                let cancel = false;
                if (this._status == C8oSessionStatus.HasBeenConnected) {
                    let user;
                    try {
                        user = await this.c8o.httpInterface.getUserServiceStatus();
                        cancel = user != undefined ? user.authenticated : false;
                    }
                    catch(e){
                        cancel = false;
                    }
                    
                }
                if (!cancel) {
                    this._status = C8oSessionStatus.HasBeenDisconnected;
                    this.id = headerStatus;
                    return C8oSessionStatus.HasBeenDisconnected;
                }
                else {
                    return C8oSessionStatus.Ignore;
                }


            }
            else {
                this._status = C8oSessionStatus.Disconnected;
                this.id = headerStatus;
                return C8oSessionStatus.Disconnected;
            }
        }
    }

    private async checkUser() {
        let user : any = this._user;
        try {
             user = await this.c8o.httpInterface.getUserServiceStatus()
            if (this._user.name != user.user && this._user.name != "anonymous") {
                // remove & stop all replications for older user
                this.c8o.database.removeReplications(this._user.name);
                
            }
            this._user = new C8oSessionUser(user);
        }
        catch(e){
            this._status = C8oSessionStatus.HasBeenDisconnected;
        }
        finally{
            return user;
        }
        
        
           
        
        

    }

    public async checkSession(headers: any, time: number, resolve = null) {
        if(resolve == null){
            resolve = (()=>{});
        }
        clearTimeout(this.checker);
        this.checker = setTimeout(async () => {
            // get user informations
            let user = await this.checkUser();
            let _status = user != undefined ? user.authenticated : false;
            // if we are not anymore loggedin
            if (!_status) {
                this.c8o.log._debug("[C8oSessionManager] Session is not authenticated");
                // if we want to keepAlive session
                if (this.c8o.keepSessionAlive) {
                    // try to login
                    await this.mutex.acquire();
                    await this.mutex.release();
                    if(this._status == C8oSessionStatus.Connected || this._status == C8oSessionStatus.HasBeenConnected){
                        resolve(true);
                    }
                    else {
                        let success = await this.loginManager.doLogin();
                        if (success.status == false) {
                            this.c8o.database.stopReplications(this.user.name);
                            this._user = new C8oSessionUser();
                            this._status = C8oSessionStatus.HasBeenDisconnected;
                            this.c8o.subscriber_session.next();
                            resolve();
                        }
                        else {
                            this.checkSession(headers, 0, resolve);
                        }
                    }
                    
                }
                else {
                    this.c8o.database.stopReplications(this.user.name);
                    this._user = new C8oSessionUser();
                    this._status = C8oSessionStatus.HasBeenDisconnected;
                    this.c8o.subscriber_session.next();
                    resolve();
                }

            }
            else {
                // if we are still connected
                this._status = C8oSessionStatus.Connected;
                var funclistener = ()=> {
                    this.c8o.httpInterface.p1 = new Promise((resolve)=>{});
                    this.c8o.httpInterface.firstCall = true;
                    // safe delete previous Checker
                    try{
                        clearTimeout(this.checker);
                    }
                    catch(e){
                        
                    }
                    setTimeout(async ()=> {
                        this.mutex.acquire();
                        this.c8o.log.debug("[C8oSessionManager]: onResume checking user status");
                        let user = await this.checkUser();
                        let _status = user != undefined ? user.authenticated : false;
                        // if we are not anymore loggedin
                        if (!_status) {
                            this.c8o.log.debug("[C8oSessionManager]: onResume user is no longer logged");
                            if (this.c8o.keepSessionAlive) {
                                this.c8o.log.debug("[C8oSessionManager]: onResume keepAlive session activated, we will try to autologin");
                                this.c8o.session.status = C8oSessionStatus.HasBeenDisconnected;
                                // try to login
                                let success = await this.loginManager.doLogin();
                                if (success.status == false) {
                                    this.c8o.log.debug("[C8oSessionManager]: onResume autologin failed");
                                    this.c8o.database.stopReplications(this.user.name);
                                    this._user = new C8oSessionUser();
                                    this._status = C8oSessionStatus.HasBeenDisconnected;
                                    this.c8o.subscriber_session.next();
                                    this.mutex.release();
                                    this.c8o.httpInterface.p1 = Promise.resolve(true);
                                    resolve();
                                }
                                else {
                                    this.c8o.log.debug("[C8oSessionManager]: onResume autologin worked");
                                    this.mutex.release();
                                    this.checkSession(headers, 0, resolve);
                                    this.c8o.httpInterface.p1 = Promise.resolve(true);
                                }
                            }
                            else {
                                this.c8o.log.debug("[C8oSessionManager]: onResume stopping replications");
                                this.c8o.database.stopReplications(this.user.name);
                                this._user = new C8oSessionUser();
                                this._status = C8oSessionStatus.HasBeenDisconnected;
                                this.c8o.subscriber_session.next();
                                this.mutex.release();
                                resolve();
                            }
                        }
                        else{
                            this._status = C8oSessionStatus.Connected;
                            this.mutex.release();
                        }
                    }, 0);
                };

                try {
                    if(this.resumeListener != undefined){
                        document.removeEventListener("resume", this.resumeListener, false);
                    }
                }
                catch(e){   
                    console.log(e);
                }
                
                this.resumeListener = funclistener;
                document.addEventListener("resume",funclistener , false);
                
                
                this.c8o.database.restartReplications(this.user.name);
                let timeR = +user['maxInactive'] * 0.95 * 1000;
                if (this.c8o.keepSessionAlive) {
                    this.c8o.log._debug("[C8oSessionManager] Poling for session, next check will be in " + timeR + "ms");
                    this.checkSession(headers, timeR);
                    resolve();
                }
                else {
                    if (this.checker != undefined) {
                        try{
                            clearTimeout(this.checker);
                        }
                        catch(e){
                            
                        }
                    }
                    this.checker =
                        setTimeout(async () => {
                            this.c8o.database.stopReplications(this.user.name);
                            this._status = C8oSessionStatus.Disconnected;
                            this.c8o.subscriber_session.next();
                        }, timeR)
                        resolve();
                }
            }
        }, time)
    }


}