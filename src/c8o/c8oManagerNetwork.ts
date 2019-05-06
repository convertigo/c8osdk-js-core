import { C8oCore } from "./c8oCore";

import { C8oNetworkStatus } from "./c8oNetworkStatus"

export class C8oManagerNetwork {
    private c8o: C8oCore;
    private _status: C8oNetworkStatus;

    constructor(c8o: C8oCore) {
        this.c8o = c8o;
    }

    /**
     * init NetworkManager
     */
    public async init(){
        this.listen();
        let reachable = await this.checkReachable();
        let online = window.navigator.onLine;
        this.status = (reachable == true ? C8oNetworkStatus.Reachable : (online == true? C8oNetworkStatus.NotReachable : C8oNetworkStatus.Offline));
    }

    /**
     * Set network status, and notify if its had change
     * @params c8oNetworkStatus : C8oNetworkStatus
     */
    public set status(c8oNetworkStatus: C8oNetworkStatus){
        // if the status has not changed do nothing
        if(this._status == c8oNetworkStatus){
                return;    
        }
        this._status = c8oNetworkStatus;
        this.c8o.subscriber_network.next(c8oNetworkStatus);
        
    }

    /**
     * get network status
     * 
     * @returns C8oNetworkStatus
     */
    public get status(){
        return this._status;
    }


    private listen() {
        window.addEventListener("online", () => {
            this.processOnline();

        }, false);
        window.addEventListener("offline", () => {
            this.processOffline();
        }, false);

        this.c8o.subscriber_network.subscribe((res)=>{
            this.c8o.log._debug("[handleNetworkEvents] Handle a network event: " + res);
            switch(res){
                case C8oNetworkStatus.Reachable:
                    this.c8o.database.restartReplications(this.c8o.session.user.name);
                    this.c8o.database.restartReplications("anonymous");
                break;
                case C8oNetworkStatus.NotReachable:
                    this.c8o.database.stopReplications(this.c8o.session.user.name);
                    this.c8o.database.stopReplications("anonymous");
                break;
                case C8oNetworkStatus.Offline:
                    this.c8o.database.stopReplications(this.c8o.session.user.name);
                    this.c8o.database.stopReplications("anonymous");
                break;
            }
        });
    }


    private async processOnline(){
        let reachable = await this.checkReachable();
        if(reachable){
            this.status = C8oNetworkStatus.Reachable;
        }
        else{
            this.status = C8oNetworkStatus.NotReachable;
        }
    }

    private async processOffline(){
        this.status = C8oNetworkStatus.Offline;
    }

    public async checkReachable(): Promise<boolean> {
        try {
            let r = await this.c8o.c8oLogger.logTest();
            return true;
        }
        catch{
            return false;
        }
    }

/*
    private processOnlines(resolve = null) {
        // if c8o object has been init
        if (this.c8o.promiseFinInit != null) {
            this.c8o.finalizeInit().then(() => {
                // Test if endpoint is reachable
                this.c8o.c8oLogger.logTest()
                    .then(() => {
                        this.status = 

                        if (!this.reachable) {
                            this.reachable = true;
                            if (this._initalLogLevel) {
                                this._logRemote = true;
                            }
                            this.log.info("Network online and enpoint reachable");
                            this.httpInterface.firstcheckSessionR = false;
                            if (this._initialLogRemote) {// && !this.logRemote) {
                                this.logRemote = true;
                                this.log.info("[C8o][online] setting remote logs to true");
                            }
                            this.log.info("[C8o][online] We will check for an existing session");
                            this.httpInterface.checkSessionOnce();
                            this.subscriber_network.next({ status: "reachable", "description": "We are online, and endpoint is reachable" });
                        }
                        if (resolve != undefined) {
                            resolve()
                        }
                    })
                    .catch(() => {
                        this.reachable = false;
                        this._logRemote = false;
                        if (this.logOnFail != null) {
                            this.logOnFail(new C8oException(C8oExceptionMessage.RemoteLogFail()), null);
                        }
                        this.log.info("[C8o] Network online, but we cannot reach endpoint");
                        this.c8oLogger.info("[C8o] Setting remote logs to false");
                        (this.c8oFullSync as C8oFullSyncCbl).cancelActiveReplications();
                        if (navigator["onLine"]) {
                            //event onLine not reachable
                            this.subscriber_network.next({ status: "notReachable", "description": "We are online, but endpoint is not reachable" });
                        }
                        else {
                            this.subscriber_network.next({ status: "offline", "description": "We are offline" });
                        }
                    })
            });
        }
    }*/

}