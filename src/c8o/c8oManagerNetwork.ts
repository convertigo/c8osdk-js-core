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
        //this.c8o.log.warn("through set network status")
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


    private async listen() {
        window.addEventListener("online", () => {
            this.processOnline();

        }, false);
        window.addEventListener("offline", () => {
            this.processOffline();
        }, false);

        this.c8o.subscriber_network.subscribe(async (res)=>{
            this.c8o.log._debug("[handleNetworkEvents] Handle a network event: " + res);
            switch(res){
                case C8oNetworkStatus.Reachable:
                    // check session status              
                    this.c8o.session.doAuthReachable();
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
}