import * as engines from "./core/core.js";
import { splits } from "./core/utils/splits.js";
import { dataCloner, waitFor } from "./core/utils/globalUtils.js";

/**
 * Main class for the compute modules.
 * It creates instances of the different engines available to run concurrent or parallel code instances.
 */

class hydrocompute {
  constructor(...args) {
    this.enginesCalled = {};
    this.engine;
    this.currentEngineName = null;
    this.engineFactory;
    this.kernels = {};
    this.instanceRun = 0;
    this.availableData = [];
    this.engineResults = {}
    Object.entries(engines).forEach((engine) => {
      let [propName, propModule] = engine;
      this.kernels = { ...this.kernels, [propName]: propModule };
    });
    //Initiate the module with the workers api. If required, the user can change to another
    //backend product.
    args.length !== 0
      ? this.setEngine(args[0])
      : (() => {
          console.log("Web workers engine has been set as default.");
          this.setEngine(args.engine || "vanillajs");
        })();

        this.engineResults[`Run_${this.instanceRun}`] = {}
        this.engineResults[`Run_${this.instanceRun}`].results = []
        this.engineResults[`Run_${this.instanceRun}`].executionTime = 0

  }

  /**
   * Verifies that an engine is set.
   * @method isEngineSet
   * @memberof hydrocompute
   */
  isEngineSet() {
    typeof this.engine === "undefined"
      ? () => {
          console.error(
            "Please set the required engine first before initializing!"
          );
        }
      : null;
  }

  /**
   *
   * @param  {Object{}} args initialize the engine
   */
  //Initialize a specific engine
  #init(...args) {
    this.engine.initialize(args);
  }

  /**
   * Available kernels, keeps track of available instances
   * @method setEngine
   * @param {String} kernel - type of kernel setup by the computation.
   */
  setEngine(kernel) {
    this.currentEngineName = kernel;
    this.engine = this.kernels[kernel];
    if (Object.keys(this.enginesCalled).includes(kernel)) {
      this.enginesCalled[kernel] = this.enginesCalled[kernel] + 1;
    } else {
      this.enginesCalled[kernel] = 1;
    }
    this.enginesCalled[kernel] = 1;
    this.#init();
  }

  /**
   *
   * @param {*} engine
   */
  #getEngineFactory(engine) {
    isEngineSet();
    //implementation of all the specific requirements of each kernel
  }

  /**
   *
   * @param {Object{}} args - contains callbacks, functions, dataId, and dependencies
   * @param {Boolean} callbacks - true if there are multiple funcitons  to run
   * @param {String} dataId - data saved in the availableData object with a specific ID. Might be moved somewhere else in the future
   * @param {Object[]} funcArgs - array of aditional parameters for functions as strings. Each additional argument per function is an object.
   * @param {Object[]} dependencies - array of dependencies as numbers if callbacks is true. In format [[], [Dep0], [Dep0, Dep1]]
   * @param {Object[]} functions - array of functions as strings specifying the functions to run.
   * @returns
   */
  async run(args) {

    //Single data passed into the function.
    //It is better if the split function does the legwork of data allocation per function instead.
    let data = (() => {
      for (let item of this.availableData) {
        if (item.id === args.dataId) return item.data;
      }
      return console.error(
        `Data with nametag: "${args.dataId}" not found in the storage.`
      );
    })();
    if (data.length > 0 && functions.length > 0) {
      //Data passed in raw without splitting
      try {
        this.engine.run({
          data: data,
          functions: args.functions,
          funcArgs: args.funcArgs,
          dependencies: args.dependencies,
          steps: this.steps,
          linked: this.linked,
        });
        //setting results to be saved in main class
        this.engineResults[`Run_${this.instanceRun}`].engineName = this.currentEngineName
        this.engineResults[`Run_${this.instanceRun}`].dataId = args.dataId
        this.instanceRun++
      } catch (error) {
        return error;
      }
    } else {
      return console.error("There was an error pulling the data.");
    }
  }

  /**
   *
   * @returns
   */
  currentEgine() {
    return this.currentEngineName;
  }

  /**
   *
   * @param {*} args
   */
  data(args) {
    let container = {
      id: typeof args.id === "undefined" ? this.makeid(5) : args.id,
    };
    if (typeof args.splits === "undefined") {
      container.data = dataCloner(args.data);
      this.availableData.push(container);
    } else {
      let partition = splits.main(args.splits.function, {
        ...args.splits,
        data: dataCloner(args.data),
      });
      container.data = partition;
      this.availableData.push(container);
    }
  }

  /**
   *
   * @returns
   */
  async results() {
    if (typeof this.engine === "undefined")
      return console.error(
        "Please set the required engine first before initializing!"
      );
    if (Object.keys(this.engine).includes('workers')){
      await waitFor(() => {this.engine.finished === true})
      return this.engine.workers.results
    } else {
      await waitFor(() => {this.engine.finished === true})
      return this.engine.results
    }
  }

  /**
   *
   * @returns
   */
  availableEngines() {
    return Object.keys(this.kernels);
  }

  /**
   *
   * @param {Object{}} args - contains steps and connectivity
   * @param {Number} steps - number of steps to run
   * @param {Boolean} linked - specifies if the steps are linked (results trail downwards the execution)
   */
  config(args) {
    this.steps = args.steps ? args.steps : 0;
    this.linked = args.linked ? args.linked : false;
  }

  /**
   *
   * @returns
   */

  engineScripts() {
    return this.engine.availableScripts();
  }

  /**
   *
   * @returns {Object{}} map containing the available split functions in the engines
   */
  availableSplits() {
    let r = Object.keys(splits);
    r = r.filter((ele) => (ele === undefined || ele === "main" ? null : ele));
    return r;
  }

  /**
   * Generates random name conventions for data storage
   * @param {*} length
   * @returns
   */
  makeid(length) {
    let result = "",
    characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  getexecTime() {
    // if (this.engine.workers !== undefined && this.engine !== "jsworkers") {
    //   return this.engine.workers.execTime
    // } else {
      return this.engine.execTime
    // }
  }
}

typeof window !== "undefined" ? (window.hydrocompute = hydrocompute) : null;
export default hydrocompute;