import {C8oCore} from "./c8oCore";

export class FullSyncPostDocumentParameter {
    public static POLICY: FullSyncPostDocumentParameter = new FullSyncPostDocumentParameter(C8oCore.FS_POLICY);
    public static SUBKEY_SEPARATOR: FullSyncPostDocumentParameter = new FullSyncPostDocumentParameter(C8oCore.FS_SUBKEY_SEPARATOR);

    public name: string;

    constructor(name: string) {
        this.name = name;
    }

    public static values(): FullSyncPostDocumentParameter[] {
        const array: FullSyncPostDocumentParameter[] = [];
        array.push(this.POLICY, this.SUBKEY_SEPARATOR);
        return array;
    }

}
