//import * as scripts from './scripts/scripts.js';
// let scripts;
// if (typeof window.WorkerGlobalScope !== 'undefined' && self instanceof window.WorkerGlobalScope) {
//   // We are in a web worker, so use importScripts
//   importScripts('./scripts/scripts.js');
//   scripts = self.scripts;
// } else {
  // We are in a regular browser context, so use the module syntax
// }
//import { fakeDom } from "../core/utils/fakeDom.js";
//Single worker instance that goes through the while process of data digestion/ingestion

self.onmessage = async (e) => {
  const scripts = await import('./scripts/scripts.js')
  const {funcName, id, step} = e.data;
  const data = new Float32Array(e.data.data);
  let result = null;
  try {
    for (const script in scripts) {
      if (funcName in scripts[script]) {
        //script === "hydro" ? fakeDom() : null
        const st = performance.now();
        result = scripts[script][funcName](data);
        const end = performance.now();
        //console.log(result);
        console.log(`${funcName} execution time: ${end-st} ms`);
        self.postMessage({
          id,
          results: result.buffer,
          step,
          exec: end - st  
        },[result.buffer]);
        break;
      }
    }
  } catch (error) {
    if (!(error instanceof DOMException) && typeof scripts !== "undefined") {
      console.log(error)
      console.error(`There was an error executing:\nfunction: ${funcName}\nid: ${id}`);
    } else {
      console.log(error)
      console.error("Please place your script with the correct name in the /utils folder");
    }
  }
};
