// import * as engines from "./core/core.js";
import { kernels } from "./core/kernels.js";
import { splits } from "./core/utils/splits.js";
import { dataCloner } from "./core/utils/globalUtils.js";
import engine from "./core/utils/engine.js";

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
    this.instanceRun = 0;
    this.availableData = [];
    this.engineResults = {};
    // console.log(engines)
    // Object.entries(engines).forEach((engine) => {
    //   let [propName, propModule] = engine;
    //   this.kernels = { ...this.kernels, [propName]: propModule };
    // });

    //Initiate the module with the workers api. If required, the user can change to another
    //backend product.
    args.length !== 0
      ? this.setEngine(args[0])
      : (() => {
          console.log("The javascript engine has been set as default.");
          this.setEngine(args.engine || "javascript");
        })();
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
   * @param  {Object{}} args initialize the engine, if any
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
    // if (!this.currentEngineName === "webrtc"){
    this.engine = new engine(this.currentEngineName, kernels[this.currentEngineName]);
  // }
  // else {
  //   this.engine = kernels[this.currentEngineName]
  // }
    if (Object.keys(this.enginesCalled).includes(kernel)) {
      this.enginesCalled[kernel] =+ 1
    } else {
      this.enginesCalled[kernel] = 1;
    }
    this.enginesCalled[kernel] = 1;
    // this.#init();
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
    if (
      (data.length > 0 && args.functions.length > 0) ||
      (data.length === 0 &&
        args.funcArgs.length > 0 &&
        args.functions.length > 0)
    ) {
      //Data passed in raw without splitting
      try {
        this.instanceRun += 1;
        await this.engine.run({
          callbacks: args.callbacks,
          data: data,
          functions: args.functions,
          funcArgs: args.funcArgs,
          dependencies: args.dependencies,
          steps: this.steps,
          linked: this.linked,
        })
        this.setResults()
      } catch (error) {
        console.error("There was an error with the given run", error);
        return error;
      }
    } else {
      return console.error("There was an error pulling the data.");
    }
  }

  setResults() {
    this.engineResults[`Run_${this.instanceRun}`] = {
      engineName:  this.currentEngine(),
      results: [...this.engine.results],
      funcTime: this.engine.funcEx,
      execTime: this.engine.scriptEx,
    };
    console.log(`Finished.`)
    //setting results to be saved in main class

    this.engine.setEngine()
  }

  /**
   *
   * @returns
   */
  currentEngine() {
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
  results() {
    if (typeof this.engine === "undefined")
      return console.error(
        "Please set the required engine first before initializing!"
      );
    return ;
  }

  /**
   *
   * @returns
   */
  availableEngines() {
    return Object.keys(kernels);
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

  async engineScripts() {
    let m = await this.engine.availableScripts();
    if (this.currentEngineName === "wasm") {
      let _m = new Map();
      let stgM = Object.keys(m);
      for (var x of stgM) {
        let stgKeys = m[x].keys();
        for (var y of stgKeys) {
          _m.set(`${x}-${y}`, m[x].get(y));
        }
      }
      return _m;
    }
    return m;
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

  /**
   *
   * @returns
   */
  getexecTime() {
    return this.engine.execTime;
  }

  engineChange(){

  }
}

typeof window !== "undefined" ? (window.hydrocompute = hydrocompute) : null;
export default hydrocompute;
