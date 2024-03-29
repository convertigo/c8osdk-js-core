import {C8oLogLevel} from "./c8oLogLevel";

export class C8oBase {
    /*HTTP*/
    protected _endpointSettings: string;
    protected _timeout: number = 3600000;
    protected _retry: number = 1;
    // protected _trustAllCertificates: boolean = false;
    protected _cookies: Object = {};
    protected _clientCertificateFiles: Object;
    protected _clientCertificateBinaries: Object;

    /*Log*/
    protected _logRemote: boolean = true;
    protected _initialLogRemote: boolean = true;
    protected _logLevelLocal: C8oLogLevel = C8oLogLevel.NONE;
    protected _logPouchDB: boolean = false;
    protected _logC8o: boolean = false;
    protected _logOnFail: (exception: Error, parameters: Object) => void;

    /* FullSync */
    protected _defaultDatabaseName: string = null;
    protected _authenticationCookieValue: string = null;
    protected _fullSyncLocalSuffix: string = null;
    protected _fullSyncServerUrl: string = "http://localhost:5984";
    protected _fullSyncUsername: string;
    protected _fullSyncPassword: string;

    /* Encryption */
    protected _useEncryption: boolean = false;
    protected _disableSSL: boolean = false;
    //noinspection JSUnusedGlobalSymbols
    protected _keyStorePassword: string;
    //noinspection JSUnusedGlobalSymbols
    protected _trustStorePassword: string;

    //Dates
    protected _normalizeParameters: boolean;

    //Dates
    protected _useworker: boolean = false;

    protected _keepSessionAlive: boolean = true;

    protected _errorConvertigoIntoFail: boolean = false;

    protected _resetBase: boolean = true;
    
    protected _prefixBase: boolean = false;

    protected _headers: Object = {};
    
    protected _initalLogLevel: Boolean;
    /** Getters **/

    /**
     * Gets if normalize parameters.<br/>
     * Default is <b>false</b>.
     * @returns The timeout.
     */
     public get usewroker(): boolean {
        return this._useworker;
    }

    /**
     * Gets if normalize parameters.<br/>
     * Default is <b>false</b>.
     * @returns The timeout.
     */
    public get normalizeParameters(): boolean {
        return this._normalizeParameters;
    }
    /**
     * Gets if session has to be keep alive.<br/>
     * Default is <b>true</b>.
     * @returns The KeepSessionAlive status.
     */
    public get keepSessionAlive(): boolean {
        return this._keepSessionAlive;
    }

    /**
     * Gets if error convertigo are thrown into fail.<br/>
     * Default is <b>false</b>.
     * @returns The errorConvertigoIntoFail status.
     */
    public get errorConvertigoIntoFail(): boolean {
        return this._errorConvertigoIntoFail;
    }
    

    /**
     * Gets if reset database is disabled.<br/>
     * Default is <b>true</b>.
     * @returns The disable reset base status.
     */
    public get resetBase(): boolean {
        return this._resetBase;
    }

    /**
     * Gets if we have to prefix databases with user name.<br/>
     * Default is <b>false</b>.
     * @returns The prefix base status.
     */
    public get prefixBase(): boolean {
        return this._prefixBase;
    }
    
    /**
     * Gets the connection timeout to Convertigo in milliseconds. A value of zero means the timeout is not used.<br/>
     * Default is <b>0</b>.
     * @returns The timeout.
     */
    public get timeout(): number {
        return this._timeout;
    }

    /**
     * Gets the http connection attempt before failing.<br/>
     * Default is <b>1</b>.
     * @returns The timeout.
     */
    public get retry(): number {
        return this._retry;
    }
    /**
     * Gets a value indicating whether https calls trust all certificates or not.<br/>
     * Default is <b>false</b>.
     * @returns <b>true</b> if https calls trust all certificates; otherwise, <b>false</b>.
     */
    /*public get trustAllCertificates(): boolean {
        return this._trustAllCertificates;
    }*/

