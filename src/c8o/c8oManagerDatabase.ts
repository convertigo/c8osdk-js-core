import "rxjs/add/operator/retry";
import { C8oCore } from "./c8oCore";
import { C8oResponseListener, C8oResponseJsonListener } from "./c8oResponse";
import { C8oSessionStatus } from "./c8oSessionStatus";
import {C8oReplicationStatus} from "./C8oReplicationStatus";
import { C8oNetworkStatus } from "./c8oNetworkStatus";
import { Semaphore } from "./c8oUtilsCore";

declare const require: any;
export class C8oManagerDatabase {
    public c8o: C8oCore;
    private replications: Object;
    private mutexCreateReplication: Semaphore;

    constructor(c8o: C8oCore) {
        this.replications = new Object();
        this.c8o = c8o;
        this.mutexCreateReplication = new Semaphore(1);
    }

    public localName(baseName:string, log = false): string{
        if(this.c8o.prefixBase){
            if(log){
                this.c8o.log._trace("Database will be seteed with prefix of user name");
            }
            return this.c8o.session.user.name + "_"+ baseName;
        }
        else{
            return baseName;
        }
    }

    public get registeredReplications() {
        return this.replications;
    }

    /**
     * Register a request attaching it to the current user
     * @param listener The listener for this request
     * @param parameters The parameters of this request
     * @param type The type of réplication (SYNC, PULL, PUSH)
     */
    registerRequest(listener: C8oResponseListener, parameters: Object, type: string, fullSyncDatabase, handler = null) {
        let user = this.c8o.session.user;
        if (this.replications[user.name] == null) {
            this.replications[user.name] = new Array();
        }

        let authenticated: boolean = (this.c8o.session.status == (C8oSessionStatus.Connected || C8oSessionStatus.HasBeenConnected));
        let canceled: boolean = (this.c8o.network.status != C8oNetworkStatus.Reachable);
        let id = new Date().getTime()+"_"+(""+Math.random()).substring(2);
        let rep = new C8oReplicationStatus(user, listener, parameters, type, authenticated, canceled, false, fullSyncDatabase, id);
        handler = () => {
            rep.finished = true;
        }
        this.replications[user.name].push(rep);
        return [canceled, handler, id];
    }

    public cancelAndPopRequest(id){
        var user = this.c8o.session.user;
        for (var i in this.replications[user.name]) {
            if(this.replications[user.name][i].id == id){
                this.c8o.log._debug("[c8oManagerDatabase] cancelAndPopRequest => canceling  and removing replication: " +this.replications[user.name][i].database.getdatabase.name);
                let repToCancel = this.replications[user.name][i].database.syncFullSyncReplication.replication;
                repToCancel.cancel();
                this.replications[user.name].splice(i, 1);
                break;
            }
        }
        this.c8o.log._debug("[c8oManagerDatabase] cancelAndPopRequest => done, replication still actives: " +JSON.stringify(this.replications[user.name].map(x=> x.database.getdatabase.name)));
    }

    public cancelAllForbase(baseName){
        var user = this.c8o.session.user;
        for (var i in this.replications[user.name]) {
            if(this.replications[user.name][i].databaseName == baseName){
                this.replications[user.name].splice(i, 1);
            }
        }
    }

    /**
     * Restart all replications for a given user
     * @param user The name of the user
     */
    async restartReplications(user: string) {
        if (this.replications[user] != undefined) {
            var lastsDistinctsReps = {};
            this.replications[user].forEach((rep)=>{lastsDistinctsReps[rep.database.databaseName] = rep});
            this.replications[user] = Object.keys(lastsDistinctsReps).map(e => lastsDistinctsReps[e]);

            for(let i in lastsDistinctsReps){
                let rep =  lastsDistinctsReps[i];
                if (rep.database != null) {
                    if (rep.canceled == true) {
                        if (rep.finished != true) {
                            switch (rep.type) {
                                case "sync":
                                    this.mutexCreateReplication.acquire();
                                    this.c8o.log._trace("[restartStoppedReplications] restarting replication for database " + rep.database.getdatabseName + " and verb sync " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                                    let handler1 = () => {
                                        rep.finished = true;
                                    }
                                    rep.finished = false;
                                    rep.canceled = false;
                                    rep.database.startAllReplications(rep.parameters, rep.listener, handler1, rep.id, this.mutexCreateReplication);
                                    break;
                                case "push":
                                    this.mutexCreateReplication.acquire();
                                    this.c8o.log._trace("[restartStoppedReplications] restarting replication for database " + rep.database.getdatabseName + " and verb push " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                                    let handler2 = () => {
                                        rep.finished = true;
                                    }
                                    rep.finished = false;
                                    rep.canceled = false;
                                    rep.database.startPushReplication(rep.parameters, rep.listener, handler2, rep.id, this.mutexCreateReplication);

                                    break;
                                case "pull":
                                    this.mutexCreateReplication.acquire();
                                    this.c8o.log._trace("[restartStoppedReplications] restarting replication for database " + rep.database.getdatabseName + " and verb pull " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                                    let handler3 = () => {
                                        rep.finished = true;
                                    }
                                    rep.canceled = false;
                                    rep.finished = false;
                                    rep.database.startPullReplication(rep.parameters, rep.listener, handler3, rep.id, this.mutexCreateReplication);
                                    break;
                            }
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
                    if (rep.finished != true) {
                        switch (rep.type) {
                            case "sync":
                                this.c8o.log._trace("[stopReplications] stopping replication for database " + rep.database.getdatabseName + " and verb sync " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                                rep.canceled = true;
                                rep.database.cancelSyncReplication();
                                break;
                            case "push":
                                this.c8o.log._trace("[stopReplications] stopping replication for database " + rep.database.getdatabseName + " and verb push " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                                rep.canceled = true;
                                rep.database.cancelPushReplication();
                                break;
                            case "pull":
                                this.c8o.log._trace("[stopReplications] stopping replication for database " + rep.database.getdatabseName + " and verb pull " + (rep.parameters["continuous"] == true ? "in continous mode" : "since replication was not finished"));
                                rep.canceled = true;
                                rep.database.cancelPullReplication();
                                break;
                        }
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