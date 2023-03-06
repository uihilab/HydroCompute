import { DAG } from "./globalUtils.js";
import threadManager from "./workers.js";
import { splits } from "./splits.js";
import { jsScripts } from "../../javascript/scripts/jsScripts.js";
import { avScripts } from "../../wasm/modules/modules.js";
import { gpuScripts } from "../../webgpu/gpuScripts.js";

/**
 * @class
 * @name engine
 * @description main engine driver for all the available modules in the hydrocompute library.
 * @property results - array with results
 * @property execTime - execution time of the running tasks
 * @property engineName - name of the engine running (javascript, wasm, webgpu)
 * @property workerLocation - location of worker script per engine
 */
export default class engine {
  /**
   *
   * @param {String} engine - name of engine running the workers
   * @param {String} workerLocation - location of the worker script running the data
   */
  constructor(engine, workerLocation) {
    this.setEngine();
    this.workerLocation = workerLocation;
    this.initialize(engine);
  }

  /**
   * @method initialize
   * @description setter for the current engine name and worker location
   * @param {String} engine
   */
  initialize(engine) {
    this.engineName = engine;
    this.threads = new threadManager(engine, this.workerLocation);
  }

  /**
   *
   * @param {*} args
   * @returns
   */
  async run(args) {
    //Default behavior for when no data or no functions are passed.
    if (args.data.length === 0 || args.functions.length === 0) {
      return console.error(
        "Please pass the data required for analysis and/or the functions to run."
      );
    }

    let {
      //Array of functions per step: [[fun1, fun2, fun3], [fun1,fun2,fun3]...]
      functions = [],
      //Array of arguments per function per step. Can be empty: [[addArg1, addArg2, addArg3], [addArg1, addArg2, addArg3]...]
      funcArgs = [],
      //Array of dependencies per step per function run: [[[], [0], [1]], [[], [], [0,1]]...]
      dependencies = [],
      //If true, that means that the results from step 0 are trailed down to step 1 and further. If false, then either use the same data or different
      //data will be used at each step. If that is the case, it must be specified as an additional argument.
      linked = false,
      //The data array can be a set of array buffers. In case the steps are linked and the results are trailed down, then only one buffer is required.
      data = [],
      //Length of the data submitted for analysis per step.
      length = [],
      //Array of data splits to be performed per step: [true, false, false, true...]
      splitBool = [],
    } = args;

    //The total number of steps will be infered from the number of functions per step.
    let steps = functions.length;

    let stepArgs = [];

    for (let i = 0; i < steps; i++) {
      let thisFunctions = functions[i],
        thisFunArgs = funcArgs[i],
        thisDep = dependencies[i],
        thisData = data[i],
        thisSplits = splitBool[i],
        thisThreadCount = thisFunctions.length,
        thisDataLength = length[i];

      thisDep =
        typeof thisDep === "undefined" || thisDep === null || thisDep[0] === ""
          ? []
          : thisDep;

      thisFunArgs =
        typeof thisFunArgs === "undefined" || thisFunArgs === null
          ? []
          : thisFunArgs;

      stepArgs.push({
        data: thisData,
        id: i,
        functions: thisFunctions,
        funcArgs: thisFunArgs,
        splitBool: thisSplits,
        threadCount: thisThreadCount,
        dependencies: thisDep,
        length: thisDataLength,
      });
    }

    //Evluate the execution as a set of trailing down promises that resolve on after the other
    if (linked) {
      var stepResolve = [];

      for (var i = 0; i < stepArgs.length; i++) {
        //THIS NEEDS TO CHANGE
        stepResolve.push((i, data) => {
          return new Promise(async (resolve) => {
            let _args = stepArgs[i]
            //this could be changed
            if (data !== undefined){
              _args.data = data
            }
            let p = await this.stepRun(_args);
            resolve(p);
          });
        });
      }
      await DAG({ functions: stepResolve, args: stepArgs[0], type: "steps" });
    } else {
      //execution in case the steps arent connected.
      for (let stepArg of stepArgs) {
        await this.stepRun(stepArg);
      }
    }
  }

