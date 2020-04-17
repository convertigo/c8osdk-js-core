// @dynamic
export class C8oUtilsCore {

    /** FullSync parameters prefix. **/
    private static USE_PARAMETER_IDENTIFIER: string = "_use_";
    public data: JSON;

    public constructor() {
    }

    /**
     * Returns the class name of the object as a String, if the object is null then returns the String "null".
     *
     * @param object
     * @returns string
     */
    public static getObjectClassName(object: any) {
        return typeof object;
    }

    public static isValidUrl(url: string): boolean {
        return /^(http|https):\/\/[^ "]+$/.test(url.toString());
    }

    /**
     * returns 128 bits hash using MD5 algo 
     * @param str any string
     */
    public static MD5(str: string):string{
        const MD5 = (d) => {var r = M(V(Y(X(d),8*d.length)));return r.toLowerCase()};function M(d){for(var _,m="0123456789ABCDEF",f="",r=0;r<d.length;r++)_=d.charCodeAt(r),f+=m.charAt(_>>>4&15)+m.charAt(15&_);return f}function X(d){for(var _=Array(d.length>>2),m=0;m<_.length;m++)_[m]=0;for(m=0;m<8*d.length;m+=8)_[m>>5]|=(255&d.charCodeAt(m/8))<<m%32;return _}function V(d){for(var _="",m=0;m<32*d.length;m+=8)_+=String.fromCharCode(d[m>>5]>>>m%32&255);return _}function Y(d,_){d[_>>5]|=128<<_%32,d[14+(_+64>>>9<<4)]=_;for(var m=1732584193,f=-271733879,r=-1732584194,i=271733878,n=0;n<d.length;n+=16){var h=m,t=f,g=r,e=i;f=md5_ii(f=md5_ii(f=md5_ii(f=md5_ii(f=md5_hh(f=md5_hh(f=md5_hh(f=md5_hh(f=md5_gg(f=md5_gg(f=md5_gg(f=md5_gg(f=md5_ff(f=md5_ff(f=md5_ff(f=md5_ff(f,r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+0],7,-680876936),f,r,d[n+1],12,-389564586),m,f,d[n+2],17,606105819),i,m,d[n+3],22,-1044525330),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+4],7,-176418897),f,r,d[n+5],12,1200080426),m,f,d[n+6],17,-1473231341),i,m,d[n+7],22,-45705983),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+8],7,1770035416),f,r,d[n+9],12,-1958414417),m,f,d[n+10],17,-42063),i,m,d[n+11],22,-1990404162),r=md5_ff(r,i=md5_ff(i,m=md5_ff(m,f,r,i,d[n+12],7,1804603682),f,r,d[n+13],12,-40341101),m,f,d[n+14],17,-1502002290),i,m,d[n+15],22,1236535329),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+1],5,-165796510),f,r,d[n+6],9,-1069501632),m,f,d[n+11],14,643717713),i,m,d[n+0],20,-373897302),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+5],5,-701558691),f,r,d[n+10],9,38016083),m,f,d[n+15],14,-660478335),i,m,d[n+4],20,-405537848),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+9],5,568446438),f,r,d[n+14],9,-1019803690),m,f,d[n+3],14,-187363961),i,m,d[n+8],20,1163531501),r=md5_gg(r,i=md5_gg(i,m=md5_gg(m,f,r,i,d[n+13],5,-1444681467),f,r,d[n+2],9,-51403784),m,f,d[n+7],14,1735328473),i,m,d[n+12],20,-1926607734),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+5],4,-378558),f,r,d[n+8],11,-2022574463),m,f,d[n+11],16,1839030562),i,m,d[n+14],23,-35309556),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+1],4,-1530992060),f,r,d[n+4],11,1272893353),m,f,d[n+7],16,-155497632),i,m,d[n+10],23,-1094730640),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+13],4,681279174),f,r,d[n+0],11,-358537222),m,f,d[n+3],16,-722521979),i,m,d[n+6],23,76029189),r=md5_hh(r,i=md5_hh(i,m=md5_hh(m,f,r,i,d[n+9],4,-640364487),f,r,d[n+12],11,-421815835),m,f,d[n+15],16,530742520),i,m,d[n+2],23,-995338651),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+0],6,-198630844),f,r,d[n+7],10,1126891415),m,f,d[n+14],15,-1416354905),i,m,d[n+5],21,-57434055),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+12],6,1700485571),f,r,d[n+3],10,-1894986606),m,f,d[n+10],15,-1051523),i,m,d[n+1],21,-2054922799),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+8],6,1873313359),f,r,d[n+15],10,-30611744),m,f,d[n+6],15,-1560198380),i,m,d[n+13],21,1309151649),r=md5_ii(r,i=md5_ii(i,m=md5_ii(m,f,r,i,d[n+4],6,-145523070),f,r,d[n+11],10,-1120210379),m,f,d[n+2],15,718787259),i,m,d[n+9],21,-343485551),m=safe_add(m,h),f=safe_add(f,t),r=safe_add(r,g),i=safe_add(i,e)}return Array(m,f,r,i)}function md5_cmn(d,_,m,f,r,i){return safe_add(bit_rol(safe_add(safe_add(_,d),safe_add(f,i)),r),m)}function md5_ff(d,_,m,f,r,i,n){return md5_cmn(_&m|~_&f,d,_,r,i,n)}function md5_gg(d,_,m,f,r,i,n){return md5_cmn(_&f|m&~f,d,_,r,i,n)}function md5_hh(d,_,m,f,r,i,n){return md5_cmn(_^m^f,d,_,r,i,n)}function md5_ii(d,_,m,f,r,i,n){return md5_cmn(m^(_|~f),d,_,r,i,n)}function safe_add(d,_){var m=(65535&d)+(65535&_);return(d>>16)+(_>>16)+(m>>16)<<16|65535&m}function bit_rol(d,_){return d<<_|d>>>32-_}
        return MD5(str);
    }

    /**
     * 
     * @param str any string
     */
    public static MD5ArrayBuffer(str){
        const MD5str = C8oUtilsCore.MD5(str);
        return Buffer.from(MD5str, 'utf-8').slice(0,16);
    }
    
    public static getNewGUIDString(): string {
        if(window["device"] != undefined){
            let platform: string = window["device"]["platform"];
            platform = platform.substring(0,3);
            let uuid = platform +"-"+ window["device"]["uuid"];
            return uuid;
        }
        else{
            let uuidStored: string = localStorage.getItem("__c8o_uuid");

            if(uuidStored != undefined && uuidStored != ""){
                return uuidStored;
            }
            else{
                let platform: string = "web-";
                let d = new Date().getTime();
                let uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                    const r = (d + Math.random() * 16) % 16 | 0;
                    d = Math.floor(d / 16);
                    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
                });
                uuid = platform + uuid;
                localStorage.setItem("__c8o_uuid", uuid);
                return uuid;
            }
        }
        
    }

    /** TAG Parameter **/

    public static getParameter(parameters: Object, name: string, useName: boolean): any {
        for (let _i = 0; _i < Object.keys(parameters).length; _i++) {
            const parameterName = Object.keys(parameters)[_i];
            if ((name === parameterName) || (useName && name === this.USE_PARAMETER_IDENTIFIER + parameterName)) {
                const obj = {};
                obj[Object.keys(parameters)[_i]] = parameters[Object.keys(parameters)[_i]];
                return obj;
            }
        }
        return null;
    }

    /**
     * Searches in the list the parameter with this specific name (or the same name with the prefix '_use_') and returns it.<br/>
     * Returns null if the parameter is not found.
     *
     * @param parameters
     * @param name
     * @param useName
     * @returns string
     */
    public static getParameterStringValue(parameters: Object, name: string, useName: boolean): string {
        const parameter = C8oUtilsCore.getParameter(parameters, name, useName);
        if (parameter != null) {
            return "" + parameter[name];
        }
        return null;
    }

    public static getParameterObjectValue(parameters: Object, name: string, useName: boolean = false): any {
        //noinspection UnnecessaryLocalVariableJS
        const parameters2 = parameters;
        const parameter = C8oUtilsCore.getParameter(parameters2, name, useName);
        if (parameter != null) {
            return parameter[name];
        } else {
            return null;
        }

    }

    public static peekParameterStringValue(parameters: Object, name: string, exceptionIfMissing: boolean): string {
        //noinspection UnnecessaryLocalVariableJS
        const parameters2 = parameters;
        const value: string = this.getParameterStringValue(parameters2, name, false);
        if (value == null) {
            if (exceptionIfMissing) {
                throw new Error("The parameter '" + name + "' is missing");
            }
        } else {
            delete parameters[name];
        }
        return value;
    }

    public static peekParameterObjectValue(parameters: Object, name: string, exceptionIfMissing: boolean): string {
        const parameters2 = parameters;
        const value: string = this.getParameterObjectValue(parameters2, name, false);
        if (value == null) {
            if (exceptionIfMissing) {
                throw new Error("The parameter '" + name + "' is missing");
            }
        } else {
            delete parameters2[name];
        }
        return value;
    }

    /**
     * Serializes a c8o call request thanks to its parameters and response type.
     *
     * @param parameters
     * @param responseType
     * @returns string
     * @throws C8oException
     */
    public static identifyC8oCallRequest(parameters: Object, responseType: string): string {
        return responseType + JSON.stringify(parameters);
    }

    public static checkHeaderArgument(response, argument){
        return response.headers.get(argument);
    }
}

export class Queue<T> {
    public _store: T[] = [];

    public push(val: T) {
        this._store.push(val);
    }

    public pop(): T {
        return this._store.shift();
    }

    public count(): number {
        return this._store.length;
    }
}


export class Semaphore {
    private max: number;
    private counter = 0;
    private waiting = [];

    constructor(max){
        this.max = max;
    }
    
    
    public take () {
      if (this.waiting.length > 0 && this.counter < this.max){
        this.counter++;
        let promise = this.waiting.shift();
        promise.resolve();
      }
    }
    
    public acquire () {
      if(this.counter < this.max) {
        this.counter++
        return new Promise(resolve => {
        resolve();
      });
      } else {
        return new Promise((resolve, err) => {
          this.waiting.push({resolve: resolve, err: err});
        });
      }
    }
      
    public release (arg = null) {
     this.counter--;
     this.take();
    }
    
    public purge () {
      let unresolved = this.waiting.length;
    
      for (let i = 0; i < unresolved; i++) {
        this.waiting[i].err('Task has been purged.');
      }
    
      this.counter = 0;
      this.waiting = [];
      
      return unresolved;
    }
  }
