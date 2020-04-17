import "rxjs/add/operator/retry";
import {C8oCore} from "./c8oCore";
import { C8oSessionStatus } from "./c8oSessionStatus";
import { Semaphore, C8oUtilsCore } from './c8oUtilsCore';

declare const require: any;
export class C8oManagerLogin {
    public c8o: C8oCore;
    private requestLogin;
    private mutexL : Semaphore;
    
    constructor(c8o: C8oCore) {
        this.c8o = c8o;
        this.mutexL = new Semaphore(1);
    }
    public async setRequestLogin(url: string, parameters: Object, headers: Object, id: string){
        if(url != null && parameters != null && headers != null){
            this.requestLogin = {url: url, parameters: parameters, headers: headers};
        }
        if(id != null && this.requestLogin != undefined){
        /**  must encrypt and save requestLogin there **/

        //define buffer to save
        const data = Buffer.from(JSON.stringify(this.requestLogin), 'utf-8');
        // generate random iv and store it
        const iv: any = crypto.getRandomValues(new Uint8Array(16));
        window["localStorage"]["setItem"]("_c8o_iv", Buffer.from(iv).toString('utf-8'));
        // get key and hash it 128 bits
        const key = C8oUtilsCore.MD5ArrayBuffer(id);
        // defined key
        const key_encoded = await crypto.subtle.importKey(  "raw",    <any>key.buffer,   'AES-CTR' ,  false,   ["encrypt", "decrypt"]);
        // encrypt data
        const encrypted_content = await window.crypto.subtle.encrypt(
            {
              name: "AES-CTR",
              counter: iv,
              length: 128
            },
            key_encoded,
            data
        );
        // store encrypted data
        window.localStorage.setItem("_c8o_secret", Buffer.from(encrypted_content).toString('utf-8'));
        }    
    }
    public async defineRequestLogin(id){
        //if requestLogin is'nt into this.requestLogin, get it and assign it to requestLogin from local encrypted data.
        try{
            if(this.requestLogin == undefined && window["localStorage"]["getItem"]("_c8o_secret") != undefined){
                const iv: any = Buffer.from(window["localStorage"]["getItem"]("_c8o_iv"), 'utf-8');
                const key = C8oUtilsCore.MD5ArrayBuffer(id);
                const encrypted_content = Buffer.from(window.localStorage.getItem("_c8o_secret"), 'utf-8');
                const key_encoded = await crypto.subtle.importKey(  "raw",    <any>key.buffer,   'AES-CTR' ,  false,   ["encrypt", "decrypt"]);
                const decrypted_content: any  = await window.crypto.subtle.decrypt(
                    {
                      name: "AES-CTR",
                      counter: iv,
                      length: 128
                    },
                    key_encoded,
                    encrypted_content
                );
                this.requestLogin = JSON.parse(Buffer.from(decrypted_content).toString('utf-8'));
            }
        }
        catch(e){
            console.dir(e);
            debugger;
        }
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