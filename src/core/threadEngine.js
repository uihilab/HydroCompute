/**
 * @description Main class for managing threads. Results and execution time are saved here
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
      ? console.log(`Web workers engine set for engine: ${name}`)
      : (() => {
          return console.error("Web workers API not supported!");
        })();
    this.engine = name;
    this.workerLocation = location;
    this.resetWorkers();
  }

  /**
   * @method createWorkerThread
   * @description Holder for the workers created by the class. It creates an object that contains the workers defined
   * by the execution context holding the execution time of each thread and the worker itself.
   * @param {Number} number - number of thread to run
   */
  createWorkerThread(number) {
    this.workerThreads[number] = {
      worker: undefined,
      functionTime: 0,
      workerTime: 0,
    };
  }

  /**
   * @method initializeWorkerThread
   * @description Method initializer of the threads found in the workerThread object. It attaches each of the properties into the object.
   * @param {Number} index - number of the thread.
   */
  initializeWorkerThread(index) {
    this.workerThreads[index].worker = (args) => {
      let {
        data,
        funcName,
        step
      } = args
      let buffer = data;
      return new Promise(async (resolve, reject) => {
        let w;
        //CRITICAL INFO: WORKER NOT EXECUTE IF THE PATH IS "TOO RELATIVE", KEEP LONG SOURCE
        if (typeof importScripts === "function") {
          importScripts(this.workerLocation);
          w = self;
        } else {
          w = new Worker(this.workerLocation, {
            type: "module",
          });
        }
        w.onmessage = ({ data }) => {
          console.log(`working...`);
          let { results, funcExec, workerExec, funcName } = data;
          resolve(results);
          this.results.push(results);
          (this.workerThreads[index].functionTime += funcExec),
            (this.workerThreads[index].workerTime += workerExec);
          this.functionOrder.push(funcName);
          w.terminate();
        };
        w.onerror = (error) => {
          console.error(
            `There was an error executing thread: ${index}, function: ${funcName}, step: ${step}. More info: `,
            error
          );
          reject(error);
          return;
        };

        buffer.byteLength === 0
          ? w.postMessage(args)
          : w.postMessage(args, [buffer]);
      });
    };
  }

  /**
   * @method resetWorkers
   * @description Resets all the workers set to work in the compute engine.
   */
  resetWorkers() {
    this.maxWorkerCount = navigator.hardwareConcurrency - 1;
    this.workerThreads = {};
    this.results = [];
    this.functionOrder = [];
    console.log(
      `Initialized ${this.engine} using worker scope with max workers:${this.maxWorkerCount}`
    );
  }

  /**
   * @method execTime
   * @description Retrives all the execution times of a worker thread. It is triggered within the engine class.
   */
  get execTimes() {
    let funcTime = 0,
      workerTime = 0;
    for (let i = 0; i < Object.keys(this.workerThreads).length; i++) {
      funcTime += this.workerThreads[i].functionTime;
      workerTime += this.workerThreads[i].workerTime;
    }
    return [funcTime, workerTime];
  }
}