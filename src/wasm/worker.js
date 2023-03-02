import { AScriptUtils, getAllModules } from "./modules/modules.js";

//Single worker instance that goes through the while process of data digestion/ingestion
self.onmessage = async (e) => {
  performance.mark('start-script')
  let exec = 0;
  let { funcName, funcArgs = [], id, step } = e.data;
  let data = new Float32Array(e.data.data);
  let wasmSc = await getAllModules();
  let result = null;
  try {
    for (let scr in wasmSc) {
      for (let module in wasmSc[scr]) {
        if (funcName in wasmSc[scr][module]) {
          //points to the current module
          let mod = wasmSc[scr][module],
            ref = mod[funcName];
          // if (scr === "AS") {
          //   let views = new AScriptUtils();
          //   if (module === "matrixUtils") {
          //     //THIS NEEDS TO CHANGE!
          //     data = [
          //       data.slice(0, data.length / 2),
          //       data.slice(data.length / 2, data.length),
          //     ];
          //     funcArgs ?? [];
          //     let mat1 = views.retainP(
          //       views.lowerTypedArray(Float32Array, 4, 2, data[0], mod),
          //       mod
          //     );
          //     let mat2 = views.lowerTypedArray(
          //       Float32Array,
          //       4,
          //       2,
          //       data[1],
          //       mod
          //     );
          //     Object.keys(mod).includes("__setArgumentsLength")
          //       ? mod.__setArgumentsLength(funcArgs.length)
          //       : null;
          //     try {
          //       funcArgs.unshift(mat2), funcArgs.unshift(mat1);
          //       st = performance.now();
          //       result = views.liftTypedArray(
          //         Float32Array,
          //         ref(...funcArgs) >>> 0,
          //         mod
          //       );
          //       end = performance.now();
          //     } finally {
          //       views.releaseP(mat1, mod);
          //     }
          //   } else {
          //     funcArgs ?? [];
          //     let arr = views.lowerTypedArray(Float32Array, 4, 2, data, mod);
          //     mod.__setArgumentsLength(
          //       funcArgs.length === 0 ? 1 : funcArgs.length
          //     );
          //     funcArgs.unshift(arr);
          //     st = performance.now();
          //     result = views.liftTypedArray(
          //       Float32Array,
          //       ref(...funcArgs) >>> 0,
          //       mod
          //     );
          //     end = performance.now();
          //   }
          // } 
          if (scr === "C") {
            result = handleC(module, funcName, data, mod);
          }
          //typeof result === "undefined" ? (result = "") : result;
          //end = performance.now();
          //console.log(result);
          //console.log(`${funcName} execution time: ${end-st} ms`);
          performance.mark('end-script')
          self.postMessage({
            id,
            results: result,
            step,
            funcExec: performance.measure('measure-execution', 'start-function', 'end-function').duration,
            workerExec: performance.measure('measure-execution', 'start-script', 'end-script').duration
          },[result]);
        } 
      }
    }
  } catch (e) {
    console.error(e);
  }
};

const handleAS = (moduleName, functionName, data, module) => {
  let views = new AScriptUtils();
  if (moduleName === "matrixUtils") {
    //THIS NEEDS TO CHANGE!
    data = [
      data.slice(0, data.length / 2),
      data.slice(data.length / 2, data.length),
    ];
    funcArgs ?? [];
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
      st = performance.now();
      result = views.liftTypedArray(Float32Array, ref(...funcArgs) >>> 0, mod);
      end = performance.now();
    } finally {
      views.releaseP(mat1, mod);
    }
  } else {
    funcArgs ?? [];
    let arr = views.lowerTypedArray(Float32Array, 4, 2, data, mod);
    mod.__setArgumentsLength(funcArgs.length === 0 ? 1 : funcArgs.length);
    funcArgs.unshift(arr);
    st = performance.now();
    result = views.liftTypedArray(Float32Array, ref(...funcArgs) >>> 0, mod);
    end = performance.now();
  }
};

const handleC = (moduleName, functionName, data, module) => {
  let stgRes = null;
  let ptrs = [];
  let r_ptr = 0;
  let outputData = null;
  let d = null

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
    performance.mark('start-function');
    if (moduleName === "matrixUtils") {
      module[functionName](...ptrs, r_ptr, Math.sqrt(len));
    } else {
      module[functionName](...ptrs, r_ptr, len);
    }
    performance.mark('end-function');

    // Copy result data from memory and clean up memory
    d = Array.from(new Float32Array(module.HEAPF32.buffer, r_ptr, len));
    //create a new view from the data and pass it as a buffer
    outputData = new Float32Array(d)
    stgRes = new ArrayBuffer(outputData.buffer.byteLength)
    new Float32Array(stgRes).set(new Float32Array(outputData.buffer))
  } finally {
    for (let k of ptrs) {
      module._destroy(k);
    }
    module._destroy(r_ptr);
    outputData = []
    r_ptr = null
    // module._doMemCheck();
  }
  return stgRes;
};

