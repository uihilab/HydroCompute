//Single worker instance that goes through the whike process of data digestion/ingestion
import * as scripts from './utils/scripts.js';  

self.onmessage = e => {
    var data = e.data.data, scriptName = e.data.script, funcName = e.data.function;
    try{
        var result = scripts[scriptName].main(funcName, data);
        typeof result === "undefined" ? result="":result
        self.postMessage({"id": e.data.id, "results": result});

    } catch(e){
        (e instanceof DOMException || typeof scripts[scriptName] === "undefined")
        ?
        (() => {
        console.error("Please place your script with correct name in the /utils folder");
        return
    })() :
    (()=> {return e})()
    }
}