
export  class C8oSessionUser{
    public authenticated: boolean = false;
    public groups = [];
    public maxInactive: number = 0;
    public sessionId: string = "";
    public name: string = "anonymous";
    public hash: string = "";

    constructor(user = null){
        if(user != null){
            this.authenticated = user["authenticated"] == true;
            this.groups = user["groups"] != undefined ? user["groups"] : [];
            this.maxInactive = user["maxInactive"] != undefined ? user["maxInactive"] : 0;
            this.sessionId = user["session"] != undefined ? user["session"] : "";
            this.name = user["user"] != undefined ? user["user"] : "";
        }
        
    }
}
