import "rxjs/add/operator/retry";
import {C8oCore} from "./c8oCore";
import {C8oProgress} from "./c8oProgress";
import { C8oResponseListener, C8oResponseJsonListener} from "./c8oResponse";
import { C8oFullSyncCbl } from "./c8oFullSync";
import { C8oHttpRequestException } from "./Exception/c8oHttpRequestException";

import { C8oExceptionMessage } from "./Exception/c8oExceptionMessage";
import { Observable } from "rxjs";
import { url } from 'inspector';
import { C8oSessionStatus } from './c8oSessionStatus';

declare const require: any;
export class C8oManagerLogin {
    public c8o: C8oCore;
    private requestLogin;
    
    constructor(c8o: C8oCore) {
        this.c8o = c8o;
    }
    public setRequestLogin(url: string, parameters: Object, headers: Object){
        this.requestLogin = {url: url, parameters: parameters, headers: headers};
    }

    public doLogin(): Promise<any>{
        return new Promise((res)=>{
            if(this.requestLogin !=  undefined){
                let resolve = (response)=>{
                    this.c8o.log._debug("[C8oManagerLogin] Auto Logins works");
                    res({status:true, urlReq:this.requestLogin.url, parameters:this.requestLogin.parameters, headers: this.requestLogin.headers, response: response});
                }
                let reject = (err)=>{
                    this.c8o.log._debug("[C8oManagerLogin] Auto Logins failed");
                    res({status:false});
                    this.c8o.subscriber_session.next();
                }
                this.c8o.httpInterface.execHttpPosts(this.requestLogin.url, this.requestLogin.parameters, this.requestLogin.headers, resolve, reject);
            } 
        })
         
    }

    

    
}