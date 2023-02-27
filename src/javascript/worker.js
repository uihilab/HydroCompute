self.onmessage = async (e) => {
  let sc_1 = performance.now()
  const scripts = await import('./scripts/scripts.js')
  
  const {funcName, id, step} = e.data;
  const data = new Float32Array(e.data.data);
  let result = null;
  try {
    for (const script in scripts) {
      if (funcName in scripts[script]) {
        const st = performance.now();
        result = scripts[script][funcName](data);
        const end = performance.now();
        let sc_2 = performance.now()
        self.postMessage({
          id,
          results: result.buffer,
          step,
          funcExec: end - st ,
          workerExec: sc_2 - sc_1 
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
