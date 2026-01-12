//import { AScriptUtils } from '../utils/ascript-utils.js';
import { getPerformanceMeasures } from "../core/utils/globalUtils.js";
//import { splits } from '../utils/splits.js';
import { openDatabase } from '../core/utils/db-config.js';

/**
 * @description Web worker script for executing WASM computations
 * @module WebWorker
 * @memberof Workers
 * @name WASMWorker
 */
self.onmessage = async (e) => {

  performance.mark("start-script");
  let { id, step, data: inputData, uniqueId, dbConfig } = e.data;

  // Send status update
  if (uniqueId) {
    self.postMessage({
      type: 'status',
      itemId: uniqueId,
      status: 'running'
    });
  }

  let result = null;

  try {
    // Get the item settings from the database
    const db = await openDatabase();
    const settingsStore = db.transaction('settings', 'readonly').objectStore('settings');
    const settings = await new Promise((resolve, reject) => {
      const request = settingsStore.get(uniqueId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (!settings) {
      throw new Error(`Settings not found for item ${uniqueId}`);
    }

    // Extract WASM-specific settings
    const { moduleId, functionName, memoryPages } = settings.arguments;

    // Get the module from IndexedDB
    const module = await getModuleFromDB(moduleId);
    if (!module) {
      throw new Error(`Module ${moduleId} not found in database`);
    }

    // Process input data if provided
    let processedData = null;
    if (inputData) {
      processedData = new Float32Array(inputData);
      //processedData = splits.split1DArray({ data, n: data.length });
    }

    performance.mark("start-function");
    result = handleC(null, functionName, processedData, module);
    performance.mark("end-function");

    let getPerformance = getPerformanceMeasures();

    // Store the result using the provided database config
    if (dbConfig && uniqueId) {
      const resultData = {
        id: uniqueId,
        data: result,
        status: 'completed',
        timestamp: new Date().toISOString()
      };

      const db = await openDatabase();
      const resultsStore = db.transaction('results', 'readwrite').objectStore('results');
      await new Promise((resolve, reject) => {
        const request = resultsStore.put(resultData);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    self.postMessage(
      {
        id,
        results: result,
        step,
        ...getPerformance,
      },
      [result]
    );

    // Update status
    if (uniqueId) {
      self.postMessage({
        type: 'status',
        itemId: uniqueId,
        status: 'completed'
      });
    }
  } catch (error) {
    console.error(`Error executing WASM item ${uniqueId}:`, error);

    // Update status with error
    if (uniqueId) {
      self.postMessage({
        type: 'status',
        itemId: uniqueId,
        status: 'error',
        error: error.message
      });
    }

    self.postMessage({
      type: 'error',
      error: error.message,
      id
    });
  }
};

/**
 * Retrieves a module from IndexedDB using the provided database utility
 * @param {string} moduleId - The ID of the module in the database
 * @returns {Promise<WebAssembly.Module>} The instantiated module
 */
// async function getModuleFromDB(moduleId) {
//     if (!moduleId) {
//         throw new Error('No module ID provided');
//     }

async function getModuleFromDB(moduleId) {
  if (!moduleId) throw new Error('No module ID provided');

  const db = await openDatabase();
  const store = db.transaction('wasmModules', 'readonly').objectStore('wasmModules');

  const moduleData = await new Promise((resolve, reject) => {
    const request = store.get(moduleId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (!moduleData) throw new Error(`Module ${moduleId} not found in database`);

  const memory = new WebAssembly.Memory({
    initial: moduleData.memoryPages || 1,
    maximum: moduleData.memoryPages || 1,
  });

  // Construct the base module object
  const baseModule = {
    wasmMemory: memory,
    print: (text) => console.log(text),
    printErr: (text) => console.error(text),
  };

  if (moduleData.wasmBlob) {
    baseModule.wasmBinary = await moduleData.wasmBlob.arrayBuffer();
  }

  // Load the JS glue code from blob
  const jsCodeText = await moduleData.blob.text();
  const blob = new Blob([jsCodeText], { type: 'application/javascript' });
  const blobURL = URL.createObjectURL(blob);

  // Inject baseModule globally in case of legacy style
  globalThis.Module = baseModule;

  try {
    // Import the Emscripten glue code
    importScripts(blobURL);

    // Check if MODULARIZE-style (createModule function)
    if (typeof createModule === 'function') {
      const mod = await createModule(baseModule);
      URL.revokeObjectURL(blobURL);
      return mod;
    }

    // Otherwise, wait for non-MODULARIZE global `Module`
    if (typeof Module !== 'undefined' && Module instanceof Object) {
      if (typeof Module.then === 'function') {
        const mod = await Module;
        URL.revokeObjectURL(blobURL);
        return mod;
      }

      // Wait for runtime init if needed
      await new Promise((resolve) => {
        if (Module.calledRun) {
          resolve();
        } else {
          Module.onRuntimeInitialized = resolve;
        }
      });

      URL.revokeObjectURL(blobURL);
      return Module;
    }

    throw new Error('Could not detect Emscripten module style (MODULARIZE or legacy)');

  } catch (err) {
    URL.revokeObjectURL(blobURL);
    console.error('Error loading module script:', err);
    throw err;
  }
}
//     try {
//         const db = await openDatabase();
//         const store = db.transaction('wasmModules', 'readonly').objectStore('wasmModules');

//         const moduleData = await new Promise((resolve, reject) => {
//             const request = store.get(moduleId);
//             request.onsuccess = () => resolve(request.result);
//             request.onerror = () => reject(request.error);
//         });

//         if (!moduleData) {
//             throw new Error(`Module ${moduleId} not found in database`);
//         }

//         // Create base memory configuration
//         const memory = new WebAssembly.Memory({
//             initial: moduleData.memoryPages || 1,
//             maximum: moduleData.memoryPages || 1
//         });

//         // Case 1: Pure WASM module
//         if (moduleData.contentType === 'application/wasm') {
//             const wasmBuffer = await moduleData.blob.arrayBuffer();
//             const importObject = {
//                 env: {
//                     memory,
//                     abort: (msg, file, line, column) => {
//                         console.error(`WASM abort: ${msg} at ${file}:${line}:${column}`);
//                     }
//                 }
//             };

//             const instance = await WebAssembly.instantiate(wasmBuffer, importObject);
//             return instance.instance.exports;
//         }

//         // Case 2 & 3: JS module (either with WASM or standalone)
//         const jsCode = await moduleData.blob.text();

//         // Create a base Module object that Emscripten expects
//         const baseModule = {
//             wasmMemory: memory,
//             wasmBinary: null,
//             print: (text) => console.log(text),
//             printErr: (text) => console.error(text),
//             locateFile: (path) => {
//                 // If this is a WASM file and we have a wasmUrl, use it
//                 if (path.endsWith('.wasm') && moduleData.wasmUrl) {
//                     return moduleData.wasmUrl;
//                 }
//                 return path;
//             }
//         };

//         // If we have a WASM blob, add it to the module
//         if (moduleData.wasmBlob) {
//             baseModule.wasmBinary = await moduleData.wasmBlob.arrayBuffer();
//         }

//         // Create script URL from the JS blob
//         const scriptUrl = moduleData.url;

//         // Create a module script that will run in the worker context
//         const moduleScript = `
//             let Module = ${JSON.stringify(baseModule)};
//             ${jsCode}
//             Module;
//         `;

//         // Execute the module script
//         const moduleFunc = new Function('return ' + moduleScript);
//         const Module = moduleFunc();

//         // If this is an Emscripten module, it might need initialization
//         if (typeof Module.then === 'function') {
//             return await Module;
//         }

//         return Module;

//     } catch (error) {
//         console.error('Error getting WASM module:', error);
//         throw error;
//     }
//   });
// }


/**
 * @method handleC
 * @description function for handling parametrization of C-based Web Assembly functions
 * @param {String} moduleName - name of the module running the script
 * @param {String} funcName - name of the function to run in the module
 * @param {Array} data - data object to use for the run
 * @param {Object} module - module run containing the memory alloc functions
 * @returns {ArrayBuffer} - result buffer to be sent back from the worker
 */
const handleC = (moduleName = null, functionName = null, data, module) => {
  let stgRes = null;
  let ptrs = [];
  let r_ptr = 0;
  let outputData = null;
  let d = null;

  const bytes = Float32Array.BYTES_PER_ELEMENT;
  let inputData = data;
  let inputCount = data ? data.length : 0;

  try {
    // If no data is provided, just call the function with no arguments
    if (!data || inputCount === 0) {
      // Call the function without arguments
      r_ptr = module[functionName || '_mainFunc']();
      // Create a small result buffer
      stgRes = new ArrayBuffer(4);
      return stgRes;
    }

    let len = inputData[0].length;

    // Check if we're dealing with a JS-WASM module or pure WASM
    const isJsWasm = typeof module._malloc === 'function';
    const createMemFunc = isJsWasm ? '_malloc' : '_createMem';
    const destroyMemFunc = isJsWasm ? '_free' : '_destroy';

    r_ptr = module[createMemFunc](len * bytes);

    // Allocate memory for input and output arrays
    for (let i = 0; i < inputCount; i++) {
      ptrs.push(module[createMemFunc](len * bytes));
    }

    // Copy input data to memory
    for (let j = 0; j < ptrs.length; j++) {
      module.HEAPF32.set(inputData[j], ptrs[j] / bytes);
    }

    // Call the C function and measure execution time
    performance.mark("start-function");
    if (moduleName === "matrixUtils_c") {
      module[functionName](...ptrs, r_ptr, Math.sqrt(len));
    } else if (moduleName === null) {
      module["_mainFunc"](...ptrs, r_ptr, len);
    } else {
      module[functionName](...ptrs, r_ptr, len);
    }
    performance.mark("end-function");

    // Copy result data from memory and clean up memory
    d = Array.from(new Float32Array(module.HEAPF32.buffer, r_ptr, len));
    outputData = new Float32Array(d);
    stgRes = new ArrayBuffer(outputData.buffer.byteLength);
    new Float32Array(stgRes).set(new Float32Array(outputData.buffer));
  } finally {
    // Clean up allocated memory
    for (let k of ptrs) {
      module[destroyMemFunc](k);
    }
    if (r_ptr) {
      module[destroyMemFunc](r_ptr);
    }
    outputData = null;
    r_ptr = null;
  }
  return stgRes;
};
