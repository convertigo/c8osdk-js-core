import "rxjs/add/operator/retry";
import {C8oCore} from "./c8oCore";
import {C8oProgress} from "./c8oProgress";
import { C8oResponseListener} from "./c8oResponse";

export abstract class C8oHttpInterfaceCore {
    public c8o: C8oCore;
    public timeout: number;
    public firstCall: boolean = true;
    public p1: Promise<Object>;
    protected _isCordova = null;

    constructor(c8o: C8oCore) {
        this.c8o = c8o;
        this.timeout = this.c8o.timeout;
    }

    /**
     * Check type of file given in parameters
     * 0 : No file to upload
     * 1 : FileList
     * 2 : url when running in cordova
     * @param {Object} parameters
     * @return {number}
     */
    public abstract checkFile(parameters: Object): number;

    /**
     * Url encode parameters
     * @param {Object} parameters
     * @return {string}
     */
    public abstract transformRequest(parameters: Object): string;

    /**
     * Transform FormData parameters
     * @param {Object} parameters
     * @return {FormData}
     */
    public abstract transformRequestformdata(parameters: Object): FormData ;

    /**
     * Extract file from parameters and return and array containing a file and params
     * @param {Object} parameters
     * @return {any}
     */
    public abstract transformRequestfileNative(parameters: Object): any;

    /**
     * Handle the request
     * @param {string} url
     * @param {Object} parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @return {Promise<any>}
     */
    public abstract async handleRequest(url: string, parameters: Object, c8oResponseListener?: C8oResponseListener): Promise<any>;

    /**
     * Upload file with native plugin
     * @param {string} url
     * @param {Object} parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @return {Promise<any>}
     */
    public abstract uploadFilePluginNative(url: string, parameters: Object, c8oResponseListener: C8oResponseListener): Promise<any>;

    /**
     * Make an http post
     * @param {string} url
     * @param {Object} parameters
     * @return {Promise<any>}
     */
    public abstract httpPost(url: string, parameters: Object): Promise<any>;

    /**
     * Upload File using an Http client
     * @param {string} url
     * @param {FormData} form
     * @param {Object} parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @return {Promise<any>}
     */
    public abstract uploadFileHttp(url: string, form: FormData, parameters: Object, c8oResponseListener: C8oResponseListener): Promise<any>;

    /**
     * Handle progress
     * @param event
     * @param {C8oProgress} progress
     * @param parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @param {JSON} varNull
     */
    public abstract handleProgress(event: any, progress: C8oProgress, parameters: any, c8oResponseListener: C8oResponseListener, varNull: JSON): void;
}
