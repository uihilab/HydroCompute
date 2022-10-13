//Single worker instance that goes through the whike process of data digestion/ingestion
onmessage = e => {
    data = e.data[0]
    var scriptImport = data[1].script
    var funcName = data[1].function
    console.log("message received!!")
    try{
        importScripts(`./utils/${scriptImport}.js`)
        var result = eval(`${scriptImport}`)().main(funcName, data[0]);
        postMessage(result);

    } catch(e){
        (e instanceof DOMException)
        ?
        (() => {
        console.error("Please place your script with correct name in the /utils folder");
        return
    })() :
    (()=> {return e})()
    }
}