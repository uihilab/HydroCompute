import { AScriptUtils, getAllModules } from "./modules/modules.js";

//Single worker instance that goes through the while process of data digestion/ingestion
self.onmessage = async (e) => {
  let st = 0,
    end = 0;
  let { funcName, funcArgs = [] } = e.data;
  let data = new Float32Array(e.data.data);
  let wasmSc = await getAllModules();
  let result = null;
  try {
    for (const scr in wasmSc) {
      for (const module in wasmSc[scr]) {
        if (funcName in wasmSc[scr][module]) {
          //points to the current module
          let mod = wasmSc[scr][module],
            ref = mod[funcName];
          if (scr === "AS") {
            let views = new AScriptUtils();
            if (module === "matrixUtils") {
              //THIS NEEDS TO CHANGE!
              data = [
                data.slice(0, data.length / 2),
                data.slice(data.length / 2, data.length),
              ];
              funcArgs = funcArgs[0] || [];
              let mat1 = views.retainP(
                views.lowerTypedArray(Float32Array, 4, 2, data[0], mod),
                mod
              );
              let mat2 = views.lowerTypedArray(
                Float32Array,
                4,
                2,
                data[1],
                mod
              );
              Object.keys(mod).includes("__setArgumentsLength")
                ? mod.__setArgumentsLength(funcArgs.length)
                : null;
              try {
                funcArgs.unshift(mat2), funcArgs.unshift(mat1);
                st = performance.now();
                result = views.liftTypedArray(
                  Float32Array,
                  ref(...funcArgs) >>> 0,
                  mod
                );
                end = performance.now();
              } finally {
                views.releaseP(mat1, mod);
              }
            } else {
              funcArgs ?? []
              let arr = views.lowerTypedArray(Float32Array, 4, 2, data, mod);
              mod.__setArgumentsLength(
                funcArgs.length === 0 ? 1 : funcArgs.length
              );
              funcArgs.unshift(arr);
              st = performance.now();
              result = views.liftTypedArray(
                Float32Array,
                ref(...funcArgs) >>> 0,
                mod
              );
              end = performance.now();
            }
          } else if (scr === "C") {
            if (module === "matrixUtils") {
                //THIS NEEDS TO CHANGE!
                data = [
                  data.slice(0, data.length / 2),
                  data.slice(data.length / 2, data.length),
                ];
                let len = data[0].length, bytes = Float32Array.BYTES_PER_ELEMENT,
                ptr1 = mod._createMem(len*bytes), ptr2 = mod._createMem(len*bytes),
                r_ptr = mod._createMem(len*bytes);
                mod.HEAPF32.set(data[0], ptr1/bytes); mod.HEAPF32.set(data[1], ptr2/bytes);
                st = performance.now();
                mod[funcName](ptr1, ptr2, r_ptr, Math.sqrt(len));
                end = performance.now();
                result = new Float32Array(mod.HEAPF32.buffer, r_ptr, len);
                mod._destroy(ptr1); mod._destroy(ptr2), mod._destroy(r_ptr)
            }
          else {
            let len = data.length, bytes = Float32Array.BYTES_PER_ELEMENT,
            ptr = mod._createMem(len*bytes), r_ptr = mod._createMem(len*bytes);
            mod.HEAPF32.set(data, ptr/bytes);
            st = performance.now();
            mod[funcName](ptr, r_ptr, len)
            end = performance.now();
            result = new Float32Array(mod.HEAPF32.buffer, r_ptr, len);
            mod._destroy(ptr); mod._destroy(r_ptr)
          }
          }
          //typeof result === "undefined" ? (result = "") : result;
          //end = performance.now();
          console.log(result)
          self.postMessage({
            id: e.data.id,
            results: result,
            step: e.data.step,
            exec: end - st,
          }, [result.buffer]);
        }
      };
    };
  } catch (e) {
    console.error(e);
  }
};
