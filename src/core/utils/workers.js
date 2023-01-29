export default class workerScope {
  constructor(name, location) {
    window.Worker
    ? console.log("Web workers engine set.")
    : (() => {return console.error("Web workers API not supported!")})();
    this.engine = name;
    this.finished = false
    this.maxWorkerCount = navigator.hardwareConcurrency;
    this.workerThreads = {};
    this.workerCount = 0;
    this.workerLocation = location;
    this.results = [];
    this.execTime = 0;
    console.log(`Initialized ${this.engine} using worker scope with max workers:${this.maxWorkerCount}`);
  }

  workerSpanner(i) {
    this.workerThreads[i] = {};
    this.workerThreads[i].finished = false;
    this.workerThreads[i].worker = undefined;
  }

  workerInit(i) {
    this.workerThreads[i].worker = (args) => {
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
              (this.execTime = this.execTime + e.data.exec),
              //(i === this.workerCount ? this.finished = true : false),
              w.terminate()
            );
          };
          w.onerror = (e) => {
            console.log(e)
            reject(e.error);
          };
          w.postMessage(args);
        });
      }
  }

  async raiseResults() {
    await this.waitFor(() => {this.finished === true})
    return this.results
  }

}
