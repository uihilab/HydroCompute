import { DAG, promisify } from "../core/utils/globalUtils.js";

/**
 * @class
 * @name workers
 * The data structures supported for the workers scripts are limited to: JSON objects, JS objects, strings, numbers, and arrays
 */
export default class workers {
  constructor(props = {}) {
    //defaults, if any
  }

  static initialize(args) {
    this.execTime = 0;
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

  static async run(args) {
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

    //Need to change the dependencies. They can be different for each
    //of the steps linked, or the functions per step.

    //if (args.steps >= 1) {
    var stepCounter = 0;

    if (args.linked) {
      var stepPromise = [];
      //Execute the first step.
      if (stepCounter === 0) {
        stepPromise.push(
          (args) => {
            return new Promise(resolve => {
                resolve(this.taskRunner(args, 0, dependencies))                
            })
          });
      }
      for (var i = 1; i < args.steps; i++) {
        stepPromise.push((args) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              args.data = this.results
              [i - 1]
              [this.functions.length];
              resolve(this.taskRunner(args, i, dependencies));
            }, 1000);
          });
        });
      }
      for (let promise of stepPromise) await promise(args)
      // stepPromise.reduce((promise, currPromise) => promise.then(()=>{
      //   currPromise()}), Promise.resolve())
    }

    else{

    while (stepCounter <= args.steps) {
      this.taskRunner(args, stepCounter, dependencies);
      stepCounter++;
    }
  }
    this.instanceCounter++;
  }

  static concurrentRun(args, step, dependencies) {
    for (var i = 0; i < this.functions.length; i++) {
      var _args = {
        data: args.data,
        id: i,
        function: this.functions[i],
        step: step,
      };
      this.workerInit(i);
    }
    DAG(
      Object.keys(this.workers).map((key) => {
        return this.workers[key].worker;
      }),
      dependencies,
      _args
    );
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
        this.workerInit(i);
        this.workers[i].worker(_args);
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
        this.workerInit(i);
        this.workers[i].worker(_args);
      }
      //THIS NEEDS CHANGE!
      for (var j = this.maxWorkerCount + 1; j < this.workerCount; j++) {
        var _args = {
          data: args.data,
          id: counter[j],
          function: this.functions[counter[j]],
          step: step,
        };
        this.workerInit(counter[j]);
        this.workers[j].worker(_args);
      }
    }
  }

  static workerSpanner(i) {
    this.workers[i] = {};
    this.workers[i].finished = false;
    this.workers[i].worker = undefined;
  }

  static workerInit(i) {
    this.workers[i].worker = (args) => {
      return new Promise((resolve, reject) => {
        var w = new Worker("./src/workers/worker.js", {
          type: "module",
        });
        w.postMessage(args);
        w.onmessage = (e) => {
          resolve(
            e.data.results,
            (this.workers[i].finished = true),
            this.results[args.step].push(e.data.results),
            (this.execTime = this.execTime + e.data.exec),
            w.terminate()
          );
        };
        w.onerror = (e) => {
          reject(e.error);
        };
      });
    };
  }

  static taskRunner(args, stepCounter, dependencies) {
    this.results.push([]);
    if (dependencies.length > 0) {
      // Sequential Execution
      this.concurrentRun(args, stepCounter, dependencies);
    } else {
      //Parallel analysis
      this.parallelRun(args, stepCounter);
    }
  }

  static showResults() {
    return this.results;
  }

  static getexecTime(){
    return this.execTime
  }
}
