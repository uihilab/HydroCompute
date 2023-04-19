import { getPerformanceMeasures } from "../core/utils/globalUtils.js";

self.onmessage = async (e) => {
  performance.mark("start-script");
  const { funcName, id, step, scriptName } = e.data;
  let data = new Float32Array(e.data.data)
    let scripts = await import(scriptName || "./scripts/scripts.js");
    scripts = Object.keys(scripts).includes("default") ? scripts.default : scripts
  let result = null;
  try {
    //in the case the script is given as a relative path by the user
    if (scriptName !== undefined) {
      performance.mark("start-function");
      if (
        Object.keys(scripts).includes("main") &&
        Object.keys(scripts).includes(funcName) && funcName !== "main"
      ) {
        result = new Float32Array(scripts["main"](funcName, [...data]));
      } else if (!Object.keys(scripts).includes("main")) {
        //CHANGE HERE!!
        result = new Float32Array(scripts[funcName]([...data]));
      } else if ((funcName === undefined || funcName === "main") && Object.keys(scripts).includes("main")){
        result = new Float32Array(scripts["main"]([...data]))
      }
      performance.mark("end-function");
    } else {
      //in the case the script is found within the available scripts in js library
      for (const script in scripts) {
        if (
          Object.keys(scripts[script]).includes("main") &&
          Object.keys(scripts[script]).includes(funcName)
        ) {
          performance.mark("start-function");
          result = new Float32Array(scripts[script]["main"](funcName, [...data]));
          performance.mark("end-function");
          break;
        } else if (
          !Object.keys(scripts[script]).includes("main") &&
          Object.keys(scripts[script]).includes(funcName)
        ) {
          performance.mark("start-function");
          result = new Float32Array(scripts[script][funcName]([...data]));
          performance.mark("end-function");
          break;
        }
      }
    }
    performance.mark("end-script");
    let getPerformance = getPerformanceMeasures()
    self.postMessage(
      {
        id,
        results: result.buffer,
        step,
        funcName,
        ...getPerformance
      },
      [result.buffer]
    );
  } catch (error) {
    if (!(error instanceof DOMException) && typeof scripts !== "undefined") {
      console.error(
        `There was an error executing:\nfunction: ${funcName}\nid: ${id}`,
        error
      );
      return 
    } else {
      console.error(
        "There was an error running the script. More info: ",
        error
      );
       return
    }
  }
};