    /**
     * Gets initial cookies to send to the Convertigo server.<br/>
     * Default is <b>null</b>.
     * @returns List of cookies.
     */
    public get cookies(): Object {
        return this._cookies;
    }

    /**
     * Gets a value indicating if logs are sent to the Convertigo server.<br/>
     * Default is <b>true</b>.
     * @returns <b>true</b> if logs are sent to the Convertigo server; otherwise, <b>false</b>.
     */
    public get logRemote(): boolean {
        return this._logRemote;
    }

    /**
     * Gets a value indicating if pouchDB logs are enabled.<br/>
     * Default is <b>false</b>.
     * @returns <b>true</b> if pouchDB logs are enabled; otherwise, <b>false</b>.
     */
    public get logPouchDB(): boolean {
        return this._logPouchDB;
    }

    /**
     * Gets a value indicating logs level local
     *
     * @returns C8oLogLevel object
     */
    public get logLevelLocal(): C8oLogLevel {
        return this._logLevelLocal;
    }

    public get logC8o(): boolean {
        return this._logC8o;
    }

    public get defaultDatabaseName(): string {
        return this._defaultDatabaseName;
    }

    public get authenticationCookieValue(): string {
        return this._authenticationCookieValue;
    }

    public get fullSyncLocalSuffix(): string {
        return this._fullSyncLocalSuffix;
    }

    //noinspection JSUnusedGlobalSymbols
    public get fullSyncServerUrl(): string {
        return this._fullSyncServerUrl;
    }

    //noinspection JSUnusedGlobalSymbols
    public get fullSyncUsername(): string {
        return this._fullSyncUsername;
    }

    //noinspection JSUnusedGlobalSymbols
    public get fullSyncPassword(): string {
        return this._fullSyncPassword;
    }

    public get logOnFail(): (exception: Error, parameters: Object) => void {
        return this._logOnFail;
    }

    /**
     * Gets the endpoint define in C8oSettings<br/>
     * @returns The current <b>endpoint</b>, if defined by c8oSettings.
     */
    public get endpoint(): string {
        return this._endpointSettings;
    }

    public get headers(): Object {
        return this._headers;
    }

    public copy(c8oBase: C8oBase) {
        if (c8oBase !== undefined) {
            /** HTTP **/
            this._timeout = c8oBase._timeout;
            this._retry = c8oBase._retry;
            // this._trustAllCertificates = c8oBase._trustAllCertificates;
            if (this.cookies == null) {
                this._cookies = {};
            }
            if (c8oBase.cookies !== null) {
                this._cookies = c8oBase._cookies;
            }

            /** Log **/
            this._logPouchDB = c8oBase.logPouchDB;
            this._logRemote = c8oBase.logRemote;
            this._initialLogRemote = c8oBase.logRemote;
            this._logLevelLocal = c8oBase.logLevelLocal;
            this._logC8o = c8oBase.logC8o;
            this._logOnFail = c8oBase.logOnFail;

            /** FullSync **/
            this._defaultDatabaseName = c8oBase.defaultDatabaseName;
            this._authenticationCookieValue = c8oBase.authenticationCookieValue;
            this._fullSyncLocalSuffix = c8oBase.fullSyncLocalSuffix;

            this._fullSyncServerUrl = c8oBase.fullSyncServerUrl;
            this._fullSyncUsername = c8oBase.fullSyncUsername;
            this._fullSyncPassword = c8oBase.fullSyncPassword;
            this._headers = c8oBase._headers;

            /** Date **/
            this._normalizeParameters = c8oBase._normalizeParameters;

            /**Keep ALive */
            this._keepSessionAlive = c8oBase._keepSessionAlive;

            /** Reset base */
            this._resetBase = c8oBase._resetBase;
            /** Reset base */
            this._prefixBase = c8oBase._prefixBase;
            this._errorConvertigoIntoFail = c8oBase._errorConvertigoIntoFail;
            this._useworker = c8oBase.usewroker;
            
        }
    }
}
