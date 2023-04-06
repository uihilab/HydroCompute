// import * as engines from "./core/core.js";
import { kernels } from "./core/kernels.js";
import { splits } from "./core/utils/splits.js";
import { dataCloner } from "./core/utils/globalUtils.js";
import engine from "./core/engine.js";
import webrtc from "./webrtc/webrtc.js";

/**
 * @description Main class for the compute modules. It creates instances of the different engines available to run concurrent or parallel code instances.
 * @class hydrocompute
 */

class hydrocompute {
  constructor(...args) {
    this.calledEngines = {};
    this.currentEngine;
    this.currentEngineName = null;
    this.engineFactory;
    this.instanceRun = 0;
    this.availableData = [];
    this.engineResults = {};

    //Initiate the module with the workers api. If required, the user can change to another backend product
    args.length !== 0
      ? this.setEngine(args[0])
      : (() => {
          console.log("The javascript engine has been set as default.");
          this.setEngine(args.currentEngine || "javascript");
        })();
  }

  /**
   * @method isEngineSet
   * @description Verifies that an engine is set
   * @memberof hydrocompute
   */
  isEngineSet() {
    typeof this.currentEngine === "undefined"
      ? () => {
          console.error(
            "Please set the required engine first before initializing!"
          );
        }
      : null;
  }

  /**
   * @method setEngine
   * @description Available kernels, keeps track of available instances
   * @memberof hydrocompute
   * @param {String} kernel - type of kernel setup by the computation
   */
  setEngine(kernel) {
    this.currentEngineName = kernel;
    this.currentEngineName === "webrtc"
      ? (this.currentEngine = new webrtc())
      : (this.currentEngine = new engine(
          this.currentEngineName,
          kernels[this.currentEngineName]
        ));

    if (Object.keys(this.calledEngines).includes(kernel)) {
      this.calledEngines[kernel] += 1;
    } else {
      this.calledEngines[kernel] = 1;
    }
  }

  /**
   * @method run
   * @description Run function that used to trigger a simulation.
   * @memberof hydrocompute
   * @param {Object{}} args - contains callbacks, functions, dataId, and dependencies
   * @param {Boolean} callbacks - true if there are multiple funcitons  to run
   * @param {Array} dataIds - data saved in the availableData object with a specific ID. Might be moved somewhere else in the future
   * @param {Array} funcArgs - array of aditional parameters for functions as strings. Each additional argument per function is an object.
   * @param {Array} dependencies - array of dependencies as numbers if callbacks is true. In format [[], [Dep0], [Dep0, Dep1]]
   * @param {Array} functions - array of functions as strings specifying the functions to run.
   * @returns {Object} result saved in the available Results namespace
   */
  async run(args) {
    const {
      engine = this.currentEngine,
      dataIds,
      scriptName = undefined,
      functions,
      funcArgs = [],
      dependencies = [],
      dataSplits = Array.from({length: functions.length}, (_, i) => false)
      
      
    } = args;
    engine !== undefined ? this.setEngine(engine) : null;
    //Single data passed into the function.
    //It is better if the split function does the legwork of data allocation per function instead.
    let data = (() => {
      let dataArray = [],
        lengthArray = [];
      try {
        for (let item of this.availableData) {
          for (let id of dataIds) {
            if (id === item.id) {
              //create a copy that will be cloned down the execution
              dataArray.push(item.data.slice());
              //keep track of the length of items
              lengthArray.push(item.length);
            }
          }
        }
        return [dataArray, lengthArray];
      } catch (error) {
        console.error(
          `Data with nametag: "${id}" not found in the storage.`,
          error
        );
        return null
      }
    })();
    if (
      (data !== null && functions.length > 0) ||
      (data === null && funcArgs.length > 0 && functions.length > 0)
    ) {
      //Data passed in raw without splitting
      try {
        this.instanceRun += 1;
        await this.currentEngine.run({
          isSplit: dataSplits,
          scriptName: scriptName,
          data: data !== null ? data[0] : [],
          length: data !== null ? data[1] : 0,
          functions: functions,
          funcArgs: funcArgs,
          dependencies: dependencies,
          linked: this.linked,
        });
        //Await for results from the engine to finish
        this.setResults(dataIds);
      } catch (error) {
        console.error("There was an error with the given run", error);
        return error;
      }
    } else {
      return console.error("There was an error pulling the data.");
    }
  }

  /**
   * @method setResults
   * @description Result setter once the simulation is finished.
   * @memberof setResults
   */
  setResults(names) {
    const stgOb = Object.fromEntries(
      Object.entries({ ...this.currentEngine.results }).map(([key, value], index) => [
        names[index],
        value,
      ])
    );
    this.engineResults[`Simulation_${this.instanceRun}`] = {
      engineName: this.currentEngine(),
      ...stgOb,
    };
    // let totalExcTime = 
    console.log(`Simulation finished.`);
    //setting results to be saved in main class
    this.currentEngine.setEngine();
  }

