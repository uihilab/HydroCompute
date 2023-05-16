import { DAG } from "./utils/globalUtils.js";
import threadManager from "./threadEngine.js";
import { splits } from "./utils/splits.js";
import { jsScripts } from "../javascript/jsScripts.js";
import { avScripts } from "../wasm/modules/modules.js";
import { gpuScripts } from "../webgpu/gpuScripts.js";

/**
 * @class
 * @name engine
 * @description main engine driver for all the available modules in the hydrocompute library
 * @property results - array with results
 * @property execTime - execution time of the running tasks
 * @property engineName - name of the engine running (javascript, wasm, webgpu)
 * @property workerLocation - location of worker script per engine
 */
export default class engine {
  /**
   *@description constructor to set the property variables ready for execution
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
   * @memberof engine
   * @description setter for the current engine name and worker location
   * @param {String} engine - engine worker location to be fetched
   */
  initialize(engineName) {
    this.engineName = engineName;
    this.threads = new threadManager(this.engineName, this.workerLocation);
  }

  /**
   * @method run
   * @memberof engine
   * @description interface method from the compute layer. it resets the values for each of the
   * @param {Object} args - containing the values for each step of isSplit, data, length, functions, funcArgs, dependencies, linked. See documentation for the HydroCompute class for more details
   */
  async run(args) {
    //Default behavior for when no data or no functions are passed.
    if (args.data.length === 0 || args.functions.length === 0) {
      console.error(
        "Please pass the data required for analysis and/or the functions to run."
      );
      return false
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
      isSplit = [],
      //Name of the script used from the passed arguments.
      scriptName = [],
    } = args;

    //The total number of steps will be infered from the number of functions per step.
    let steps = functions.length;

    let stepArgs = [];

    //Separating 
    for (let i = 0; i < steps; i++) {
      let thisFunctions = functions[i],
        thisFunArgs = funcArgs[i],
        thisDep = dependencies[i],
        thisData = data[i],
        thisSplits = isSplit[i],
        thisThreadCount = thisFunctions.length,
        thisDataLength = length[i],
        thisScriptName = scriptName[i];

      //defaults in case there are no inputs from the user
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
        isSplit: thisSplits,
        threadCount: thisThreadCount,
        dependencies: thisDep,
        length: thisDataLength,
        scriptName: thisScriptName
      });
    }

    try {
      //Evluate the execution as a set of trailing down promises that resolve on after the other
      if (linked) {
        var stepResolve = [];

        for (var i = 0; i < stepArgs.length; i++) {
          //THIS NEEDS TO CHANGE
          stepResolve.push((i, data) => {
            return new Promise(async (resolve) => {
              let _args = stepArgs[i];
              //this could be changed
              if (data !== undefined) {
                _args.data = data;
              }
              let p = await this.stepRun(_args);
              resolve(p);
            });
          });
        }

        //Define a trailing down execution
        await DAG({ functions: stepResolve, args: stepArgs[0], type: "steps" });
      } else {
        //Define a step execution
        for (let stepArg of stepArgs) {
          await this.stepRun(stepArg);
        }
      }
      return true
    } catch (error) {
      console.error(
        "There was an error with the execution of the steps."
      );
      throw error;
    }
  }

  /**
   * @method stepRun
   * @memberof engine
   * @description main method for running a simulation. It sets up the way of running
   * the computational engine for each module
   * @param {*} args
   * @returns {Promise} Resolves the type of run to take.
   */
  async stepRun(args) {
    let {
      funcArgs = [],
      functions = [],
      dependencies = [],
      step = 0,
      data = [],
      isSplit = false,
      length = 1,
      threadCount = 0,
      scriptName = undefined
    } = args;

    for (var i = 0; i < threadCount; i++) {
      this.threads.createWorkerThread(i);
    }

    let dataSplits = [];

    //EXAMPLE CASE: If there are multiple functions that do not depend of each other
    //assume that the work can be parallelized
    switch (true) {
      case functions.length === 1:
        dataSplits = data;
        break;
      case functions.length > 0 && dependencies.length === 0 && isSplit:
        dataSplits = splits.main("split1DArray", {
          data: data,
          n: functions.length,
        });
        break;
      case functions.length > 0 && dependencies.length === 0 && !isSplit:
        for (let i = 0; i < functions.length; i++) {
          dataSplits.push(data.slice());
        }
        break;
      case functions.length > 0 && dependencies.length > 0:
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
      splitting: isSplit,
      functions,
      funcArgs,
      threadCount,
      length,
      scriptName
    };

    try {
      //Need to change the dependencies. They can be different for each
      //of the steps linked, or the functions per step.
      let r = await this.taskRunner(_args, step, dependencies);
      return r;
    } catch (error) {
      console.error(
        `There was an error executing step: ${step}.`,
      );
      throw error
    }
  }

