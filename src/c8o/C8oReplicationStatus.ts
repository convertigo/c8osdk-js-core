import { C8oResponseListener } from "./c8oResponse";
import { C8oSessionUser } from "./C8oSessionUser";

export class C8oReplicationStatus{
    public user: C8oSessionUser;
    public listener: C8oResponseListener;
    public parameters: Object;
    public type: String;
    public authenticated: boolean;
    public canceled: boolean;
    public finished:boolean;
    database: any;
    constructor(user: C8oSessionUser, listener: C8oResponseListener, parameters: Object, type: string, authenticated: boolean, canceled: boolean,finished:boolean, fullSyncDatabase: any){
        this.user = user;
        this.listener = listener;
        this.parameters = parameters;
        this.type = type;
        this.authenticated = authenticated;
        this.canceled = canceled;
        this.database = fullSyncDatabase;
        this.finished = finished;
    }
}