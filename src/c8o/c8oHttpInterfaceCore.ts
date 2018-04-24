import {C8oCore} from "./c8oCore";
import 'rxjs/add/operator/retry';
import { C8oResponseListener} from "./c8oResponse";
import {C8oProgress} from "./c8oProgress";

export abstract class C8oHttpInterfaceCore {
    c8o: C8oCore;
    timeout: number;
    firstCall: boolean = true;
    p1: Promise<Object>;
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
    abstract checkFile(parameters: Object): number;

    /**
     * Url encode parameters
     * @param {Object} parameters
     * @return {string}
     */
    abstract transformRequest(parameters: Object): string;

    /**
     * Transform FormData parameters
     * @param {Object} parameters
     * @return {FormData}
     */
    abstract transformRequestformdata(parameters: Object): FormData ;


    /**
     * Extract file from parameters and return and array containing a file and params
     * @param {Object} parameters
     * @return {any}
     */
    abstract transformRequestfileNative(parameters: Object): any;


    /**
     * Handle the request
     * @param {string} url
     * @param {Object} parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @return {Promise<any>}
     */
    abstract async handleRequest(url: string, parameters: Object, c8oResponseListener?: C8oResponseListener): Promise<any>;

    /**
     * Upload file with native plugin
     * @param {string} url
     * @param {Object} parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @return {Promise<any>}
     */
    abstract uploadFilePluginNative(url: string, parameters: Object, c8oResponseListener: C8oResponseListener):Promise<any>;

    /**
     * Make an http post
     * @param {string} url
     * @param {Object} parameters
     * @return {Promise<any>}
     */
    abstract httpPost(url: string, parameters: Object): Promise<any>;

    /**
     * Upload File using an Http client
     * @param {string} url
     * @param {FormData} form
     * @param {Object} parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @return {Promise<any>}
     */
    abstract uploadFileHttp(url: string, form: FormData, parameters: Object, c8oResponseListener: C8oResponseListener): Promise<any>;

    /**
     * Handle progress
     * @param event
     * @param {C8oProgress} progress
     * @param parameters
     * @param {C8oResponseListener} c8oResponseListener
     * @param {JSON} varNull
     */
    abstract handleProgress(event: any, progress: C8oProgress, parameters: any, c8oResponseListener: C8oResponseListener, varNull: JSON): void;
}