self.onmessage = async (e) => {
  performance.mark('start-script')
  const scripts = await import('./scripts/scripts.js')
  
  const {funcName, id, step} = e.data;
  const data = new Float32Array(e.data.data);
  let result = null;
  try {
    for (const script in scripts) {
      if (funcName in scripts[script]) {
        performance.mark('start-function');
        result = scripts[script][funcName](data);
        performance.mark('end-function');
       performance.mark('end-script')
        self.postMessage({
          id,
          results: result.buffer,
          step,
          funcExec: performance.measure('measure-execution', 'start-function', 'end-function').duration,
          workerExec: performance.measure('measure-execution', 'start-script', 'end-script').duration
        },[result.buffer]);
        break;
      }
    }
  } catch (error) {
    if (!(error instanceof DOMException) && typeof scripts !== "undefined") {
      console.error(`There was an error executing:\nfunction: ${funcName}\nid: ${id}`);
    } else {
      console.log(error)
      console.error('There was an error running the script. More info: ', error);
    }
  }
};