/**
 * Runs multiple tasks concurrently using worker threads and dependency graph.
 * @param {object} args - The arguments for concurrent execution.
 * @memberof engine
 * @param {number} step - The step value.
 * @param {Array} dependencies - The dependency graph.
 * @returns {Promise} - A promise that resolves to the result of concurrent execution.
 */
    async concurrentRun(args, step, dependencies) {
      let batchTasks = []
      for (var i = 0; i < args.threadCount; i++) {
        let d = args.data.buffer !== undefined
        ? args.data.buffer
        : args.data[i].buffer;
        var _args = {
          //data: Array.isArray(args.data[0]) ? args.data[i] : args.data,
          data: d,
          id: i,
          funcName: args.functions[i],
          length: args.length,
          step: step,
          funcArgs: args.funcArgs[i],
          scriptName: args.scriptName[i]
        };
        this.threads.initializeWorkerThread(i);
        batchTasks.push(_args)
      }
      try {
        let res = await DAG({
          functions: Object.keys(this.threads.workerThreads).map((key) => {
            return this.threads.workerThreads[key].worker;
          }),
          dag: dependencies,
          args: batchTasks,
          type: "functions",
        });
        return res;
      } catch (error) {
      console.error(
        `There was an error executing the DAG for step: ${step}.`,
      );
      throw error
    }
  }

/**
 * Runs multiple tasks in parallel using worker threads.
 * @param {object} args - The arguments for parallel execution.
 * @memberof engine
 * @param {number} args.threadCount - The total number of threads.
 * @param {function[]} args.functions - The array of functions to execute.
 * @param {Array} args.funcArgs - The array of arguments for each function.
 * @param {number} step - The step value.
 * @returns {Promise<Array>} - A promise that resolves to an array of results.
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
        //item changed, check it out later
        let d =
          args.data.buffer !== undefined
            ? args.data.buffer
            : args.data[j].buffer;
        let workerArgs = {
          data: d,
          id: i,
          funcName: args.functions[i],
          funcArgs: args.funcArgs[i],
          step,
          length: args.length,
          scriptName: args.scriptName[i]
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
 * Executes tasks based on the provided dependencies and step counter.
 * @param {object} args - The arguments for task execution.
 * @memberof engine
 * @param {number} stepCounter - The step counter.
 * @param {Array} dependencies - The dependency graph.
 * @returns {Promise} - A promise that resolves to the result of task execution.
 */
  async taskRunner(args, stepCounter, dependencies) {
    try {
      let x;
      if (dependencies.length > 0) {
        // Sequential Execution
        x = await this.concurrentRun(args, stepCounter, dependencies);
      } else {
        // Parallel Execution
        x = await this.parallelRun(args, stepCounter);
      }
      if (args.threadCount === this.threads.results.length) {
        [this.funcEx, this.scriptEx] = this.threads.execTimes;
  
        this.results.push({
          //step: stepCounter,
          results: this.threads.results,
          funcEx: this.funcEx,
          scriptEx: this.scriptEx,
          funcOrder: this.threads.functionOrder
        });
  
        console.log(
          `Total function execution time: ${this.funcEx} ms\nTotal worker execution time: ${this.scriptEx} ms`
        );
        this.threads.resetWorkers();
      }
      return x;
    } catch (error) {
      this.threads.resetWorkers();
      console.error("An error occurred during task execution.");
      throw error;
    }
  }
  

  /**
   *@description resets all properties of the class
   * @memberof engine
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
   * @method availableScripts
   * @memberof engine
   * @description Returns all the available scripts for each of the engines
   * @returns {Object} available functions for each script on an engine
   */
  availableScripts() {
    if (this.engineName === "javascript") return jsScripts();
    if (this.engineName === "wasm") return avScripts();
    if (this.engineName === "webgpu") return gpuScripts();
  }
}
