import * as scripts from "./scripts/scripts.js";

//Single worker instance that goes through the while process of data digestion/ingestion
self.onmessage = (e) => {
  const {funcName, id, step} = e.data;
  const data = new Float32Array(e.data.data);
  let result = null;
  try {
    for (const script in scripts) {
      if (funcName in scripts[script]) {
        const st = performance.now();
        result = scripts[script][funcName](data);
        const end = performance.now();
        self.postMessage({
          id,
          results: result,
          step,
          exec: end - st
        }, [result.buffer]);
        break;
      }
    }
  } catch (error) {
    if (!(error instanceof DOMException) && typeof scripts !== "undefined") {
      console.error(`There was an error executing:\nfunction: ${funcName}\nid: ${id}`);
    } else {
      console.error("Please place your script with the correct name in the /utils folder");
    }
  }
};