  /**
   * @method stepRun
   * @description main method for running a simulation. It sets up the way of running
   * the computational engine for each module
   * @param {*} args
   * @returns
   */
  async stepRun(args) {
    let {
      funcArgs = [],
      functions = [],
      dependencies = [],
      step = 0,
      data = [],
      splitBool = false,
      length = 1,
      threadCount = 0,
    } = args;

    for (var i = 0; i < threadCount; i++) {
      this.threads.createWorkerThread(i);
    }

    let dataSplits = null;

    //EXAMPLE CASE: If there are multiple functions that do not depend of each other
    //assume that the work can be parallelized
    //THIS NEEDS TO CHANGE
    switch(true) {
      case (functions.length === 1):
        dataSplits = data;
        break;
      case (functions.length > 0 && dependencies.length === 0 && splitBool):
        dataSplits = splits.main("split1DArray", {
          data: data,
          n: functions.length,
        });
        break;
      case (functions.length > 0 && dependencies.length === 0 && !splitBool):
        dataSplits = Array.from({ length: functions.length }, (_, i) =>
          data.slice()
        );
        break;
      case (functions.length > 0 && dependencies.length > 0):
        dataSplits = data;
        // Handle the case where there are multiple functions with multiple dependencies
        break;
      default:
        dataSplits = data;
        // Handle any other case that was not anticipated
        break;
    }
    

    let _args = {
      data: dataSplits,
      splitting: splitBool,
      functions,
      funcArgs,
      threadCount,
      length,
    };

    //Need to change the dependencies. They can be different for each
    //of the steps linked, or the functions per step.
    let r = await this.taskRunner(_args, step, dependencies);
    return r
  }

  /**
   * @method concurrentRun
   * @description running jobs concurrently based on a DAG. It can also run parallel jobs if the dependencies array is passed as empty.
   * @param {Object{}} args
   * @param {Number} step
   * @param {Object[]} dependencies
   * @returns
   */
  async concurrentRun(args, step, dependencies) {
    for (var i = 0; i < args.threadCount; i++) {
      let d = args.splitting ? args.data[i].buffer : args.data.buffer;
      var _args = {
        //data: Array.isArray(args.data[0]) ? args.data[i] : args.data,
        data: d,
        id: i,
        funcName: args.functions[i],
        length: args.length,
        step: step,
        funcArgs: args.funcArgs[i],
      };
      this.threads.initializeWorkerThread(i);
    }
    let res = await DAG({
      functions: Object.keys(this.threads.workerThreads).map((key) => {
        return this.threads.workerThreads[key].worker;
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
    const batches = [];
    let results = [];
    let last = 0;

    for (let i = 0; i < args.threadCount; i += this.threads.maxWorkerCount) {
      const batch = {
        functions: [],
        funcArgs: [],
      };
      for (
        let j = i;
        j < i + this.threads.maxWorkerCount && j < args.threadCount;
        j++
      ) {
        batch.functions.push(args.functions[j]);
        batch.funcArgs.push(args.funcArgs[j]);
      }
      batches.push(batch);
    }
    for (let batch of batches) {
      let batchTasks = [];
      for (var i = 0; i < batch.functions.length; i++) {
        let j = last + i;
        let d = args.splitting ? args.data[j].buffer : args.data.buffer;
        let workerArgs = {
          data: d,
          id: i,
          funcName: args.functions[i],
          funcArgs: args.funcArgs[i],
          step,
          length,
        };
        this.threads.initializeWorkerThread(i);
        batchTasks.push(this.threads.workerThreads[i].worker(workerArgs));
      }
      let batchResults = await Promise.all(batchTasks);
      results = results.concat(batchResults);
      last += batch.functions.length;
    }
    return results;
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
    if (dependencies.length > 0) {
      // Sequential Execution
      x = await this.concurrentRun(args, stepCounter, dependencies);
    } else {
      //Parallel Execution
      x = await this.parallelRun(args, stepCounter);
      //console.log(await x)
    }
    if (args.threadCount === this.threads.results.length) {
      [this.funcEx, this.scriptEx] = this.threads.execTimes

      this.results.push(
        {
          //step: stepCounter,
          results: this.threads.results,
          funcEx: this.funcEx,
          scriptEx: this.scriptEx
        });
      //this.setEngine()

      console.log(
        `Total function execution time: ${this.funcEx} ms\nTotal worker execution time: ${this.scriptEx} ms`
      );
      this.threads.resetWorkers();
    }
    return x;
  }

  /**
   *@description resets all properties of the class
   *@method setEngine
   */
  setEngine() {
    this.funcEx = 0;
    this.scriptEx = 0;
    this.engineName = null;
    this.splitting = false;
    this.instanceCounter = 0;
    this.results = [];
    this.dataSplits = [];
    this.workerLocation = null;
  }

  /**
   *
   * @returns
   */
  showResults() {
    return this.results;
  }

  /**
   *
   * @returns
   */
  functionTime() {
    return this.funcEx;
  }

  scriptTime() {
    return this.scriptEx;
  }

  /**
   * @description Returns all the available scripts for each of the engines
   * @method availableScripts
   * @returns {Object} result coming from the type of engine called
   */
  availableScripts() {
    if (this.engineName === "javascript") return jsScripts();
    if (this.engineName === "wasm") return avScripts();
    if (this.engineName === "webgpu") return gpuScripts();
  }
}
