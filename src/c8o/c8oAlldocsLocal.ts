import { C8oCore } from "./c8oCore";

export class C8oAlldocsLocal {

    constructor(private c8o: C8oCore) {
    }
    private DB_VERSION = 5;
    private LOCAL_STORE = 'local-store';
    private ATTACH_STORE = 'attach-store';

    public alldocs(opts, db): Promise<any> {
        return new Promise((resolve, reject) => {
            
            let dbName = db["prefix"] + db["name"];
            opts.skip = typeof opts.skip !== 'undefined' ? opts.skip : 0;
            if (opts.start_key) {
                opts.startkey = opts.start_key;
            }
            if (opts.end_key) {
                opts.endkey = opts.end_key;
            }
            if ('keys' in opts) {
                if (!Array.isArray(opts.keys)) {
                    return reject(new TypeError('options.keys must be an array'));
                }
                var incompatibleOpt =
                    ['startkey', 'endkey', 'key'].filter(function (incompatibleOpt) {
                        return incompatibleOpt in opts;
                    })[0];
                if (incompatibleOpt) {
                    reject('Some query parameter is invalid' +
                        'Query parameter `' + incompatibleOpt +
                        '` is not compatible with multi-get'
                    );
                    return;
                }
                if (!this.isRemote(db)) {
                    this.allDocsKeysParse(opts);
                    if (opts.keys.length === 0) {
                        let callback = (arg1, arg2, arg3) => {
                            resolve({ arg1: arg1, arg2: arg2, arg3: arg3 })
                        }
                        return this.idbAllDocs({ limit: 0 }, callback, dbName);
                    }
                }
            }
            let callback = (err, result) => {
                if(!err){
                    this.c8o.log._trace("[c8oAlldocsLocal], alldocs: ok" );
                }
                else{
                    this.c8o.log._error("[c8oAlldocsLocal], alldocs: an error occured :", err);
                }

                resolve({ err: err, result: result})
            }
            return this.idbAllDocs(opts, callback, dbName);

        });
    }
    private openBase(DB_NAME, resolve = null, reject= null) {
        if(resolve != null){
            this.doOpenBase(DB_NAME, resolve, reject)
        }
        return new Promise((resolve, reject)=>{
            this.doOpenBase(DB_NAME, resolve, reject)
        });
    }

    private doOpenBase(DB_NAME, resolve = null, reject= null){
        try {
            let req = window.indexedDB.open(DB_NAME, this.DB_VERSION);
            req.onsuccess = (event) => {
                if(req.result.objectStoreNames.length == 0){
                    this.c8o.log._debug("[alldocs] database is corrupted, we need to re-initialized it");
                    this.restaureDb(DB_NAME)
                    .then(()=>{
                        this.c8o.log._debug("[alldocs] database has been re-initialized, we will execute all docs");
                        this.openBase(DB_NAME, resolve, reject)
                    })
                    .catch((err)=>{
                        reject(err)
                    })
                    
                }
                else{
                    resolve(req.result);
                }
               
           }
        }
        catch(err){
            reject(err);
        }
    }

    private restaureDb(DB_NAME){
        return new Promise((resolve, reject)=>{
            var dbDeleteRequest = window.indexedDB.deleteDatabase(DB_NAME);
            dbDeleteRequest.onerror = (event)=> {
                this.c8o.log._error("[alldocs] database is corrupted, failed to re-initialized database");
                reject(event)
            };
        
            dbDeleteRequest.onsuccess = (event)=> {
                this.c8o.log._debug("[alldocs] database is corrupted, deletion successfull");
                // Let us open our database
                var DBOpenRequest = window.indexedDB.open(DB_NAME, 5);
        
                DBOpenRequest.onsuccess = (event)=> {
                    this.c8o.log._debug("[alldocs] database is corrupted, creation successfull");
                    resolve();
                };
        
                DBOpenRequest.onupgradeneeded = (event)=> {
                    this.c8o.log._debug("[alldocs] database is corrupted, database need to be upgraded");
                };
                DBOpenRequest.onerror = (event: any)=> {
                    this.c8o.log._error("[alldocs] database is corrupted, creation errored", event);
                    reject(event)
                };
            };
        })
        
    }

