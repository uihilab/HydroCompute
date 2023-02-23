/**
 * @desc Main class for managing threads. Results and execution time are saved here
 * @property engine - name of the engine
 * @property workerLocation - location of the worker running the engine
 * @property workerThreads - holder for all the worker threads
 * @property maxWorkerCount - maximum workers on the browser Leave it at least 1 less than all the available.
 * @property results - holder of the results once finished
 * @class threadManager
 */
export default class threadManager {
  constructor(name, location) {
    window.Worker
    ? console.log("Web workers engine set.")
    : (() => {return console.error("Web workers API not supported!")})();
    this.engine = name;
    this.workerLocation = location;
    this.resetWorkers()
  }

  /**
   * Holder for the workers created by the class. It creates an object that contains the workers defined 
   * by the execution context holding the execution time of each thread and the worker itself.
   * @param {*} number 
   */
  createWorkerThread(number) {
    this.workerThreads[number] = {
      worker: undefined,
    };
  }

  /**
   * 
   * @param {*} index 
   */
  initializeWorkerThread(index) {
    this.workerThreads[index].worker = (args) => {
      let buffer = args.data
        return new Promise((resolve, reject) => {
          let w;
          //CRITICAL INFO: WORKER NOT EXECUTE IF THE PATH IS "TOO RELATIVE", KEEP LONG SOURCE
          if (typeof importScripts === 'function'){
            importScripts(this.workerLocation);
            w = self;
          } else {
          w = new Worker(this.workerLocation, {
            type: "module",
          });
        }
          w.onmessage = ({data}) => {
            let {results, exec} = data
            resolve(results, exec)
              this.results.push(results) 
              this.execTime += exec,
              w.terminate();
          };
          w.onerror = (e) => {
            reject(error);
          };
          buffer.byteLength === 0 ? w.postMessage(args) :
          w.postMessage(args, [buffer]);
        });
      }
  }

  /**
   * 
   */
  resetWorkers() {
    this.maxWorkerCount = navigator.hardwareConcurrency-1;
    this.workerThreads = {};
    this.results = [];
    this.execTime = 0;
    console.log(`Initialized ${this.engine} using worker scope with max workers:${this.maxWorkerCount}`);
  }
}
