import { kernels } from "./core/kernels.js";
import { splits } from "./core/utils/splits.js";
import { dataCloner, importJSONdata } from "./core/utils/globalUtils.js";
import engine from "./core/mainEngine.js";
import webrtc from "./webrtc/webrtc.js";

/**
 * @description Main class for the compute modules. It creates instances of the different engines available to run concurrent or parallel runs.
 * @class hydroCompute
 * @param {...string} args - Optional argument to set the initial engine.
 * @example
 * const compute = new hydroCompute() // empty constructor - javascript engine
 * const compute = new hydroCompute('wasm') // arguments - engine in arguments set.
 */

class hydroCompute {
  constructor(...args) {
    this.calledEngines = {};
    this.currentEngine;
    this.currentEngineName = null;
    this.instanceRun = 0;

    this.availableData = [];
    this.engineResults = {};
    /**
     * @typedef {object} hydroCompute.utils
     * @memberof hydroCompute
     */
    this.utils = {
      /**
       * @description Generates random data.
       * @memberof hydroCompute.utils
       * @param {number} size - Size of each array element.
       * @param {number} maxValue - Maximum value for random number generation.
       * @param {number} length - Length of the generated array.
       * @param {boolean} [save=false] - Whether to save the data or not.
       * @returns {Array|void} - Generated random data array or void if saved.
       * 
       */
      genRandomData: (size, maxValue, length, save = false) => {
        let name = `${this.makeId(5)}`;
        const data = Array.from({ length: length }, () =>
          Array.from({ length: size }, () =>
            Math.floor(Math.random() * maxValue)
          )
        );
        if (save) {
          this.data({ id: name, data: data });
          {
            return console.log(`Data has been saved with nametag ${name}`);
          }
        } else return data;
      },
      /**
       * @description Cleans the array by removing Infinity, null, undefined, and NaN values.
       * @memberof hydroCompute.utils
       * @param {Array} array - The array to be cleaned.
       * @returns {Array} - The cleaned array.
       */
      cleanArray: (array) => {
        return array.filter((value) => {
          // Exclude Infinity, null, undefined, and NaN values
          return (
            value !== Infinity &&
            value !== null &&
            value !== undefined &&
            !Number.isNaN(value)
          );
        });
      },
    };

    //Initiate the module with the workers api. If required, the user can change to another backend product
    args.length !== 0
      ? this.setEngine(args[0])
      : (() => {
          console.log("The javascript engine has been set as default.");
          this.setEngine(args.currentEngine || "javascript");
        })();
  }

  /**
   * @description Verifies that an engine is set
   * @memberof hydroCompute
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
   * @description Sets the current engine based on the specified kernel.
   * @memberof hydroCompute
   * @param {string} kernel - The name of the kernel.
   * @returns {Promise<void>} - A Promise that resolves once the engine is set.
   */
  async setEngine(kernel) {
    this.currentEngineName = kernel;

    if (this.currentEngineName === "webgpu") {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        this.currentEngine = new engine(
          this.currentEngineName,
          kernels[this.currentEngineName]
        );
      } catch (error) {
        console.error(
          "WebGPU is not available in your browser. Returning to JavaScript engine."
        );
        this.currentEngineName = "javascript";
        this.currentEngine = new engine(
          this.currentEngineName,
          kernels[this.currentEngineName]
        );
      }
    } else {
      this.currentEngineName === "webrtc"
        ? (this.currentEngine = new webrtc())
        : (this.currentEngine = new engine(
            this.currentEngineName,
            kernels[this.currentEngineName]
          ));
    }

