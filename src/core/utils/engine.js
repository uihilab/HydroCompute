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
   * @method run
   * @description main method for running a simulation. It sets up the way of running
   * the computational engine for each module
   * @param {*} args
   * @returns
   */
  async run(args) {
    if (args.data.length === 0 && args.funcArgs.length === 0) {
      return console.error(`Problem with data.`);
    }

    let {
      funcArgs = [],
      functions = [],
      dependencies = [],
      linked = false,
      steps = 0,
      data = [],
      callbacks = true,
      length = 1
    } = args;

    dependencies =
      typeof dependencies === "undefined" ||
      dependencies === null ||
      dependencies[0] === ""
        ? []
        : dependencies;
    //This still needs improvement
    this.threadCount =
      //Array.isArray(args.data[0])
      //? //assuming the main driver for the workers scope is the length of the data
      // args.data.length
      //: //assuming that the data is a 1D array run or passed by n functions
      //args.linked === true ? this.functions.length * args.steps :
      functions.length;

    for (var i = 0; i < this.threadCount; i++) {
      this.threads.createWorkerThread(i);
    }

    //EXAMPLE CASE: If there are multiple functions that do not depend of each other
    //assume that the work can be parallelized
    //THIS NEEDS TO CHANGE
    if (functions.length > 1 && dependencies.length === 0 && !callbacks) {
      this.dataSplits = splits.main("split1DArray", {
        data: data,
        n: functions.length,
      });
      this.splitting = true;
    } else {
      this.dataSplits = Array.from({length: functions.length}, (_, i) => data.slice());
      //need to change dis
      this.splitting = true;
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
              data: this.dataSplits,
              id: i,
              funcName: functions,
              step: i,
              funcArgs: funcArgs,
              length: length
            };
            let p = this.taskRunner(_args, i, dependencies);
            resolve(p);
          });
        });
      }
      DAG({ functions: stepPromise, args: args, type: "steps" });
    } else {
      while (stepCounter <= steps) {
        await this.taskRunner(args, stepCounter, dependencies);
        stepCounter++;
      }
    }
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
    let data = this.dataSplits;
    for (var i = 0; i < this.threadCount; i++) {
      let d = this.splitting ? data[i].buffer : data.buffer;
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

    for (let i = 0; i < this.threadCount; i += this.threads.maxWorkerCount){
      const batch = {
        functions :[],
        funcArgs: []
      };
      for (let j = i; j < i + this.threads.maxWorkerCount && j < this.threadCount; j++){
        batch.functions.push(args.functions[j]);
        batch.funcArgs.push(args.funcArgs[j]);
      }
      batches.push(batch)
    }
    for (let batch of batches){
      let batchTasks = [];
    for (var i = 0; i < batch.functions.length; i++) {
      let j = last + i;
      let d = this.splitting ? this.dataSplits[j].buffer : this.dataSplits.buffer;
      let workerArgs = {
        data: d,
        id: i,
        funcName: args.functions[i],
        funcArgs: args.funcArgs[i],
        step: step,
        length: length
      };
      this.threads.initializeWorkerThread(i);
      batchTasks.push(this.threads.workerThreads[i].worker(workerArgs));
    }
    let batchResults = await Promise.all(batchTasks);
    results = results.concat(batchResults)
    last += batch.functions.length;
  }
  //console.log(results)
    //return results;
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
    if (this.threadCount === this.threads.results.length) {
      this.results.push(this.threads.results);
      [this.funcEx, this.scriptEx] = this.threads.execTimes;
      //this.setEngine()
      
      console.log(`Total function execution time: ${this.funcEx} ms\nTotal worker execution time: ${this.scriptEx} ms`);
      this.threads.resetWorkers();  
    }
    //return x;
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
