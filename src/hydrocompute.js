import * as engines from "./core/core.js";
import { splits } from "./core/utils/splits.js";
import * as scripts from "./workers/scripts/scripts.js";
import { dataCloner } from "./core/utils/globalUtils.js";

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
    this.availableData = [];
    Object.entries(engines).forEach((engine) => {
      let [propName, propModule] = engine;
      this.kernels = { ...this.kernels, [propName]: propModule }
    });
    //Initiate the module with the workers api. If required, the user can change to another
    //backend product.
    args.length !== 0
      ? this.setEngine(args[0])
      : (() => {
          this.steps = 1;
          this.callbacks = false;
          console.log("Web workers engine has been set as default.");
          this.setEngine(args.egine || "workers");
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
   * @param {*} args 
   * @returns 
   */
  async run(args = {}) {
    //Single data passed into the function.
    //It is better if the split function does the legwork of data allocation per function instead.
    let data = (() => {
      for (let item of this.availableData) {
        if (item.id === args.dataId)
          return item.data;
      }
      return console.error(
        `Data with nametag: "${args.dataId}" not found in the storage.`
      );
    })();
    if (this.data.length > 0) {
      //Data passed in raw without splitting
      this.engine.run({
        data: data,
        functions: args.functions,
        dependencies: args.dependencies,
        steps: this.steps,
        linked: this.linked
      });
    } else {
      console.error("There was an error pulling the data.");
      return;
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
      id:
        typeof args.id === "undefined"
          ? `${this.currentEngineName}.${
              this.enginesCalled[this.currentEngineName]
            }.${5 * Math.random().toPrecision(4)}`
          : args.id,
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
  async results () {
    if (typeof this.engine === "undefined")
      console.error(
        "Please set the required engine first before initializing!"
      );
    return await this.engine.showResults();
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
   * @param {*} args 
   */
  config(args) {
    this.steps = args.steps ? args.steps : 0;
    this.linked = args.linked ? args.linked : false;
  }

  /**
   * 
   * @returns {Number} 
   */
  executionTime(){
    return this.engine.getexecTime()
  }

  /**
   * 
   * @returns {Object[]} string concatenation of the available scripts for each script.
   */
  availableScripts() {
    if (this.currentEngineName === "workers") {
      let r = Object.keys(scripts).map((script) => {
        return script;
      });
      let fun = new Map();
      for (let func of r) {
        let fn = []
        for (var i = 0; i < Object.keys(func).length; i++){
          fn.push(Object.keys(scripts[func])[i])
        }

        fn = fn.filter((ele) => ele === undefined || ele === "main" ? null : ele)
        fun.set(func, fn)
      }
      return fun;
    }
  }

  /**
   * 
   * @returns {Object{}} map containing the available split functions in the engines
   */
  availableSplits() {
    if (this.currentEngineName === "workers") {
      let r = Object.keys(splits)
      r = r.filter((ele) => ele === undefined || ele === "main" ? null : ele)   
      return r;
    }
  }
}

typeof window !== "undefined" ? (window.hydrocompute = hydrocompute) : null;
export default hydrocompute;
