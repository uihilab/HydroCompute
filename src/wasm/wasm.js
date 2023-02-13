import { DAG, concatArrays } from "../core/utils/globalUtils.js";
import workerScope from "../core/utils/workers.js";
import {avScripts} from './modules/modules.js'
import { splits } from "../core/utils/splits.js";


/**
 * @class
 * @name wasm
 * The data structures supported for the workers scripts are limited to: JSON objects, JS objects, strings, numbers, and arrays
 */
export default class wasm {
    constructor(params = {}){
    }
  /**
   * 
   * @param {*} args 
   */
  static initialize(args) {
    this.setEngine();
    this.workers = new workerScope('wasm', this.workerLocation)
  }

  /**
   *
   * @param {*} args
   * @returns
   */
  static async run(args) {
    this.workers.results = []
    this.workers.execTime = 0
    if (args.data.length === 0) {
      return;
    }

    let { funcArgs, functions, dependencies, linked, steps, data, scripts} = args

    dependencies =
      (typeof args.dependencies === "undefined") || (args.dependencies === null) || (args.dependencies[0] === "") ? [] : args.dependencies;
    //This still needs improvement
    this.workers.workerCount = 
    //Array.isArray(args.data[0])
      //? //assuming the main driver for the workers scope is the length of the data
        // args.data.length
      //: //assuming that the data is a 1D array run or passed by n functions
      //args.linked === true ? this.functions.length * args.steps : 
      functions.length;

    for (var i = 0; i < this.workers.workerCount; i++) {
      this.workers.workerSpanner(i);
    }

    //EXAMPLE CASE: If there are multiple functions that do not depend of each other
    //assume that the work can be parallelized
    if (functions.length > 1 && dependencies.length === 0){
      this.dataSplits = splits.main('split1DArray', {data: data, n: functions.length})
      this.splitting = true
    } else {
      this.dataSplits = data.slice()
    }

    //Need to change the dependencies. They can be different for each
    //of the steps linked, or the functions per step.

    var stepCounter = 0;

    if (linked) {
      var stepPromise = [];

      for (var i = 0; i < steps; i++) {
        stepPromise.push((args) => {
          return new Promise((resolve) => {
            var _args = {
              //data: Array.isArray(args.data[0]) ? args.data[i] : args.data,
              data : this.dataSplits,
              id: i,
              funcName: functions,
              step: i,
              funcArgs: funcArgs
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
    for (var i = 0; i < this.workers.workerCount; i++) {
      var _args = {
        //data: Array.isArray(args.data[0]) ? args.data[i] : args.data,
        data: args.data,
        id: i,
        funcName: args.functions[i],
        step: step,
        funcArgs: args.funcArgs[i],
      };
      this.workers.workerInit(i);
    }
    let res = DAG({
      functions: Object.keys(this.workers.workerThreads).map((key) => {
        return this.workers.workerThreads[key].worker;
      }),
      dag: dependencies,
      args: _args,
      type: "functions",
    });
    this.workers.finished = true
    return res;
  }

  /**
   * 
   * @param {*} args 
   * @param {*} step 
   * @returns 
   */
  static async parallelRun(args, step) {
    let data = this.dataSplits;
    let workerTasks = []

    for (var i = 0; i < this.workers.workerCount; i++) {
      let d = this.splitting ? data[i].buffer : data.buffer
      let workerArgs = {
        //data: Array.isArray(args.data[0]) ? args.data[i] : args.data,
        //This data can be partitioned so that the worker can access either a 
        data: d,
        id: i,
        funcName: args.functions[i],
        funcArgs: args.funcArgs[i],
        step: step,
      };
      this.workers.workerInit(i);
      workerTasks.push(this.workers.workerThreads[i].worker(workerArgs, d));
    }
    await Promise.all(workerTasks);
    this.workers.finished = true;
  }

  /**
   * 
   * @param {*} args 
   * @param {*} stepCounter 
   * @param {*} dependencies 
   * @returns 
   */
  static async taskRunner(args, stepCounter, dependencies) {
    //this.workers.results.push([]);
    let x;
    if (dependencies.length > 0) {
      // Sequential Execution
      x = await this.concurrentRun(args, stepCounter, dependencies);
    } else {
      //Parallel analysis
      x = await this.parallelRun(args, stepCounter);
    }
    if (this.workers.workerCount === this.workers.results.length)
    {
      this.results.push(concatArrays(this.workers.results))
      this.execTime = this.workers.execTime
      console.log(`Execution time: ${this.execTime} ms`)
      this.workers.resetWorkers()
    }
  }

    /**
   * 
   * @returns {Object[]} string concatenation of the available scripts for each script.
   */
    static async availableScripts() { 
        return await avScripts()
    }

    static setEngine() {
      this.execTime = 0;
      this.splitting = false;
      this.results = [];
        this.workerLocation = "../../src/wasm/worker.js"
      }

  /**
   * 
   * @returns 
   */
  static async showResults() {
    return this.results
  }

  /**
   * 
   * @returns 
   */
  static getexecTime() {
    return this.execTime
  }
}