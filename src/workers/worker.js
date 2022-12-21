//Single worker instance that goes through the whike process of data digestion/ingestion
import * as scripts from './scripts/scripts.js';  

self.onmessage = e => {
    var st = performance.now()
    var data = e.data.data, funcName = e.data.function;
    try{
        Object.keys(scripts).forEach((script) => {
            if (Object.keys(scripts[script]).includes(funcName)) { 
                var result = scripts[script].main(funcName, data);
                typeof result === "undefined" ? result="":result
                var end = performance.now()
                self.postMessage({"id": e.data.id, "results": result, "step": e.data.step, "exec": end - st});
        }
        })
    } catch(e){
        (e instanceof DOMException || typeof scripts === "undefined")
        ?
        (() => {
        console.error("Please place your script with correct name in the /utils folder");
        return
    })() :
    (()=> {
        //console.log(`There was an error with function id: ${e.data.id}`)
        return e})()
    }
}