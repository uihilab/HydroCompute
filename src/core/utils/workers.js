export default class workerScope {
  constructor(name, location) {
    window.Worker
    ? console.log("Web workers engine set.")
    : (() => {return console.error("Web workers API not supported!")})();
    this.engine = name;
    this.workerLocation = location;
    this.resetWorkers()
  }

  workerSpanner(i) {
    this.workerThreads[i] = {};
    this.workerThreads[i].finished = false;
    this.workerThreads[i].worker = undefined;
  }

  workerInit(i) {
    this.workerThreads[i].worker = (args, buffer) => {
        return new Promise((resolve, reject) => {
          //CRITICAL INFO: WORKER NOT EXECUTE IF THE PATH IS "TOO RELATIVE", KEEP LONG SOURCE
          var w = new Worker(this.workerLocation, {
            type: "module",
          });
          w.onmessage = (e) => {
            const r = e.data.results;
            resolve(
              r,
              (this.workerThreads[i].finished = true),
              // i === this.workerCount ? 
              this.results.push(r) 
              // : null
              ,
              (this.execTime += e.data.exec),
              w.terminate()
            );
          };
          w.onerror = (e) => {
            console.log(e)
            reject(e.error);
          };
          w.postMessage(args, [buffer]);
        });
      }
  }

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
