// import * as engines from "./core/core.js";
import { kernels } from "./core/kernels.js";
import { splits } from "./core/utils/splits.js";
import { dataCloner } from "./core/utils/globalUtils.js";
import engine from "./core/utils/engine.js";
import webrtc from "./webrtc/webrtc.js";

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
   * Available kernels, keeps track of available instances
   * @method setEngine
   * @param {String} kernel - type of kernel setup by the computation.
   */
  setEngine(kernel) {
    this.currentEngineName = kernel;
    this.currentEngineName === "webrtc"
      ? (this.engine = new webrtc())
      : (this.engine = new engine(
          this.currentEngineName,
          kernels[this.currentEngineName]
        ));

    if (Object.keys(this.enginesCalled).includes(kernel)) {
      this.enginesCalled[kernel] += 1;
    } else {
      this.enginesCalled[kernel] = 1;
    }
  }

  /**
   *
   * @param {Object{}} args - contains callbacks, functions, dataId, and dependencies
   * @param {Boolean} callbacks - true if there are multiple funcitons  to run
   * @param {Array} dataIds - data saved in the availableData object with a specific ID. Might be moved somewhere else in the future
   * @param {Array} funcArgs - array of aditional parameters for functions as strings. Each additional argument per function is an object.
   * @param {Array} dependencies - array of dependencies as numbers if callbacks is true. In format [[], [Dep0], [Dep0, Dep1]]
   * @param {Array} functions - array of functions as strings specifying the functions to run.
   * @returns
   */
  async run(args) {
    args.engine !== undefined ? this.setEngine(args.engine) : null
    //Single data passed into the function.
    //It is better if the split function does the legwork of data allocation per function instead.
    let data = (() => {
      let d = [], l =[]
      try{
      for (let item of this.availableData) {
        for (let id of args.dataIds){
        if (id === item.id) {
        d.push(item.data.slice())
        l.push(item.length)
        }
        }
      }
      return [d,l];
    }
    catch (error) {
      return console.error(
        `Data with nametag: "${id}" not found in the storage.`, error
      );
    }
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
          splitBool: args.callbacks,
          data: data[0],
          length: data[1],
          functions: args.functions,
          funcArgs: args.funcArgs,
          dependencies: args.dependencies,
          linked: this.linked,
        });
        this.setResults();
      } catch (error) {
        console.error("There was an error with the given run", error);
        return error;
      }
    } else {
      return console.error("There was an error pulling the data.");
    }
  }

  /**
   * Result setter once the simulation is finished.
   * @method setResults
   *
   */
  setResults() {
    this.engineResults[`Simulation_${this.instanceRun}`] = {
      engineName: this.currentEngine(),
      results: this.engine.results,
    };
    console.log(`Simulation finished.`);
    //setting results to be saved in main class
    this.engine.setEngine();
  }

  /**
   *
   * @returns name - current engine name set.
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
      length: args.data[0] instanceof Array ? args.data.length : 1,
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
  results(name) {
    if (typeof this.engine === "undefined")
      return console.error(
        "Please set the required engine first before initializing!"
      );
      //this needs change
    return new Float32Array(this.engineResults[name].results[0][0]);
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

  /**
   * 
   * @returns 
   */
  availableResults() {
    return Object.keys(this.engineResults)
  }
}

typeof window !== "undefined" ? (window.hydrocompute = hydrocompute) : null;
export default hydrocompute;
