import { AScriptUtils, getAllModules } from "./modules/modules.js";
import { getPerformanceMeasures } from "../core/utils/globalUtils.js";

//Single worker instance that goes through the while process of data digestion/ingestion
self.onmessage = async (e) => {
  performance.mark("start-script");
  let { funcName, funcArgs = [], id, step, length } = e.data;
  let data = new Float32Array(e.data.data);
  let wasmSc = await getAllModules();
  let result = null;
  try {
    for (let scr in wasmSc) {
      for (let module in wasmSc[scr]) {
        if (funcName in wasmSc[scr][module]) {
          //points to the current module
          let mod = wasmSc[scr][module];

          if (scr === "AS"){
            let ref = mod[funcName];
            result = handleAS(module, ref, data, mod, funcArgs);
          }
          else if (scr === "C") {
            result = handleC(module, funcName, data, mod);
          }
          //Any other webassembly module handles would go here

          performance.mark("end-script");

          let getPerformance = getPerformanceMeasures()
          self.postMessage(
            {
              id,
              results: result,
              step,
              funcName,
              ...getPerformance
            },
            [result]
          );
        }
      }
    }
  } catch (error) {
    if (!(error instanceof DOMException) && typeof scripts !== "undefined") {
      console.error(
        `There was an error executing:\nfunction: ${funcName}\nid: ${id}`,
        error
      );
      return 
    } else {
      console.error(
        "There was an error running the script. More info: ",
        error
      );
       return
    }
  }
};

/**
 * 
 * @param {String} moduleName 
 * @param {Object} ref - Object used for running setting arguments in a funciton
 * @param {Array} data - data object to be used for the run 
 * @param {Object} mod - module object used with function 
 * @param {Array} funcArgs - array containing the additional arguments to be used in the function
 * @returns {ArrayBuffer} result object to be sent back from the worker
 */
const handleAS = (moduleName, ref, data, mod, funcArgs) => {
  let views = new AScriptUtils(),
  stgResult = [];
  funcArgs === null ? (funcArgs = []) : funcArgs;
  if (moduleName === "matrixUtils") {
    //THIS NEEDS TO CHANGE!
    data = [
      data.slice(0, data.length >> 1),
      data.slice(data.length >> 1, data.length),
    ];
    funcArgs = [...Array(4)].map((_, i) => Math.sqrt(data[0].length));
    let mat1 = views.retainP(
      views.lowerTypedArray(Float32Array, 4, 2, data[0], mod),
      mod
    );
    let mat2 = views.lowerTypedArray(Float32Array, 4, 2, data[1], mod);
    Object.keys(mod).includes("__setArgumentsLength")
      ? mod.__setArgumentsLength(funcArgs.length)
      : null;
    try {
      funcArgs.unshift(mat2), funcArgs.unshift(mat1);
      performance.mark("start-function");
      stgResult = views.liftTypedArray(
        Float32Array,
        ref(...funcArgs) >>> 0,
        mod
      );
      performance.mark("end-function");
    } finally {
      views.releaseP(mat1, mod);
    }
  } else {
    let arr = views.lowerTypedArray(Float32Array, 4, 2, data, mod);
    mod.__setArgumentsLength(funcArgs.length === 0 ? 1 : funcArgs.length);
    funcArgs.unshift(arr);
    performance.mark("start-function");
    stgResult = views.liftTypedArray(Float32Array, ref(...funcArgs) >>> 0, mod);
    performance.mark("end-function");
  }
  return stgResult.buffer;
};

/**
 * @method handleC
 * @description function for handling parametrization of C-based Web Assembly functions
 * @param {String} moduleName - name of the module running the script
 * @param {String} funcName - name of the function to run in the module
 * @param {Array} data - data object to use for the run
 * @param {Object} module - module run containing the memory alloc functions
 * @returns {ArrayBuffer} - result buffer to be sent back from the worker
 */
const handleC = (moduleName, functionName, data, module) => {
  let stgRes = null;
  let ptrs = [];
  let r_ptr = 0;
  let outputData = null;
  let d = null;

  const bytes = Float32Array.BYTES_PER_ELEMENT;
  let inputData = [data];
  let inputCount = 1;

  // Check if we are working with the "matrixUtils" module, and adjust inputs accordingly
  if (moduleName === "matrixUtils") {
    inputData = [
      data.slice(0, data.length >> 1),
      data.slice(data.length >> 1, data.length),
    ];
    inputCount = 2;
  }
  try {
    let len = inputData[0].length;
    r_ptr = module._createMem(len * bytes);

    // Allocate memory for input and output arrays
    for (let i = 0; i < inputCount; i++) {
      ptrs.push(module._createMem(len * bytes));
    }

    //console.log(inputData.length, ptrs.length, len, r_ptr);

    // Copy input data to memory
    for (let j = 0; j < ptrs.length; j++) {
      module.HEAPF32.set(inputData[j], ptrs[j] / bytes);
    }

    // Call the C function and measure execution time
    performance.mark("start-function");
    if (moduleName === "matrixUtils") {
      module[functionName](...ptrs, r_ptr, Math.sqrt(len));
    } else {
      module[functionName](...ptrs, r_ptr, len);
    }
    performance.mark("end-function");

    // Copy result data from memory and clean up memory
    d = Array.from(new Float32Array(module.HEAPF32.buffer, r_ptr, len));
    //create a new view from the data and pass it as a buffer
    outputData = new Float32Array(d);
    stgRes = new ArrayBuffer(outputData.buffer.byteLength);
    new Float32Array(stgRes).set(new Float32Array(outputData.buffer));
  } finally {
    for (let k of ptrs) {
      module._destroy(k);
    }
    module._destroy(r_ptr);
    outputData = [];
    r_ptr = null;
    // module._doMemCheck();
  }
  return stgRes;
};