    if (Object.keys(this.calledEngines).includes(kernel)) {
      this.calledEngines[kernel] += 1;
    } else {
      this.calledEngines[kernel] = 1;
    }
  }

  /**
   * @description Runs the specified functions with the given arguments using the current engine. The engine must be set previous to the run function to be called.
   * @memberof hydroCompute
   * @param {Object|string} args - The configuration object or the relative path of the script to run.
   * @param {Array} args.dataIds - An array of data IDs.
   * @param {Array} args.functions - An array of function names.
   * @param {Array} [args.funcArgs=[]] - An array of function arguments.
   * @param {Array} [args.dependencies=[]] - An array specifying the dependencies between functions.
   * @param {Array} [args.scriptName=[]] - An array of script names.
   * @param {Array} [args.dataSplits=[]] - An array specifying if data should be split for each function.
   * @returns {Promise<void>} - A Promise that resolves once the functions are executed.
   * @example
   * //Case 1: Running a script in home folder with 'main' function steering the script and a single data instance saved on 'availableData'
   * await compute.run('scriptName');
   * //Case 2: Running a function from the ones available on each engine using a multiple data ids
   * await compute.run({functions: ['f1', 'f2', 'f3'], dataIds: ['id1', 'id2', 'id3']})
   * //Case 3: Linking steps and linking functions within steps
   * await compute.run({functions: [['f1', 'f2'], ['f3']],, dependencies:[[[], [0]], []] dataIds: ['id1', 'id2', 'id3']})
   */
  async run(
    //CASE 1: functions running on "main" or "_mainFunction" saved on local dev and passing a string
    args = {
      dataIds: [[]],
      functions: ["main"],
      scriptName: [
        this.currentEngineName == "javascript"
          ? "jsExample.js"
          : this.currentEngineName == "webgpu"
          ? "webgpuExample.js"
          : "wasmExample.js",
      ],
    }
  ) {
    //When having to run a script, the user can pass the relative path directly and the compute will do the rest
    if (typeof args === "string") {
      let stgScript = args.slice();
      args = {
        dataIds: [[]],
        functions: ["main"],
        scriptName: [stgScript],
        dependencies: [],
      };
      args.dataSplits = Array.from(
        { length: args.dataIds.length },
        (_, i) => false
      );
    }
    //This will run in case there are no arguments or a configuration object has been passed
    else {
      args = args;
    }
    let {
      //engine = this.currentEngine,
      dataIds = [[]],
      functions,
      funcArgs = [],
      dependencies = [],
      scriptName = [],
      dataSplits = Array.from({ length: dataIds.length }, (_, i) => false),
    } = args;
    //CHANGE: This just moved the mapping done before here but stil needs update!!
    functions = Array.from({ length: dataIds.length }, (_, i) => functions);

    if (dependencies === true) {
      dependencies = [];

      for (let i = 0; i < functions.length; i++) {
        const innerLoop = [];
        for (let j = 0; j < functions[i].length; j++) {
          innerLoop.push(j > 0 ? [j - 1] : []);
        }
        dependencies.push(innerLoop);
      }
    } else if (dependencies.length > 0 && dataIds.length === 1) {
      dependencies = Array.from({ length: functions[0].length }, () => []);
    } else if (dependencies.length > 0 && dataIds.length > 1) {
      dependencies = Array.from({ length: dataIds.length }, () => dependencies);
    }

    scriptName = Array.from({ length: dataIds.length }, (_, i) => scriptName);

    for (let i = 0; i < dataIds.length; i++) {
      if (typeof dataIds[i] === "number") {
        dataIds[i] = JSON.stringify(dataIds[i]);
      }
    }

    //Single data passed into the function.
    //It is better if the split function does the legwork of data allocation per function instead.
    let data = (() => {
      let dataArray = [],
        lengthArray = [];
      try {
        //Case there is only one dataset available within the framework
        if (this.availableData.length === 1) {
          dataArray.push(this.availableData[0].data.slice());
          lengthArray.push(this.availableData[0].length);
        } else {
          for (let item of this.availableData) {
            //if the user has passed multiple data into the framework
            for (let id of dataIds) {
              if (id === item.id) {
                //create a copy that will be cloned down the execution
                dataArray.push(item.data.slice());
                //keep track of the length of items
                lengthArray.push(item.length);
              }
            }
          }
        }
        return [dataArray, lengthArray];
      } catch (error) {
        console.error(
          `Data with nametag: "${id}" not found in the storage.`,
          error
        );
        return null;
      }
    })();
    if (
      (data !== null && functions.length > 0) ||
      (data === null && funcArgs.length > 0 && functions.length > 0) ||
      (typeof data[0].length !== "undefined" && data[0].length !== 0)
    ) {
      //Data passed in raw without splitting
      try {
        this.instanceRun += 1;
        let flag = await this.currentEngine.run({
          isSplit: dataSplits,
          scriptName,
          data: data !== null ? data[0] : [],
          length: data !== null ? data[1] : 0,
          functions,
          funcArgs,
          dependencies,
          linked: args.linked || false,
        });
        //functions = Array.from({length: dataIds.length}, (_, i) => functions)
        //Await for results from the engine to finish
        if (flag) {
          this.setResults(dataIds);
        }
      } catch (error) {
        console.error(
          "There was an error with the given run. More info: ",
          error
        );
        return;
      }
    } else {
      return console.error("There was an error pulling the data.", error);
    }
  }

  /**
   * Sets the results of the current engine and stores them in the `engineResults` object.
   * @memberof hydroCompute
   * @param {Array} names - An array of names corresponding to the data IDs.
   * @returns {void}
   */
  setResults(names) {
    const stgOb = Object.fromEntries(
      Object.entries({ ...this.currentEngine.results }).map(
        ([key, value], index) => [names[index], value]
      )
    );
    this.engineResults[`Simulation_${this.instanceRun}`] = {
      engineName: this.currentEngineName,
      ...stgOb,
    };

    console.log(`Simulation finished.`);
    //setting results to be saved in main class
    this.currentEngine.setEngine();
  }

  /**
   * Calculates and sets the total function time and total script time for each result in the `engineResults` object.
   * @memberof hydroCompute
   * @returns {void}
   */
  setTotalTime() {
    Object.keys(this.engineResults).forEach((key) => {
      let ft = 0,
        st = 0;
      let currentResult = this.engineResults[key];
      for (let resName in currentResult) {
        if (resName !== "engineName") {
          ft = ft + currentResult[resName].funcEx;
          st = st + currentResult[resName].scriptEx;
        }
      }
      currentResult.totalFuncTime = ft;
      currentResult.totalScrTime = st;
    });
  }

  /**
   * Returns the name of the current engine.
   * @memberof hydroCompute
   * @returns {string} The name of the current engine.
   */
  currentEngine() {
    return this.currentEngineName;
  }

  /**
   * Saves the provided data into the available data storage.
   * @memberof hydroCompute
   * @param {Object|string} args - The data to be saved. It can be passed as an object or a string.
   * @param {string} args.id - (Optional) The ID of the data container. If not provided, a random ID will be generated.
   * @param {Array|number|string} args.data - The data to be saved. It can be an array, a number, or a string.
   * @param {Object} args.splits - (Optional) The splitting configuration for the data.
   */
  async data(args) {
    try {
      //Assuming the args is being passed as a string fetching a JSON object
      if (typeof args === "string") {
        let jsonData = await importJSONdata(args);
        args = { data: jsonData };
      } else {
        //Assuming the user is passing an object with di, data, and splitting definition
        args = args;
      }
      //Set container
      let container = {
        id: typeof args.id === "undefined" ? this.makeId(5) : args.id,
        length: args.data[0] instanceof Array ? args.data.length : 1,
      };
      typeof args.data[0] === "string"
        ? (args.data = args.data.map(Number))
        : null;
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
    } catch (error) {
      console.log("Data could not be saved. More info: \n", error);
      return;
    }
  }

  /**
   * Retrieves the results for a specific simulation by name.
   * @memberof hydroCompute
   * @param {string} name - The name of the simulation.
   * @returns {Array} - An array of objects containing the results and associated functions.
   */
  results(name) {
    if (typeof this.currentEngine === "undefined")
      return console.error(
        "Please set the required engine first before initializing!"
      );
    let stgViewer = [];
    for (let resultName in this.engineResults[name]) {
      let x = [],
        y = [];
      if (
        resultName !== "engineName" &&
        resultName !== "totalFuncTime" &&
        resultName !== "totalScrTime"
      ) {
        for (
          let k = 0;
          k < this.engineResults[name][resultName].results.length;
          k++
        ) {
          let stgRes = this.engineResults[name][resultName].results[k];
          let stgFunc = this.engineResults[name][resultName].funcOrder[k];
          //for (let result in this.engineResults[name][resultName][stgRes].results) {
          if (stgRes.byteLength !== 0) {
            x.push(Array.from(new Float32Array(stgRes)));
            y.push(stgFunc);
            //}
          }
        }
        stgViewer.push({ name: resultName, results: x, functions: y });
      }
    }
    return stgViewer;
  }

  /**
   * Retrieves the available engines.
   * @memberof hydroCompute
   * @returns {Array} - An array containing the names of the available engines.
   */
  availableEngines() {
    return Object.keys(kernels);
  }

  /**
   * Retrieves the available engine scripts.
   * @memberof hydroCompute
   * @returns {Promise<Map>} - A Promise that resolves to a Map object containing the available engine scripts.
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
    } else if (this.currentEngineName === "webrtc")
      console.log(
        "No scripts available to run in the webrtc engine. Please checkout documentation"
      );
    else return m;
  }

  /**
   * Searches the function splits available for data manipulation
   * @memberof hydroCompute
   * @returns {Object} map containing the available split functions in the engines
   */
  availableSplits() {
    let r = Object.keys(splits);
    r = r.filter((ele) => (ele === undefined || ele === "main" ? null : ele));
    return r;
  }

  /**
   * Generates a random ID string.
   * @memberof hydroCompute
   * @param {number} length - The length of the ID string.
   * @returns {string} - The generated ID string.
   */
  makeId(length) {
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
   * Retrieves the total function time and total script time for a specific result.
   * @memberof hydroCompute
   * @param {string} res - The name of the result.
   * @returns {number[]} - An array containing the total function time and total script time.
   */
  getResTimes(res) {
    return [
      this.engineResults[res].totalFuncTime,
      this.engineResults[res].totalScrTime,
    ];
  }

  /**
   * Calculates the total function time and total script time for all available results.
   * @memberof hydroCompute
   * @returns {number[]} - An array containing the total function time and total script time.
   */
  getTotalTime() {
    let fnTotal = 0,
      scrTotal = 0;
    for (let result of this.availableResults()) {
      let stgRes = this.getResTimes(result);
      (fnTotal += stgRes[0]), (scrTotal += stgRes[1]);
    }
    return [fnTotal, scrTotal];
  }

  /**
   * Retrieves the available results stored in the `engineResults` object.
   * @memberof hydroCompute
   * @returns {string[]} - An array containing the names of the available results.
   */
  availableResults() {
    return Object.keys(this.engineResults);
  }
}

typeof window !== "undefined" ? (window.hydroCompute = hydroCompute) : null;
export default hydroCompute;
