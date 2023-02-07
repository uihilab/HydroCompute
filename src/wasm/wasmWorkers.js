import { DAG } from "../core/utils/globalUtils.js";
import workerScope from "../core/utils/workers.js";
import {avScripts} from './modules/modules.js'
import { splits } from "../core/utils/splits.js";
import Module from "./modules/C/another_examples.js"


/**
 * @class
 * @name wasmWorkers
 * The data structures supported for the workers scripts are limited to: JSON objects, JS objects, strings, numbers, and arrays
 */
export default class wasmWorkers {
    constructor(params = {}){
    }
  /**
   * 
   * @param {*} args 
   */
  static initialize(args) {
    this.setEngine();
    this.workers = new workerScope('wasmWorkers', this.workerLocation)
    this.extMod = undefined
    this.loadExt()
  }

  static async loadExt(){
    this.extMod = await Module() 
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

    let { funcArgs, data, functions} = args

    let dependencies =
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

    //Need to change the dependencies. They can be different for each
    //of the steps linked, or the functions per step.

    var stepCounter = 0;

    if (args.linked) {
      var stepPromise = [];

      for (var i = 0; i < args.steps; i++) {
        stepPromise.push((args) => {
          return new Promise((resolve) => {
            var _args = {
              //data: Array.isArray(args.data[0]) ? args.data[i] : args.data,
              data : args.data,
              id: i,
              funcName: args.functions[i],
              step: i,
              funcArgs: args.funcArgs[i]
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
        funcArgs: args.funcArgs[i]
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
    this.finished = true
    return res;
  }

  /**
   * 
   * @param {*} args 
   * @param {*} step 
   * @returns 
   */
  static async parallelRun(args, step) {
    let results = [];
    for (var i = 0; i < this.workers.workerCount; i++) {
      let workerArgs = {
        //data: Array.isArray(args.data[0]) ? args.data[i] : args.data,
        //This data can be partitioned so that the worker can access either a 
        data: args.data,
        id: i,
        funcName: args.functions[i],
        funcArgs: args.funcArgs[i],
        step: step,
      };
      this.workers.workerInit(i);
      results.push(
        await this.workers.workerThreads[i].worker(workerArgs)
        );
    }
    this.finished = true;
    return results;
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
    this.workers.finished = true
    return x;
  }

    /**
   * 
   * @returns {Object[]} string concatenation of the available scripts for each script.
   */
    static async availableScripts() { 
        return await avScripts()
    }

    static setEngine() {
        this.wasmMods = {}
        this.functions = [];
        this.execTime = 0;
        this.dataview = undefined;
        this.memory = undefined;
        this.workerLocation = "../../src/wasm/worker.js"
      }

  /**
   * 
   * @returns 
   */
  static async showResults() {
    const r = await this.workers.raiseResults()
    return r
  }

  /**
   * 
   * @returns 
   */
  static getexecTime() {
    return this.workers.execTime;
  }
}