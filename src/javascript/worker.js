self.onmessage = async (e) => {
  performance.mark("start-script");
  let scripts = null;
  if (e.data.scriptType === "fetched") {
    scripts = await import(e.data.scriptName);
  } else {
    scripts = await import("./scripts/scripts.js");
  }
  const { funcName, id, step, scriptName } = e.data;
  const data = new Float32Array(e.data.data);
  let result = null;
  try {
    //in the case the script is given as a relative path by the user
    if (e.data.scriptType === "fetched") {
      performance.mark("start-function");
      let script = await import(scriptName);
      if (
        Object.keys(script).includes("main") &&
        Object.keys(script).includes(funcName)
      ) {
        result = script["main"](funcName, data);
      } else if (!Object.keys(script).includes("main")) {
        result = script[funcName](data);
      } else if (funcName === undefined && Object.keys(script).includes("main")){
        result = script["main"](data)
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
          result = scripts[script]["main"](funcName, data);
          performance.mark("end-function");
          break;
        } else if (
          !Object.keys(scripts[script]).includes("main") &&
          Object.keys(scripts[script]).includes(funcName)
        ) {
          performance.mark("start-function");
          result = scripts[script][funcName](data);
          performance.mark("end-function");
          break;
        }
      }
      performance.mark("end-script");
      self.postMessage(
        {
          id,
          results: result.buffer,
          step,
          funcName,
          funcExec: performance.measure(
            "measure-execution",
            "start-function",
            "end-function"
          ).duration,
          workerExec: performance.measure(
            "measure-execution",
            "start-script",
            "end-script"
          ).duration,
        },
        [result.buffer]
      );
    }
  } catch (error) {
    if (!(error instanceof DOMException) && typeof scripts !== "undefined") {
      console.error(
        `There was an error executing:\nfunction: ${funcName}\nid: ${id}`,
        error
      );
    } else {
      console.error(
        "There was an error running the script. More info: ",
        error
      );
    }
  }
};
