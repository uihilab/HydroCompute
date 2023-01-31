import * as scripts from "./scripts/scripts.js";

//Single worker instance that goes through the while process of data digestion/ingestion
self.onmessage = (e) => {
  let {funcName, id, step} = e.data
  let data = new Float32Array(e.data.data)
  try {
    Object.keys(scripts).forEach((script) => {
      if (Object.keys(scripts[script]).includes(funcName)) {
        const st = performance.now();
        var result = scripts[script].main(funcName, data);
        typeof result === "undefined" ? (result = "") : result;
        const end = performance.now();
        self.postMessage({
          id: id,
          results: result,
          step: step,
          exec: end - st,
        }, [result.buffer]);
      }
    });
  } catch (e) {
    e instanceof DOMException || typeof scripts === "undefined"
      ? (() => {
          console.error(
            "Please place your script with correct name in the /utils folder"
          );
          return;
        })()
      : (() => {
          //console.log(`There was an error with function id: ${e.data.id}`)
          console.log(`There was an error with executing:\nfunction:${funcName}\nid:${e.data.id}`)
        })();
  }
};
