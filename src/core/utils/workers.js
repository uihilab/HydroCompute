export default class workerScope {
  constructor(name, location) {
    window.Worker
    ? console.log("Web workers engine set.")
    : (() => {return console.error("Web workers API not supported!")})();
    this.engine = name;
    this.workerLocation = location;
    this.resetWorkers()
  }

  /**
   * 
   * @param {*} number 
   */
  createWorkerThread(number) {
    this.workerThreads[number] = {
      worker: undefined,
      execTime: 0
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
          //CRITICAL INFO: WORKER NOT EXECUTE IF THE PATH IS "TOO RELATIVE", KEEP LONG SOURCE
          var w = new Worker(this.workerLocation, {
            type: "module",
          });
          w.onmessage = ({data: {results, exec}}) => {
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
    this.finished = false
    this.maxWorkerCount = navigator.hardwareConcurrency-1;
    this.workerThreads = {};
    this.workerCount = 0;
    this.results = [];
    this.execTime = 0;
    console.log(`Initialized ${this.engine} using worker scope with max workers:${this.maxWorkerCount}`);
  }
}
