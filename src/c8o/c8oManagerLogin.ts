import "rxjs/add/operator/retry";
import {C8oCore} from "./c8oCore";
import { C8oSessionStatus } from "./c8oSessionStatus";
import { Semaphore } from './c8oUtilsCore';

declare const require: any;
export class C8oManagerLogin {
    public c8o: C8oCore;
    private requestLogin;
    private mutexL : Semaphore;
    
    constructor(c8o: C8oCore) {
        this.c8o = c8o;
        this.mutexL = new Semaphore(1);
    }
    public setRequestLogin(url: string, parameters: Object, headers: Object){
        this.requestLogin = {url: url, parameters: parameters, headers: headers};
    }

    public doLogin(): Promise<any>{
        return new Promise((res)=>{
            this.mutexL.acquire();
            if(!(this.c8o.session.status == C8oSessionStatus.Connected || this.c8o.session.status == C8oSessionStatus.HasBeenConnected)){
                if(this.requestLogin !=  undefined){
                    let resolve = (response)=>{
                        if(response.headers.get("X-Convertigo-Authenticated") != undefined){
                            this.c8o.log._debug("[C8oManagerLogin] Auto Logins works");
                            this.c8o.subscriber_login.next({status:true, response: response.body, error: null})
                            res({status:true, urlReq:this.requestLogin.url, parameters:this.requestLogin.parameters, headers: this.requestLogin.headers, response: response.response});
                        }
                        else{
                            this.c8o.log._debug("[C8oManagerLogin] Auto Logins failed");
                            res({status:false});
                            this.c8o.subscriber_login.next({status:false, response: response.body, error: "error, we are not authenticated"})
                            //this.c8o.subscriber_session.next();
                        }
                        this.mutexL.release();
                        
                    }
                    let reject = (err)=>{
                        this.c8o.log._debug("[C8oManagerLogin] Auto Logins failed");
                        res({status:false});
                        this.c8o.subscriber_login.next({status:false, response: null, error: err})
                        this.c8o.subscriber_session.next();
                        this.mutexL.release();
                    }
                    this.c8o.httpInterface.execHttpPosts(this.requestLogin.url, this.requestLogin.parameters, this.requestLogin.headers, resolve, reject, true);
                } 
            }
            else{
                this.c8o.log.warn("Into else");
            }
             
        })
         
    }

    

    
}