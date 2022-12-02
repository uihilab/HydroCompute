import { DAG, promisify } from "../core/utils/globalUtils.js";

/**
 * @class
 * @name workers
 * The data structures supported for the workers scripts are limited to: JSON objects, JS objects, strings, numbers, and arrays
 */
export default class workers {
  constructor(props = {}) {
    //defaults
    //this.workerCount = 0;
  }

  static initialize(args) {
    this.instanceCounter = 0;
    this.maxWorkerCount = navigator.hardwareConcurrency;
    this.results = [];
    this.workers = {};
    window.Worker
      ? (() => {
          console.log("Web workers engine set.");
        })()
      : console.error("Web workers API not supported!");
  }

  static run(args) {
    if (args.data.length === 0) {
      return;
    }
    var instaceRun = {};
    instaceRun.id = `Run ${this.instanceCounter}`;
    instaceRun.values = [];
    this.functions = args.functions;
    var dependencies =
      typeof args.dependencies === "undefined" ? [] : args.dependencies;
    //need to change this
    this.workerCount = this.functions.length;

    for (var i = 0; i < this.workerCount; i++) {
      this.workerSpanner(i);
    }

    if (args.steps >= 1) {
      var stepCounter = 0;

      while (stepCounter <= args.steps) {
        this.results.push([]);

        //Sequential analysis
        if (dependencies.length > 0) {
          // this.sequentialRun(args, stepCounter, dependencies);
          this.sequentialRun(args, stepCounter,dependencies)
        } else {
          //Parallel analysis
          this.parallelRun(args, stepCounter);
        }
        stepCounter++;
      }
    }
    //TODO: terminate all workers
    // Object.keys(this.workers).forEach(worker =>{
    //   this.workers[`${worker}`].worker.terminate()
    // })

    this.instanceCounter++;
  }

  static sequentialRun(args, step, dependencies) {
    for (var i =0; i < this.functions.length; i++){
    var _args = {
       data: args.data,
       id: i,
       function: this.functions[i],
       step: step,
    };
    this.workerInit(i)
  }
  DAG(Object.keys(this.workers).map(key => {return this.workers[key].worker}), dependencies, _args)
  }

  static parallelRun(args, step) {
    //This is in case the number of workers available are bigger than the required simulations.
    if (this.workerCount < this.maxWorkerCount) {
      for (var i = 0; i < this.workerCount; i++) {
        var _args = {
          data: args.data,
          id: i,
          function: this.functions[i],
          step: step,
        };
        this.workerInit(i, _args);
      }
    } else {
      var counter = new Array(this.workerCount - this.maxWorkerCount)
        .fill()
        .map((d, i) => this.maxWorkerCount + i);
      //first batch
      for (var i = 0; i < this.maxWorkerCount; i++) {
        var _args = {
          data: args.data,
          id: i,
          function: this.functions[i],
          step: step,
        };
        this.workerInit(i, _args);
        this.workers[i].worker()
      }
      //THIS NEEDS CHANGE!
      for (var j = this.maxWorkerCount + 1; j < this.workerCount; j++) {
        var _args = {
          data: args.data,
          id: counter[j],
          function: this.functions[counter[j]],
          step: step,
        };
        this.workerInit(counter[j], _args);
        this.workers[j].worker()
      }
    }
  }

  static workerSpanner(i) {
    this.workers[i] = {};
    this.workers[i].finished = false;
    this.workers[i].worker = undefined;
  }

  static workerInit(i) {
    this.workers[i].worker =
    (args) => {
      return new Promise((resolve, reject) => {
      var w = new Worker("./src/workers/worker.js", {
      type: "module",
    });
    w.postMessage(args);
    w.onmessage = (e) => {
      resolve(
        e.data.results,
        this.workers[i].finished = true,
        this.results[args.step].push(e.data.results),
        )
    };
    w.onerror = (e) => {
      reject(e.error);
    };
  })
}
  }
  static showResults() {
    return this.results
  }
}
