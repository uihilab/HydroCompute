self.onmessage = async (e) => {
  performance.mark("start-script");
  const scripts = null;
  //Correcting to import either an already found available script in the scripts folder, or using an outside script
  if (e.data.scriptType === "fetched") {
    //the path to the script must be relative to the location of the hydrocompute driver OR coming from an outside source
    scripts = await import(e.data.scriptName);
  } else {
    scripts = await import("./scripts/scripts.js");
  }
  //Need to correct firefox imports
  //const scripts = self.importScripts('./scripts/scripts.js')

  const { funcName, id, step } = e.data;
  const data = new Float32Array(e.data.data);
  let result = null;
  try {
    //first initinialization in case the script type import is fetched
    if (e.data.scriptType === "fetched") {
      //logic for when the script type is fetched
    } else {
      for (const script in scripts) {
        performance.mark("start-function");
        //IMPLEMENT CHANGE THAT SEARCHES BOTH THE NAME OF MAIN AND FUNCTION NAME IN SCRIPT OBJECT
        //NOT FINISHED!
        if (Object.keys(scripts[script]).includes("main") && Object.keys(scripts[script]).includes(funcName)) {
          result = scripts[script]["main"](funcName, data);
          //Case the script used does not include the main interface, runs the function directly
        } else if (!Object.keys(scripts[script]).includes("main")) {
          result = scripts[script][funcName](data);
        }
        performance.mark("end-function");
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
        break;
      }
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
