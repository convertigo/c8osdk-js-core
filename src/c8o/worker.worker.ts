const ctx: Worker = self as any;

class FullsyncWoker {
    public view(){
        ctx.postMessage({resp:"myresp", error:"myerr"});
    }
}

const fsWorker = new FullsyncWoker();

ctx.addEventListener("message", (event: any) => {

    switch(event.data.verb){
        case "view":{
            fsWorker.view()
        }
    }
});