    private async idbAllDocs(opts, callback, DB_NAME) {
        let idb = await this.openBase(DB_NAME)

        var start = 'startkey' in opts ? opts.startkey : false;
        var end = 'endkey' in opts ? opts.endkey : false;
        var key = 'key' in opts ? opts.key : false;
        var keys = 'keys' in opts ? opts.keys : false;
        var skip = opts.skip || 0;
        var limit = typeof opts.limit === 'number' ? opts.limit : -1;
        var inclusiveEnd = opts.inclusive_end !== false;

        var keyRange;
        var keyRangeError;
        if (!keys) {
            keyRange = this.createKeyRange(start, end, inclusiveEnd, key, opts.descending);
            keyRangeError = keyRange && keyRange.error;
            if (keyRangeError &&
                !(keyRangeError.name === "DataError" && keyRangeError.code === 0)) {
                // DataError with error code 0 indicates start is less than end, so
                // can just do an empty query. Else need to throw
                return callback("indexed_db_went_bad" +
                    keyRangeError.name, keyRangeError.message);
            }
        }

        var stores = [this.LOCAL_STORE];

        if (opts.attachments) {
            stores.push(this.ATTACH_STORE);
        }
        var txnResult = this.openTransactionSafely(idb, stores, 'readonly');
        if (txnResult["error"]) {
            return callback(txnResult["error"]);
        }
        var txn = txnResult["txn"];
        txn.oncomplete = onTxnComplete;
        txn.onabort = callback;
        var localStore = txn.objectStore(this.LOCAL_STORE);
        var results = [];
        var docCount;

        var countRequest = localStore.count();
        countRequest.onsuccess = function () {
            docCount = countRequest.result;
        }

        function allDocsInner(winningRev$$1, metadata) {
            var row = {
                id: metadata.id,
                key: metadata.id,
                value: {
                    rev: winningRev$$1
                }
            };
            var deleted = metadata.deleted;
            if (deleted) {
                if (keys) {
                    results.push(row);
                    // deleted docs are okay with "keys" requests
                    row["value"]["deleted"] = true;
                    row["doc"] = null;
                }
            } else if (skip-- <= 0) {
                results.push(row);
                if (opts.include_docs) {
                    row["doc"] = metadata["_c8o_inlcude"];
                }
            }
        }

        let processBatch  = (batchValues) =>{
            for (var i = 0, len = batchValues.length; i < len; i++) {
                if (results.length === limit) {
                    break;
                }
                var batchValue = batchValues[i];
                if (batchValue.error && keys) {
                    // key was not found with "keys" requests
                    results.push(batchValue);
                    continue;
                }
                var metadata = this.decodeMetadata(batchValue);
                var winningRev$$1 = metadata["winningRev"];
                metadata["_c8o_inlcude"] = batchValue;
                allDocsInner(winningRev$$1, metadata);
            }
        }

        function onBatch(batchKeys, batchValues, cursor) {
            if (!cursor) {
                return;
            }
            processBatch(batchValues);
            if (results.length < limit) {
                cursor.continue();
            }
        }

        function onGetAll(e) {
            var values = e.target.result;
            if (opts.descending) {
                values = values.reverse();
            }
            processBatch(values);
        }

        function onResultsReady() {
            var returnVal = {
                total_rows: docCount,
                offset: opts.skip,
                rows: results
            };

            callback(null, returnVal);
        }

        function onTxnComplete() {
            if (opts.attachments) {
                this.postProcessAttachments(results, opts.binary).then(onResultsReady);
            } else {
                onResultsReady();
            }
        }

        // don't bother doing any requests if start > end or limit === 0
        if (keyRangeError || limit === 0) {
            return;
        }
        if (keys) {
            return this.allDocsKeys(opts.keys, localStore, onBatch);
        }
        if (limit === -1) { // just fetch everything
            return this.getAll(localStore, keyRange, onGetAll);
        }
        // else do a cursor
        // choose a batch size based on the skip, since we'll need to skip that many
        this.runBatchedCursor(localStore, keyRange, opts.descending, limit + skip, onBatch);
    }

