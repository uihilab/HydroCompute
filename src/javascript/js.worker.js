import { getPerformanceMeasures } from "../core/utils/globalUtils.js";

/**
 * Event listener for the 'message' event.
 * @param {MessageEvent} e - The message event.
 * @returns {Promise<void>} - A Promise that resolves when the function completes.
 */
self.onmessage = async (e) => {
  performance.mark("start-script");
  const { funcName, id, step, scriptName } = e.data;

  // Convert the incoming data into a Float32Array
  let data = new Float32Array(e.data.data);

  // Load the script file dynamically
  let scripts;
  if (scriptName) {
    scripts = await import(`../../${scriptName}`);
    //using the inner object saved in the default variable
    scripts = scripts.default
  } else {
    scripts = await import("./scripts/scripts.js");
  }
  
  let result = null;

  try {
    if (scriptName !== undefined) {
      performance.mark("start-function");

      // Check if the 'main' function is defined in the script
      if (Object.keys(scripts).includes("main") &&
          Object.keys(scripts).includes(funcName) && funcName !== "main") {
        result = new Float32Array(scripts["main"](funcName, [...data]));
      } else if (!Object.keys(scripts).includes("main")) {
        result = new Float32Array(scripts[funcName]([...data]));
      } else if ((funcName === undefined || funcName === "main") && Object.keys(scripts).includes("main")){
        result = new Float32Array(scripts["main"]([...data]));
      }

      performance.mark("end-function");
    } else {
      // Search for the function in the available scripts in js library
      for (const script in scripts) {
        if (Object.keys(scripts[script]).includes("main") &&
            Object.keys(scripts[script]).includes(funcName)) {
          performance.mark("start-function");
          result = new Float32Array(scripts[script]["main"](funcName, [...data]));
          performance.mark("end-function");
          break;
        } else if (!Object.keys(scripts[script]).includes("main") &&
                   Object.keys(scripts[script]).includes(funcName)) {
          performance.mark("start-function");
          result = new Float32Array(scripts[script][funcName]([...data]));
          performance.mark("end-function");
          break;
        }
      }
    }

    performance.mark("end-script");

    // Get performance measures using the `getPerformanceMeasures()` function from the 'globalUtils.js' module
    let getPerformance = getPerformanceMeasures();

    // Send back the results and performance measures to the main thread
    self.postMessage({
      id,
      results: result.buffer,
      step,
      funcName,
      ...getPerformance
    }, [result.buffer]);
  } catch (error) {
    // Handle errors that may occur during script execution
    if (!(error instanceof DOMException) && typeof scripts !== "undefined") {
      console.error(
        `There was an error executing:\nfunction: ${funcName}\nid: ${id} at the worker.`,
      );
      throw error;
    } else {
      console.error("There was an error running the javascript worker script.");
      throw error;
    }
  }
};

