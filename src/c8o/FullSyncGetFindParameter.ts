export class FullSyncGetFindParameter {
    public static SELECTOR: FullSyncGetFindParameter = new FullSyncGetFindParameter("selector");
    public static SORT: FullSyncGetFindParameter = new FullSyncGetFindParameter("sort");
    public static LIMIT: FullSyncGetFindParameter = new FullSyncGetFindParameter("limit");
    public static SKIP: FullSyncGetFindParameter = new FullSyncGetFindParameter("skip");
    public static USE_INDEX: FullSyncGetFindParameter = new FullSyncGetFindParameter("use_index");

    public name: string;

    constructor(name: string) {
        this.name = name;
    }
}
