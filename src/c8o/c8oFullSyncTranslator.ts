import {FullSyncAbstractResponse, FullSyncDefaultResponse} from "./fullSyncResponse";
export class C8oFullSyncTranslator {
    public static FULL_SYNC_RESPONSE_KEY_COUNT: string = "count";
    public static FULL_SYNC_RESPONSE_KEY_ROWS: string = "rows";
    public static FULL_SYNC_RESPONSE_KEY_CURRENT: string = "current";
    public static FULL_SYNC_RESPONSE_KEY_DIRECTION: string = "direction";
    public static FULL_SYNC_RESPONSE_KEY_TOTAL: string = "total";
    public static FULL_SYNC_RESPONSE_KEY_OK: string = "ok";
    public static FULL_SYNC_RESPONSE_KEY_STATUS: string = "status";

    public static FULL_SYNC_RESPONSE_VALUE_DIRECTION_PUSH: string = "push";
    public static FULL_SYNC_RESPONSE_VALUE_DIRECTION_PULL: string = "pull";

    public static XML_KEY_DOCUMENT: string = "document";
    public static XML_KEY_COUCHDB_OUTPUT: string = "couchdb_output";

    public static fullSyncDocumentOperationResponseToJson(fullSyncDocumentOperationResponse: FullSyncAbstractResponse): JSON {
        return fullSyncDocumentOperationResponse.getProperties() as JSON;
    }

    public static fullSyncDefaultResponseToJson(fullSyncDefaultResponse: FullSyncDefaultResponse): JSON {
        return fullSyncDefaultResponse.getProperties() as JSON;
    }

}
