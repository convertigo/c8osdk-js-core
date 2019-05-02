import "rxjs/add/operator/retry";
import {C8oCore} from "./c8oCore";
import {C8oProgress} from "./c8oProgress";
import { C8oResponseListener, C8oResponseJsonListener} from "./c8oResponse";
import { C8oFullSyncCbl } from "./c8oFullSync";
import { C8oHttpRequestException } from "./Exception/c8oHttpRequestException";

import { C8oExceptionMessage } from "./Exception/c8oExceptionMessage";
import { Observable } from "rxjs";
import { url } from 'inspector';
import { C8oManagerNetwork } from "./c8oManagerNetwork";
import { C8oManagerDatabase } from "./c8oManagerDatabase";
import { C8oManagerSession } from "./c8oManagerSession";

declare const require: any;
export abstract class C8oManager {
    public c8o: C8oCore;
    private network: C8oManagerNetwork;
    private database: C8oManagerDatabase;
    private session: C8oManagerSession;
    
    constructor(c8o: C8oCore) {
    }
}