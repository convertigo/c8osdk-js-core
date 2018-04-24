export class FullSyncReplication {
    public pull: boolean;
    public sync: boolean;
    public replication: any;
    //noinspection JSUnusedGlobalSymbols
    public changeListener: Event;

    constructor(pull: boolean = null) {
        if (pull != null) {
            this.pull = pull;
        } else {
            this.sync = true;
        }
    }
}
