import {C8oCore} from "./c8oCore";
import {C8oResponseListener} from "./c8oResponse";
import {C8oUtils} from "./c8oUtilsCore";
import {C8oException} from "./Exception/c8oException";
import {C8oExceptionMessage} from "./Exception/c8oExceptionMessage";
import {FullSyncRequestable} from "./fullSyncRequestable";

export class C8oFullSync {
    private static FULL_SYNC_URL_PATH: string = "/fullsync/";
    /**
     * The project requestable value to execute a fullSync request.
     */
    public static FULL_SYNC_PROJECT: string = "fs://";
    public static FULL_SYNC__ID: string = "_id";
    public static FULL_SYNC__REV: string = "_rev";
    public static FULL_SYNC__ATTACHMENTS: string = "_attachments";

    c8o: C8oCore;
    protected fullSyncDatabaseUrlBase: string;
    protected localSuffix: string;

    public constructor(c8o: C8oCore) {
        this.c8o = c8o;
        this.fullSyncDatabaseUrlBase = c8o.endpointConvertigo + C8oFullSync.FULL_SYNC_URL_PATH;
        this.localSuffix = (c8o.fullSyncLocalSuffix !== null) ? c8o.fullSyncLocalSuffix : "_device";
    }

    /**
     * Handles a fullSync request.<br/>
     * It determines the type of the request thanks to parameters.
     *
     * @param _parameters
     * @param listener
     * @return promise<any>
     * @throws C8oException
     */
    public async handleFullSyncRequest(_parameters: Object, listener: C8oResponseListener): Promise<any> {
        let parameters = {};
        for(let val in _parameters){
            if(_parameters[val] instanceof Blob != true){
                //if it's not a blob then stringify and parse the value to make some values like true case insensitive ( from string to boolean)
                parameters[val] = JSON.parse(JSON.stringify(_parameters[val]));
            }
            else{
                parameters[val] = _parameters[val];
            }
        }
        let projectParameterValue: string = C8oUtils.peekParameterStringValue(parameters, C8oCore.ENGINE_PARAMETER_PROJECT, true);
        if (!projectParameterValue.startsWith(C8oFullSync.FULL_SYNC_PROJECT)) {
            throw new C8oException(C8oExceptionMessage.invalidParameterValue(projectParameterValue, "its don't start with" + C8oFullSync.FULL_SYNC_PROJECT));
        }
        let fullSyncRequestableValue: string = C8oUtils.peekParameterStringValue(parameters, C8oCore.ENGINE_PARAMETER_SEQUENCE, true);

        //  get rid of the optional trailing #RouteHint present in the sequence
        if (fullSyncRequestableValue.indexOf("#") !== -1)
            fullSyncRequestableValue = fullSyncRequestableValue.substring(0, fullSyncRequestableValue.indexOf("#"));

        let fullSyncRequestable: FullSyncRequestable = FullSyncRequestable.getFullSyncRequestable(fullSyncRequestableValue);
        if (fullSyncRequestable === null) {
            throw new C8oException(C8oExceptionMessage.invalidParameterValue(C8oCore.ENGINE_PARAMETER_PROJECT, C8oExceptionMessage.unknownValue("fullSync requestable", fullSyncRequestableValue)));
        }
        let databaseName: string = projectParameterValue.substring(C8oFullSync.FULL_SYNC_PROJECT.length);
        if (databaseName.length < 1) {
            databaseName = this.c8o.defaultDatabaseName;
            if (databaseName === null) {
                throw new C8oException(C8oExceptionMessage.invalidParameterValue(C8oCore.ENGINE_PARAMETER_PROJECT, C8oExceptionMessage.missingValue("fullSync database name")));
            }
        }

        let response: any;
        return new Promise((resolve, reject) => {
            fullSyncRequestable.handleFullSyncRequest(this, databaseName, parameters, listener).then((result) => {
                response = result;
                if (response === null || response === undefined) {
                    reject(new C8oException(C8oExceptionMessage.couchNullResult()));
                }
                resolve(this.handleFullSyncResponse(response, listener));
            }).catch((error) => {
                if (error instanceof C8oException) {
                    reject(error);
                }
                else {
                    reject(new C8oException(C8oExceptionMessage.FullSyncRequestFail(), error));
                }
            });
        });
    }

    //noinspection JSUnusedLocalSymbols
    /**
     *
     * @param response
     * @param listener
     * @return response
     * @throws C8oException Failed to parse response.
     */
    handleFullSyncResponse(response: any, listener: C8oResponseListener): any {
        return response;
    }

    /**
     * Checks if request parameters correspond to a fullSync request.
     */
    static isFullSyncRequest(requestParameter: Object): boolean {
        if (C8oUtils.getParameterStringValue(requestParameter, C8oCore.ENGINE_PARAMETER_PROJECT, false) !== null) {
            return C8oUtils.getParameterStringValue(requestParameter, C8oCore.ENGINE_PARAMETER_PROJECT, false).startsWith(C8oFullSync.FULL_SYNC_PROJECT);
        }
        else {
            return false;
        }
    }

}