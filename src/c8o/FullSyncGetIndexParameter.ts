export class FullSyncGetIndexParameter {
    public static FIELDS: FullSyncGetIndexParameter = new FullSyncGetIndexParameter("fields");
    public static NAME: FullSyncGetIndexParameter = new FullSyncGetIndexParameter("name");
    public static DDOC: FullSyncGetIndexParameter = new FullSyncGetIndexParameter("ddoc");
    public static TYPE: FullSyncGetIndexParameter = new FullSyncGetIndexParameter("type");

    public name: string;

    constructor(name: string) {
        this.name = name;
    }
}
