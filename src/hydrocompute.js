import { kernels } from "./core/kernels.js";
import { splits } from "./core/utils/splits.js";
import { dataCloner, importJSONdata } from "./core/utils/globalUtils.js";
import { openDatabase, storeResultInIndexedDB } from "./core/utils/db-utils.js";
import engine from "./core/mainEngine.js";
import webrtc from "./webrtc/webrtc.js";
import EventBus from "./core/utils/eventBus.js";

/**
 * @description Main class for the compute modules. It creates instances of the different engines available to run concurrent or parallel runs.
 * @class hydroCompute
 * @param {...string} args - Optional argument to set the initial engine.
 * @example
 * const compute = new hydroCompute() // empty constructor - javascript engine
 * const compute = new hydroCompute('wasm') // arguments - engine in arguments set.
 */

class hydroCompute {
  constructor(args = {}) {
    this.calledEngines = {};
    this.currentEngine;
    this.currentEngineName = null;
    this.instanceRun = 0;

    // Optional Event Bus
    this.eventBus = null;

    // Parse arguments
    let initialEngine = 'javascript';
    let options = {};

    if (typeof args === 'string') {
      initialEngine = args;
    } else if (typeof args === 'object') {
      if (args.engine) initialEngine = args.engine;
      options = args;
    }

    // Initialize EventBus if requested
    if (options.enableEventBus || options.eventBus) {
      this.eventBus = options.eventBus instanceof EventBus ? options.eventBus : new EventBus();
    }

    // Removed availableData - strictly using IndexedDB now
    this.engineResults = {};

    // Default DB config
    this.dbConfig = {
      database: 'hydrocomputeDB',
      storeName: 'results'
    }

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
    if (typeof args == 'string') this.setEngine(args)
    else if (Object.keys(args) == 0) this.setEngine('javascript')
    else if (Object.keys(args) != 0 || typeof args == 'object') {
      this.setEngine(args.engine)
    }
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

    // CRITICAL: Store engine instances for stopping
    if (!this.engineInstances) {
      this.engineInstances = new Map();
    }

    if (this.currentEngineName === "webgpu") {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        this.currentEngine = new engine(
          this.currentEngineName,
          kernels[this.currentEngineName],
          this.eventBus
        );
      } catch (error) {
        console.error(
          "WebGPU is not available in your browser. Returning to JavaScript engine."
        );
        this.currentEngineName = "javascript";
        this.currentEngine = new engine(
          this.currentEngineName,
          kernels[this.currentEngineName],
          this.eventBus
        );
      }
    } else {
      this.currentEngineName === "webrtc"
        ? (this.currentEngine = new webrtc()) // webrtc might need eventBus too? leave for now
        : (this.currentEngine = new engine(
          this.currentEngineName,
          kernels[this.currentEngineName],
          this.eventBus
        ));
    }

    // CRITICAL: Store engine instance
    this.engineInstances.set(kernel, this.currentEngine);

    if (Object.keys(this.calledEngines).includes(kernel)) {
      this.calledEngines[kernel] += 1;
    } else {
      this.calledEngines[kernel] = 1;
    }
  }

  /**
   * @description Stop all worker execution and kill all active workers
   * @memberof hydroCompute
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
  stop() {
    console.log('Stopping all engines and killing workers...');

    // Stop current engine
    if (this.currentEngine && typeof this.currentEngine.stop === 'function') {
      this.currentEngine.stop();
    }

    // Stop all stored engine instances
    if (this.engineInstances) {
      for (const [engineName, engineInstance] of this.engineInstances.entries()) {
        if (engineInstance && typeof engineInstance.stop === 'function') {
          try {
            engineInstance.stop();
            console.log(`Stopped ${engineName} engine`);
          } catch (error) {
            console.error(`Error stopping ${engineName} engine:`, error);
          }
        }
      }
    }

    console.log('All engines stopped');
  }

  /**
   * @description Runs the specified functions with the given arguments using the current engine.
   * Enforces usage of IndexedDB for data management and execution synchronization.
   * @memberof hydroCompute
   * @param {Object} args - The configuration object.
   * @returns {Promise<boolean>} - A Promise that resolves once the execution is complete.
   */
  async run(args) {
    this.isEngineSet();

    // Enforce IndexedDB usage
    const useDB = true;

    try {
      // Validate configuration
      // We allow either dataIds (pre-saved) or data (saved on fly)
      // If data passed, save it first
      if (args.data && !args.dataIds) {
        console.log('Data passed directly to run(). Saving to IndexedDB...');
        const savedIds = [];
        const dataArray = Array.isArray(args.data) ? args.data : [args.data];

        for (let i = 0; i < dataArray.length; i++) {
          const item = dataArray[i];
          const id = `auto_${this.makeId(8)}`;
          await this.data({ id, data: item });
          savedIds.push(id);
        }
        args.dataIds = [savedIds]; // Assuming single step for simplicity if not specified
      }

      if (!args.functions || !args.dataIds) {
        throw new Error('Missing required fields: functions or dataIds (or data)');
      }

      // Default dependencies if not provided
      if (!args.dependencies) {
        // Assume parallel execution (no dependencies) if not specified
        args.dependencies = args.functions.map(stepFuncs =>
          stepFuncs.map(() => [])
        );
      }

      // Format the arguments for the engine
      const engineArgs = {
        functions: args.functions,
        args: args.args || args.functions.map(stepFuncs =>
          stepFuncs.map(() => ({ args: {}, params: {} }))
        ),
        dataIds: args.dataIds,
        dependencies: args.dependencies,
        useDB: true,
        dbConfig: {
          database: args.dbConfig?.database || this.dbConfig.database,
          storeName: args.dbConfig?.storeName || this.dbConfig.storeName
        },
        type: args.type,
        engineType: args.engine || this.currentEngineName || 'javascript'
      };

      const flag = await this.currentEngine.run(engineArgs);

      if (flag) {
        // Store execution information
        this.instanceRun += 1;
        const executionId = `run_${this.instanceRun}`;
        this.engineResults[executionId] = {
          engineName: this.currentEngineName,
          ...this.currentEngine.results
        };
      }

      return flag;
    } catch (error) {
      console.error('Error in hydroCompute run:', error);
      throw error;
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
   * Saves the provided data into IndexedDB.
   * Acts as a viewer/manager for the persisted data.
   * @memberof hydroCompute
   * @param {Object|string} args - The data configuration or ID.
   * @param {string} args.id - The ID of the data.
   * @param {any} args.data - The data to save.
   * @returns {Promise<string>} The ID of the saved data.
   */
  async data(args) {
    try {
      let id, data;

      // Handle string arg (legacy or just ID lookup?)
      // For now assume saving new data requires object
      if (typeof args === 'string') {
        // Maybe fetch? But the prompt implies this function saves. 
        // Or if it's just a string, maybe import JSON?
        // Keeping legacy behavior of importing if string path
        let jsonData = await importJSONdata(args);
        data = jsonData;
        id = this.makeId(5);
      } else {
        id = args.id || this.makeId(5);
        data = args.data;
      }

      if (data === undefined) {
        throw new Error("No data provided to save.");
      }

      // Store in IndexedDB
      const dbName = this.dbConfig.database;
      const storeName = this.dbConfig.storeName;

      await storeResultInIndexedDB(dbName, storeName, {
        id: id,
        data: data,
        timestamp: new Date().toISOString(),
        status: 'ready'
      });

      console.log(`Data saved to ${dbName}.${storeName} with ID: ${id}`);
      return id;

    } catch (error) {
      console.error("Data could not be saved to IndexedDB.", error);
      throw error;
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
