import "rxjs/add/operator/retry";
import { C8oCore } from "./c8oCore";
import { C8oProgress } from "./c8oProgress";
import { C8oResponseListener, C8oResponseJsonListener } from "./c8oResponse";
import { C8oFullSyncCbl } from "./c8oFullSync";
import { C8oHttpRequestException } from "./Exception/c8oHttpRequestException";

import { C8oExceptionMessage } from "./Exception/c8oExceptionMessage";
import { Observable } from "rxjs";
import { url } from 'inspector';
import { C8oSessionStatus } from "./c8oSessionStatus";
import { C8oReplicationStatus } from "./C8oReplicationStatus";
import { C8oNetworkStatus } from "./C8oNetworkStatus";

declare const require: any;
export class C8oManagerDatabase {
    public c8o: C8oCore;
    private replications: Object;

    constructor(c8o: C8oCore) {
        this.replications = new Object();
        this.c8o = c8o;
    }

    public get registeredReplications(){
        return this.replications;
    }

    /**
     * Register a request attaching it to the current user
     * @param listener The listener for this request
     * @param parameters The parameters of this request
     * @param type The type of réplication (SYNC, PULL, PUSH)
     */
    registerRequest(listener: C8oResponseListener, parameters: Object, type: string,fullSyncDatabase, handler =null) {
        let user = this.c8o.session.user;
            if (this.replications[user.name] == null) {
                this.replications[user.name] = new Array();
            }
            
            let authenticated: boolean = (this.c8o.session.status == (C8oSessionStatus.Connected || C8oSessionStatus.HasBeenConnected));
            let canceled: boolean = (this.c8o.network.status != C8oNetworkStatus.Reachable);
            let rep = new C8oReplicationStatus(user, listener, parameters, type, authenticated, canceled, false,fullSyncDatabase);
            handler = ()=>{
                rep.finished = true;       
            }
            this.replications[user.name].push(rep);
            return [canceled, handler];
    }

    /**
     * Restart all replications for a given user
     * @param user The name of the user
     */
    restartReplications(user: string) {
        if (this.replications[user] != undefined) {
            for (let rep of this.replications[user]) {
                if (rep.database != null) {
                    if(rep.canceled == true){
                        switch (rep.type) {
                            case "sync":
                                this.c8o.log._trace("restartStoppedReplications] restarting replication for database " + rep.database.getdatabseName + " and verb sync " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                                let handler1 = ()=>{
                                    rep.finished = true;       
                                }
                                rep.database.startAllReplications(rep.parameters, rep.listener, handler1);
                                rep.canceled = false;
                                break;
                            case "push":
                                this.c8o.log._trace("[restartStoppedReplications] restarting replication for database " + rep.database.getdatabseName + " and verb push " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                                let handler2 = ()=>{
                                    rep.finished = true;       
                                }
                                rep.database.startPushReplication(rep.parameters, rep.listener, handler2);
                                rep.canceled = false;
                                break;
                            case "pull":
                                this.c8o.log._trace("[restartStoppedReplications] restarting replication for database " + rep.database.getdatabseName + " and verb pull " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                                let handler3 = ()=>{
                                    rep.finished = true;       
                                }
                                rep.database.startPullReplication(rep.parameters, rep.listener, handler3);
                                rep.canceled = false;
                                break;
                        }
                    }
                }

            }
        }

    }

    /**
     * Stop all replications for a given user
     * @param user The name of the user
     */
    stopReplications(user: string) {
        if (this.replications[user] != undefined) {
            for (let rep of this.replications[user]) {
                if (rep.database != null) {
                    switch (rep.type) {
                        case "sync":
                            this.c8o.log._trace("[stopReplications] stopping replication for database " + rep.database.getdatabseName + " and verb sync " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                            rep.database.cancelSyncReplication();
                            rep.canceled = true;
                            break;
                        case "push":
                            this.c8o.log._trace("[stopReplications] stopping replication for database " + rep.database.getdatabseName + " and verb push " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                            rep.database.cancelPushReplication();
                            rep.canceled = true;
                            break;
                        case "pull":
                            this.c8o.log._trace("[stopReplications] stopping replication for database " + rep.database.getdatabseName + " and verb pull " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                            rep.database.cancelPullReplication();
                            rep.canceled = true;
                            break;
                    }
                }
            }
        }
    }

    /**
     * Remove state an delte top all replications for a given user
     * @param user The name of the user
     */
    removeReplications(user: string) {
        this.stopReplications(user);
        delete this.replications[user];
        this.c8o.log._trace("[removeReplications] replications for user " + user + "has been removed and stopped");
    }

}