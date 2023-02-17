import { DAG, concatArrays } from "./globalUtils.js";
import workerScope from "./workers.js";
import { splits } from "./splits.js";
import { jsScripts } from "../../javascript/scripts/jsScripts.js";
import { avScripts } from "../../wasm/modules/modules.js";
import { gpuScripts } from "../../webgpu/gpuScripts.js";

/**
 * @class
 * @name engine
 * The data structures supported for the workers scripts are limited to: JSON objects, JS objects, strings, numbers, and arrays
 */
export default class engine {
    constructor(engine, workerLocation){
        this.setEngine();
        this.workerLocation = workerLocation;
        this.initialize(engine)
    }
  /**
   * 
   * @param {*} args 
   */
  initialize(engine) {
    this.engineName = engine
    this.workers = new workerScope(engine, this.workerLocation)
  }

  /**
   *
   * @param {*} args
   * @returns
   */
  async run(args) {
    this.results = [];
    this.execTime = 0;

    if (args.data.length === 0 && args.funcArgs.length === 0) {
      return console.error(`Problem with data.`);
    }

    let { funcArgs = [], functions = [], dependencies = [], linked = false, steps = 0, data = []} = args

    dependencies =
      (typeof dependencies === "undefined") || (dependencies === null) || (dependencies[0] === "") ? [] : dependencies;
    //This still needs improvement
    this.workers.workerCount = 
    //Array.isArray(args.data[0])
      //? //assuming the main driver for the workers scope is the length of the data
        // args.data.length
      //: //assuming that the data is a 1D array run or passed by n functions
      //args.linked === true ? this.functions.length * args.steps : 
      functions.length;

    for (var i = 0; i < this.workers.workerCount; i++) {
      this.workers.createWorkerThread(i);
    }

    //EXAMPLE CASE: If there are multiple functions that do not depend of each other
    //assume that the work can be parallelized
    //THIS NEEDS TO CHANGE
    if (functions.length > 1 && dependencies.length === 0){
      this.dataSplits = splits.main('split1DArray', {data: data, n: functions.length})
      this.splitting = true
    } else {
      this.dataSplits = data.slice()
    }

    //Need to change the dependencies. They can be different for each
    //of the steps linked, or the functions per step.

    let stepCounter = 0;

    if (linked) {
      var stepPromise = [];

      for (var i = 0; i < steps; i++) {
        //THIS NEEDS TO CHANGE
        stepPromise.push((args) => {
          return new Promise((resolve) => {
            //this could be changed
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
      while (stepCounter <= steps) {
        this.taskRunner(args, stepCounter, dependencies);
        stepCounter++;
      }
    }
  }

  /**
   * Running jobs concurrently based on a DAG.
   * It can also run parallel jobs if the dependencies array is passed as a
   * @method concurrentRun
   * @param {Object{}} args
   * @param {Number} step
   * @param {Object[]} dependencies
   * @returns
   */
  async concurrentRun(args, step, dependencies) {
    let data = this.dataSplits
    for (var i = 0; i < this.workers.workerCount; i++) {
      let d = this.splitting 
      ? data[i].buffer 
      : data.buffer;
      var _args = {
        //data: Array.isArray(args.data[0]) ? args.data[i] : args.data,
        data: d,
        id: i,
        funcName: args.functions[i],
        step: step,
        funcArgs: args.funcArgs[i]
      };
      this.workers.initializeWorkerThread(i);
    }
    let res = DAG({
      functions: Object.keys(this.workers.workerThreads).map((key) => {
        return this.workers.workerThreads[key].worker;
      }),
      dag: dependencies,
      args: _args,
      type: "functions",
    });
    return res;
  }

  /**
   * 
   * @param {*} args 
   * @param {*} step 
   * @returns 
   */
  async parallelRun(args, step) {
    let data = this.dataSplits;
    let workerTasks = [];

    for (var i = 0; i < this.workers.workerCount; i++) {
      let d = this.splitting 
      ? data[i].buffer 
      : data.buffer;
      let workerArgs = {
        data: d,
        id: i,
        funcName: args.functions[i],
        funcArgs: args.funcArgs[i],
        step: step,
      };
      this.workers.initializeWorkerThread(i);
      workerTasks.push(this.workers.workerThreads[i].worker(workerArgs));
    }
    await Promise.all(workerTasks);
  }


  /**
   * 
   * @param {*} args 
   * @param {*} stepCounter 
   * @param {*} dependencies 
   * @returns 
   */
  async taskRunner(args, stepCounter, dependencies) {
    //this.workers.results.push([]);
    let x;
    let exeType = null
    if (dependencies.length > 0) {
      // Sequential Execution
      exeType = 'seq'
      x = await this.concurrentRun(args, stepCounter, dependencies);
    } else {
      exeType = 'par'
      //Parallel Execution
      await this.parallelRun(args, stepCounter);
    }
    if (this.workers.workerCount === this.workers.results.length)
      {
        this.results.push(
          exeType === 'seq'? 
          this.workers.results:
          concatArrays(this.workers.results))
        this.execTime = this.workers.execTime
        console.log(`Execution time: ${this.execTime} ms`)
        this.workers.resetWorkers()
      }
    return x;
  }

    /**
   * 
   * @returns {Object[]} string concatenation of the available scripts for each script.
   */

  setEngine() {
        this.execTime = 0;
        this.engineName = null
        this.splitting = false
        this.instanceCounter = 0;
        this.results = [];
        this.dataSplits;
        this.workerLocation = null
      }

  /**
   * 
   * @returns 
   */
  showResults() {
    return this.results
  }

  /**
   * 
   * @returns 
   */
  getexecTime() {
    return this.execTime;
  }

  availableScripts(){
    if (this.engineName === "javascript") return jsScripts();
    if (this.engineName === "wasm") return avScripts();
    if (this.engineName === "webgpu") return gpuScripts();
  }
}