  /**
   * @method setTotalTime
   * @description Computes the total time it took a simulation to run and appends to the engine result object
   * @memberof hydrocompute
   */
  setTotalTime(){
    Object.keys(this.engineResults).forEach(key => {
      let ft = 0, st = 0;
      let currentResult = this.engineResults[key];
      for (let resName in currentResult){
        if (resName !== "engineName"){
          ft = ft + currentResult[resName].funcEx;
          st = st + currentResult[resName].scriptEx;
        }
      }
      currentResult.totalFuncTime = ft;
      currentResult.totalScrTime = st;
    })
  }

  /**
   * @method currentEngine
   * @description returns the name of the current engine
   * @memberof hydrocompute
   * @returns {String} name - current engine name set.
   */
  currentEngine() {
    return this.currentEngineName;
  }

  /**
   * @method data
   * @description sets data to the available data namespace and transforms JS arrays into typed arrays.
   * @memberof hydrocompute
   * @param {Object} args - contains id and data
   * @param {String} id - name of the item to be saved. If not ID is provided, then a random name will be given
   * @param {Array} data - n-d array that will be transformed into a typed array
   * @param {String} splits - number of splits to be done on a dataset. See splits namespace for more details
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
   * @method results
   * @description function to return the result for a specific simulation saved in the available results namespace
   * @memberof hydrocompute
   * @param {String} name - name of the simulation as "Simulation_#"
   * @returns {Object} - Object containing the details of the run given
   */
  results(name) {
    if (typeof this.currentEngine === "undefined")
      return console.error(
        "Please set the required engine first before initializing!"
      );
    let stgViewer = [];
    for (let resultName in this.engineResults[name]) {
      let x = [], y = []
      if (resultName !== "engineName" && resultName !== "totalFuncTime" && resultName !== "totalScrTime") {
        for (let k = 0; k < this.engineResults[name][resultName].results.length; k++) {
          let stgRes = this.engineResults[name][resultName].results[k];
          let stgFunc = this.engineResults[name][resultName].funcOrder[k]
          //for (let result in this.engineResults[name][resultName][stgRes].results) {
            if (stgRes.byteLength !== 0) {
              x.push(Array.from(new Float32Array(stgRes)));
              y.push(stgFunc)
            //}
          }
        }
      stgViewer.push({name: resultName, results: x, functions: y })
      }
    }
    return stgViewer;
  }

  /**
   * @method availableEngines
   * @description returns the names of the available engines in the hydrocompute library
   * @memberof hydrocompute
   * @returns {Array} - names of engines
   */
  availableEngines() {
    return Object.keys(kernels);
  }

  /**
   * @method config
   * @description sets configuration for steps and linkeage for a particular simulation
   * @memberof hydrocompute
   * @param {Object} args - contains steps and connectivity
   * @param {Number} steps - number of steps to run
   * @param {Boolean} linked - specifies if the steps are linked (results trail downwards the execution)
   */
  config(args) {
    this.steps = args.steps ? args.steps : 0;
    this.linked = args.linked ? args.linked : false;
  }

  /**
   * @method engineScripts
   * @description returns the available functions for all the engines
   * @memberof hydrocompute
   * @returns {Object} object containing the name of the engine and the available functions
   */
  async engineScripts() {
    let m = await this.currentEngine.availableScripts();
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
   * @method availableSplits
   * @description searches the function splits available for data manipulation
   * @memberof hydrocompute
   * @returns {Object} map containing the available split functions in the engines
   */
  availableSplits() {
    let r = Object.keys(splits);
    r = r.filter((ele) => (ele === undefined || ele === "main" ? null : ele));
    return r;
  }

  /**
   * @method makeid
   * @memberof hydrocompute
   * @description Generates random name conventions for data storage
   * @param {Number} length - lenght of the string to be set as name
   * @returns {String} random name to set data
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
   * @method getresTimes
   * @description helper function that groups the total times for each function for a given simulation
   * @memberof hydrocompute
   * @returns {Array} 
   */
  getresTimes(res) {
    return [this.engineResults[res].totalFuncTime, this.engineResults[res].totalScrTime]
  }

  /**
   * @method getTotalTime
   * @description getter function for obtaining the total time for functions and script runs
   * @memberof hydrocompute
   * @returns {Array} array containing function and script total times
   */
  getTotalTime() {
    let fnTotal = 0, scrTotal = 0;
    for (let result of this.availableResults()){
      let stgRes = this.getresTimes(result)
      fnTotal += stgRes[0],
      scrTotal += stgRes[1]
    }
    return [fnTotal, scrTotal]
  }

  /**
   * @method availableResults
   * @description available functions for 
   * @memberof hydrocompute
   * @returns
   */
  availableResults() {
    return Object.keys(this.engineResults);
  }
}

typeof window !== "undefined" ? (window.hydrocompute = hydrocompute) : null;
export default hydrocompute;
