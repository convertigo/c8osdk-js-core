import "rxjs/add/operator/retry";
import { C8oCore } from "./c8oCore";
export class C8oLoad {

    constructor(private c8o: C8oCore) {
        
    }
    public plugin: any = {
        c8oload: function (url, opts, c8o){
            var db = this;
            
            var extend = require('pouchdb-extend');
            var Checkpointer = require('pouchdb-checkpointer');
            var genReplicationId = require('pouchdb-generate-replication-id');

            let loadString = (db, datastr, opts, resolve, reject, c8o)=>{
                let parsedDump = parseDump(datastr);
                if (parsedDump["err"]) {
                    return reject(parsedDump["err"]);
                }
                let docs = parsedDump["docs"];
                let lastSeq = parsedDump["lastSeq"];
        
        
                db.bulkDocs({docs: docs, new_edits: false})
                .then(()=> {
                    if (!opts.proxy) {
                      resolve({ok:true});
                    }
                    else{
                        writeProxyCheckpoint(db, lastSeq, opts, resolve, reject);
                    }
                    
                  })
                  .catch((err)=>{
                    reject(err);
                  })
            };


            let loadUrl = (db, url, opts, resolve, reject, c8o)=>{
                let headersObject = { 'Accept': 'application/json', 'x-convertigo-sdk': c8o.sdkVersion};
                    Object.assign(headersObject, c8o.headers);
                    let headers =  c8o.httpInterface.getHeaders(headersObject);
        
                    c8o.httpInterface.httpGetObservable(url, {
                        headers: headers,
                        withCredentials: true,
                        responseType: 'text' as 'json'
                    }, {})
                    .subscribe(
                        response => {
                            loadString(db, response, opts, resolve, reject, c8o);
                            
                    },
                    error => {
                        reject(error);
                    })
            };

            let parseDump = (data)=>{
                var docs = [];
                var lastSeq = 0;
                try {
                  data.split('\n').forEach(function (line) {
                    if (!line) {
                      return;
                    }
                    line = JSON.parse(line);
                    if (line["docs"]) {
                      docs = docs.concat(line["docs"]);
                    }
                    if (line.seq) {
                      lastSeq = line.seq;
                    }
                  });
                } catch (err) {
                  return {err: err};
                }
                return {docs: docs, lastSeq: lastSeq};
            }

            let writeProxyCheckpoint = (db, lastSeq, opts, resolve, reject)=>{
                db.info()
                .then((info)=> {
        
                    var src = new db.constructor(opts.proxy,
                      extend(true, {}, {}, opts));
        
        
                    var target = new db.constructor(info.db_name,
                      extend(true, {}, db.__opts, opts));
        
                    var replIdOpts = {};
        
                    if (opts.filter) {
                      replIdOpts["filter"] = opts.filter;
                    }
        
                    if (opts.query_params) {
                      replIdOpts["query_params"] = opts.query_params;
                    }
        
                    if (opts.view) {
                      replIdOpts["view"] = opts.view;
                    }
              
                    genReplicationId.default(src, target, replIdOpts)
                    .then(function (replId) {
                      var state = {
                        cancelled: false
                      };
                      var checkpointer = new Checkpointer.default(src, target, replId, state);
                      checkpointer.writeCheckpoint(lastSeq)
                      .then((response)=>{
                        resolve(response);
                      })
                      .catch((err)=>{
                          reject(err);
                      })
                    })
                    .catch((err)=>{
                        reject(err);
                    })
                  });
            }






            return new Promise((resolve, reject)=>{
                
                // if its a dumped string
                if (/^\s*\{/.test(url)) {
                    loadString(db, url, opts, resolve, reject, c8o);
                  }
                  else{
                    loadUrl(db, url, opts, resolve, reject, c8o);
                  }
                  
            })
        }
    }
   
      
}