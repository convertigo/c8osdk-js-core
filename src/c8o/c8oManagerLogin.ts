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

    private static toUint8Array(data: ArrayBuffer | ArrayBufferView): Uint8Array<ArrayBuffer>{
        const source = data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : data instanceof Uint8Array
                ? data
                : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        const normalized = new Uint8Array(source.byteLength);
        normalized.set(source);
        return normalized;
    }

    private static toBase64(data: ArrayBuffer | ArrayBufferView): string{
        const bytes = C8oManagerLogin.toUint8Array(data);
        let binary = "";
        for(let i = 0; i < bytes.length; i++){
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    private static fromBase64(base64: string): Uint8Array<ArrayBuffer>{
        const binary = window.atob(base64);
        const bytes = new Uint8Array(binary.length);
        for(let i = 0; i < binary.length; i++){
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    public async setRequestLogin(url: string, parameters: Object, headers: Object, id: string){
        if(url != null && parameters != null && headers != null){
            this.requestLogin = {url: url, parameters: parameters, headers: headers};
        }
        if(id != null && this.requestLogin != undefined){
        /**  must encrypt and save requestLogin there **/

        //define buffer to save
        const data = new TextEncoder().encode(JSON.stringify(this.requestLogin));
        // generate random iv and store it
        const iv = crypto.getRandomValues(new Uint8Array(16));
        window["localStorage"]["setItem"]("_c8o_iv", C8oManagerLogin.toBase64(iv));
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
        window.localStorage.setItem("_c8o_secret", C8oManagerLogin.toBase64(encrypted_content));
        }    
    }
    public async defineRequestLogin(id){
        //if requestLogin is'nt into this.requestLogin, get it and assign it to requestLogin from local encrypted data.
        try{
            if(this.requestLogin == undefined && window["localStorage"]["getItem"]("_c8o_secret") != undefined){
                const ivStored = window["localStorage"]["getItem"]("_c8o_iv");
                if(ivStored == null){
                    return;
                }
                const iv = C8oManagerLogin.fromBase64(ivStored);
                const key = C8oUtilsCore.MD5ArrayBuffer(id);
                const encryptedStored = window.localStorage.getItem("_c8o_secret");
                if(encryptedStored == null){
                    return;
                }
                const encrypted_content = C8oManagerLogin.fromBase64(encryptedStored);
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
                this.requestLogin = JSON.parse(new TextDecoder().decode(C8oManagerLogin.toUint8Array(decrypted_content)));
            }
        }
        catch(e){
            this.c8o.log.error("[C8oManagerLogin][defineRequestLogin], failed to define request login", e);
        }
    }
    

    public doLogin(): Promise<any>{
        return new Promise((res)=>{
            this.mutexL.acquire();
            if(!(this.c8o.session.status == C8oSessionStatus.Connected || this.c8o.session.status == C8oSessionStatus.HasBeenConnected)){
                if(this.requestLogin !=  undefined){
                    let resolve = (response)=>{
                        if(response.headers.get("X-Convertigo-Authenticated") != undefined){
                            this.c8o.log._debug("[C8oManagerLogin] Auto Logins worked");
                            this.c8o.subscriber_login.next({status:true, response: response.body, error: null})
                            res({status:true, urlReq:this.requestLogin.url, parameters:this.requestLogin.parameters, headers: this.requestLogin.headers, response: response.response});
                        }
                        else{
                            this.c8o.log._debug("[C8oManagerLogin] Auto Logins failed");
                            res({status:false});
                            this.c8o.subscriber_login.next({status:false, response: response.body, error: "error, we are not authenticated"})
                            this.c8o.subscriber_session.next(null);
                        }
                        this.mutexL.release();
                        
                    }
                    let reject = (err)=>{
                        this.c8o.log._debug("[C8oManagerLogin] Auto Logins failed");
                        res({status:false});
                        this.c8o.subscriber_login.next({status:false, response: null, error: err})
                        this.c8o.subscriber_session.next(null);
                        this.mutexL.release();
                    }
                    this.c8o.httpInterface.execHttpPosts(this.requestLogin.url, this.requestLogin.parameters, this.requestLogin.headers, resolve, reject, true);
                }
                else{
                    this.c8o.log._debug("[C8oManagerLogin] Auto Logins failed: requestLogin is undefined");
                    this.c8o.subscriber_login.next({status:false, response: null, error: "requestLogin is undefined"});
                    this.c8o.subscriber_session.next(null);
                    res({status:false, error: "requestLogin is undefined"});
                    this.mutexL.release();
                }
            }
            else{
                this.c8o.log.warn("[C8oManagerLogin] Auto Logins skipped: already connected");
                this.c8o.subscriber_login.next({status:false, response: null, error: "already connected"});
                res({status:false, error: "already connected"});
                this.mutexL.release();
            }
             
        })
         
    }

    

    
}
