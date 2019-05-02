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

    public static getNewGUIDString(): string {
        let d = new Date().getTime();
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
        });
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
