import { DAG } from "../core/utils/globalUtils.js";

/**
 * @class
 * @name workers
 * The data structures supported for the workers scripts are limited to: JSON objects, JS objects, strings, numbers, and arrays
 */
export default class workers {
  constructor(props = {}) {
    //defaults, if any
  }

  /**
   * 
   * @param {*} args 
   */
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

  /**
   *
   * @param {*} args
   * @returns
   */
  static async run(args) {
    if (args.data.length === 0) {
      return;
    }
    this.workers = {};
    const instaceRun = {};
    instaceRun.id = `Run ${this.instanceCounter}`;
    instaceRun.values = [];
    this.functions = args.functions;
    let dependencies =
      typeof args.dependencies === "undefined" ? [] : args.dependencies;
    //This still needs improvement
    this.workerCount = Array.isArray(args.data[0])
      ? //assuming the main driver for the workers scope is the length of the data
        args.data.length
      : //assuming that the data is a 1D array run or passed by n functions
        this.functions.length;

    for (var i = 0; i < this.workerCount; i++) {
      this.workerSpanner(i);
    }

    //Need to change the dependencies. They can be different for each
    //of the steps linked, or the functions per step.

    var stepCounter = 0;

    if (args.linked) {
      var stepPromise = [];

      for (var i = 0; i < args.steps; i++) {
        stepPromise.push((args) => {
          return new Promise((resolve) => {
            var _args = {
              data: Array.isArray(args.data[0]) ? args.data[i] : args.data,
              id: i,
              function: this.functions[i],
              step: i,
            };
            let p = this.taskRunner(_args, i, dependencies);
            resolve(p);
          });
        });
      }
      DAG({ functions: stepPromise, args: args, type: "steps" });
    } else {
      while (stepCounter <= args.steps) {
        this.taskRunner(args, stepCounter, dependencies);
        stepCounter++;
      }
    }
    this.instanceCounter++;
  }

  /**
   * Running jobs concurrently through based on an acyclic graph implementation.
   * It can also run parallel jobs if the dependencies array is passed as a
   * @method concurrentRun
   * @param {Object{}} args
   * @param {Number} step
   * @param {Object[]} dependencies
   * @returns
   */
  static async concurrentRun(args, step, dependencies) {
    for (var i = 0; i < this.workerCount; i++) {
      var _args = {
        data: Array.isArray(args.data[0]) ? args.data[i] : args.data,
        id: i,
        function: this.functions[i],
        step: step,
      };
      this.workerInit(i);
    }
    let res = DAG({
      functions: Object.keys(this.workers).map((key) => {
        return this.workers[key].worker;
      }),
      dag: dependencies,
      args: _args,
      type: "functions",
    });
    return res;
  }

  // static async parallelRun(args, step) {
  //   var r = [];
  //   //instead of running the function by spanning new workers, create a dependency DAG with 0 dependencies
  //   //for each worker.
  //   //let dependencies = Array.from({ length: functions.length }, (_, i) => []);
  //   //Parallel analysis
  //   //r = await this.concurrentRun(args, step, dependencies);
  //   //This is in case the number of workers available are bigger than the required simulations.
  //   if (this.workerCount < this.maxWorkerCount) {
  //     for (var i = 0; i < this.workerCount; i++) {
  //       var _args = {
  //         data: args.data[i],
  //         id: i,
  //         function: this.functions[i],
  //         step: step,
  //       };
  //       this.workerInit(i);
  //       r.push(await this.workers[i].worker(_args));
  //     }
  //   } else {
  //     var counter = new Array(this.workerCount - this.maxWorkerCount)
  //       .fill()
  //       .map((d, i) => this.maxWorkerCount + i);
  //     //first batch
  //     for (var i = 0; i < this.maxWorkerCount; i++) {
  //       var _args = {
  //         data: args.data[i],
  //         id: i,
  //         function: this.functions[i],
  //         step: step,
  //       };
  //       this.workerInit(i);
  //       r.push(await this.workers[i].worker(_args));
  //     }
  //     //THIS NEEDS CHANGE!
  //     for (var j = this.maxWorkerCount + 1; j < this.workerCount; j++) {
  //       var _args = {
  //         data: args.data[j],
  //         id: counter[j],
  //         function: this.functions[counter[j]],
  //         step: step,
  //       };
  //       this.workerInit(counter[j]);
  //       r.push(await this.workers[j].worker(_args));
  //     }
  //   }
  //   return r;
  // }
  /**
   * 
   * @param {*} args 
   * @param {*} step 
   * @returns 
   */
  static async parallelRun(args, step) {
    let results = [];

    const counter =
      this.workerCount < this.maxWorkerCount
        ? new Array(Math.abs(this.workerCount - this.maxWorkerCount))
            .fill()
            .map((d, i) => this.maxWorkerCount + i)
        : [];

    for (let i = 0; i < this.workerCount; i++) {
      const workerArgs = {
        data: Array.isArray(args.data[0]) ? args.data[i] : args.data,
        id: i,
        function: this.functions[i],
        step: step,
      };
      this.workerInit(i);
      results.push(await this.workers[i].worker(workerArgs));
    }

    return results;
  }

  /**
   * 
   * @param {*} i 
   */
  static workerSpanner(i) {
    this.workers[i] = {};
    this.workers[i].finished = false;
    this.workers[i].worker = undefined;
  }

  /**
   * 
   * @param {*} i 
   */
  static workerInit(i) {
    this.workers[i].worker = (args) => {
      return new Promise((resolve, reject) => {
        var w = new Worker("./src/workers/worker.js", {
          type: "module",
        });
        w.postMessage(args);
        w.onmessage = (e) => {
          const r = e.data.results;
          resolve(
            r,
            (this.workers[i].finished = true),
            this.results.push(r),
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

  /**
   * 
   * @param {*} args 
   * @param {*} stepCounter 
   * @param {*} dependencies 
   * @returns 
   */
  static async taskRunner(args, stepCounter, dependencies) {
    this.results.push([]);
    let x;
    if (dependencies.length > 0) {
      // Sequential Execution
      x = await this.concurrentRun(args, stepCounter, dependencies);
    } else {
      //Parallel analysis
      x = await this.parallelRun(args, stepCounter);
    }
    return x;
  }

  /**
   * 
   * @returns 
   */
  static showResults() {
    return this.results;
  }

  /**
   * 
   * @returns 
   */
  static getexecTime() {
    return this.execTime;
  }
}