    private runBatchedCursor(objectStore, keyRange, descending, batchSize, onBatch) {

        if (batchSize === -1) {
          batchSize = 1000;
        }
      
        // Bail out of getAll()/getAllKeys() in the following cases:
        // 1) either method is unsupported - we need both
        // 2) batchSize is 1 (might as well use IDBCursor)
        // 3) descending – no real way to do this via getAll()/getAllKeys()
      
        var useGetAll = typeof objectStore.getAll === 'function' &&
          typeof objectStore.getAllKeys === 'function' &&
          batchSize > 1 && !descending;
      
        var keysBatch;
        var valuesBatch;
        var pseudoCursor;
      
        function onGetAll(e) {
          valuesBatch = e.target.result;
          if (keysBatch) {
            onBatch(keysBatch, valuesBatch, pseudoCursor);
          }
        }
      
        function onGetAllKeys(e) {
          keysBatch = e.target.result;
          if (valuesBatch) {
            onBatch(keysBatch, valuesBatch, pseudoCursor);
          }
        }
      
        function continuePseudoCursor() {
          if (!keysBatch.length) { // no more results
            return onBatch();
          }
          // fetch next batch, exclusive start
          var lastKey = keysBatch[keysBatch.length - 1];
          var newKeyRange;
          if (keyRange && keyRange.upper) {
            try {
              newKeyRange = IDBKeyRange.bound(lastKey, keyRange.upper,
                true, keyRange.upperOpen);
            } catch (e) {
              if (e.name === "DataError" && e.code === 0) {
                return onBatch(); // we're done, startkey and endkey are equal
              }
            }
          } else {
            newKeyRange = IDBKeyRange.lowerBound(lastKey, true);
          }
          keyRange = newKeyRange;
          keysBatch = null;
          valuesBatch = null;
          objectStore.getAll(keyRange, batchSize).onsuccess = onGetAll;
          objectStore.getAllKeys(keyRange, batchSize).onsuccess = onGetAllKeys;
        }
      
        function onCursor(e) {
          var cursor = e.target.result;
          if (!cursor) { // done
            return onBatch();
          }
          // regular IDBCursor acts like a batch where batch size is always 1
          onBatch([cursor.key], [cursor.value], cursor);
        }
      
        if (useGetAll) {
          pseudoCursor = {"continue": continuePseudoCursor};
          objectStore.getAll(keyRange, batchSize).onsuccess = onGetAll;
          objectStore.getAllKeys(keyRange, batchSize).onsuccess = onGetAllKeys;
        } else if (descending) {
          objectStore.openCursor(keyRange, 'prev').onsuccess = onCursor;
        } else {
          objectStore.openCursor(keyRange).onsuccess = onCursor;
        }
      }

    private getAll(objectStore, keyRange, onSuccess) {
        if (typeof objectStore.getAll === 'function') {
          // use native getAll
          objectStore.getAll(keyRange).onsuccess = onSuccess;
          return;
        }
        // fall back to cursors
        var values = [];
      
        function onCursor(e) {
          var cursor = e.target.result;
          if (cursor) {
            values.push(cursor.value);
            cursor.continue();
          } else {
            onSuccess({
              target: {
                result: values
              }
            });
          }
        }
        
  objectStore.openCursor(keyRange).onsuccess = onCursor;
}

    private allDocsKeys(keys, docStore, onBatch) {
        // It's not guaranted to be returned in right order  
        var valuesBatch = new Array(keys.length);
        var count = 0;
        keys.forEach(function (key, index) {
            docStore.get(key).onsuccess = function (event) {
                if (event.target.result) {
                    valuesBatch[index] = event.target.result;
                } else {
                    valuesBatch[index] = { key: key, error: 'not_found' };
                }
                count++;
                if (count === keys.length) {
                    onBatch(keys, valuesBatch, {});
                }
            };
        });
    }

    
    private decodeMetadata(storedObject) {
        if (!storedObject) {
            return null;
        }
        var metadata = {};
        metadata["winningRev"] = storedObject._rev;
        metadata["id"] = storedObject._id;
        return metadata;
    }

    private openTransactionSafely(idb, stores, mode) {
        try {
            return {
                txn: idb.transaction(stores, mode)
            };
        } catch (err) {
            return {
                error: err
            };
        }
    }

    private isRemote(db) {
        if (typeof db._remote === 'boolean') {
            return db._remote;
        }
        /* istanbul ignore next */
        if (typeof db.type === 'function') {
            return db.type() === 'http';
        }
        /* istanbul ignore next */
        return false;
    }

    private allDocsKeysParse(opts) {
        var keys = ('limit' in opts) ?
            opts.keys.slice(opts.skip, opts.limit + opts.skip) :
            (opts.skip > 0) ? opts.keys.slice(opts.skip) : opts.keys;
        opts.keys = keys;
        opts.skip = 0;
        delete opts.limit;
        if (opts.descending) {
            keys.reverse();
            opts.descending = false;
        }
    }

    private createKeyRange(start, end, inclusiveEnd, key, descending) {
        try {
            if (start && end) {
                if (descending) {
                    return IDBKeyRange.bound(end, start, !inclusiveEnd, false);
                } else {
                    return IDBKeyRange.bound(start, end, false, !inclusiveEnd);
                }
            } else if (start) {
                if (descending) {
                    return IDBKeyRange.upperBound(start);
                } else {
                    return IDBKeyRange.lowerBound(start);
                }
            } else if (end) {
                if (descending) {
                    return IDBKeyRange.lowerBound(end, !inclusiveEnd);
                } else {
                    return IDBKeyRange.upperBound(end, !inclusiveEnd);
                }
            } else if (key) {
                return IDBKeyRange.only(key);
            }
        } catch (e) {
            return { error: e };
        }
        return null;
    }
}