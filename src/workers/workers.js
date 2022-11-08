/**
 * @class
 * @name workers
 * The data structures supported for the workers scripts are limited to: JSON objects, JS objects, strings, numbers, and arrays
 */
export default class workers {
  constructor(props = {}) {
    //defaults
    this.workerCount = props.workerCount || 1;
  }

  static initialize(args) {
    args.length > 0 ? (args = args[0]) : null;
    this.scripts = args.scripts;
    this.maxWorkerCount = navigator.hardwareConcurrency;
    this.results = [];
    this.workers = new Array(this.maxWorkerCount).fill(undefined);
    window.Worker 
      ? (() => {
          console.log("Web workers engine set.")
        })()
      : console.error("Web workers API not supported!");
    
  }

  static run(args) {
    this.functions = args.functions
    args.splits > 0
      ? (() => {
          this.workerCount = args.splits;
          if (this.workerCount > this.maxWorkerCount) {
            console.log(
              `Your hardware can only leverage ${this.maxWorkerCount}, thread count set to max.`
            );
            return this.maxWorkerCount;
          }
        })()
      : (this.workerCount = 1);
    //Considering that its only one function run over the whole dataset
    var _args = {
      data: [args.data[0][0], args.data[1][0]],
      script: this.scripts,
      id: 0,
      function: this.functions[0]
    };

    //running one worker once
    this.workerInit(0)
    this.workerRun(0, _args);

    if (this.workerCount == 1) {
        _args.functions = this.functions[0]
      //this one is assuming that one only worker would be required for the computations
    } else if (this.workerCount > 1) {
        var _args_ = {..._args}
      for (var i = 1; i < this.workerCount; i++) {
        _args_.data = [args.data[0][i], args.data[1][i]];
        _args_.function = this.functions[i]
        _args_.id = i
        this.workerInit(i)
        this.workerRun(i, _args_)
      }
    }
  }

  static workerInit(i) {
    typeof this.workers[i] === "undefined" 
    ?(() => {
        this.workers[i] = new Worker("./src/workers/worker.js", { type: "module" });
        this.workers[i].onmessage = (e) => {
            this.results.push(e.data);
          };
          this.workers[i].onerror = (e) => {
            return e;
          }}
          )() 
    : null
  }

  static workerRun(i, args) {
    this.workers[i].postMessage(args);
    console.log(`Job ${i} has been submitted to the worker`);
  }

  static showData() {
    return this.results;
  }
}
