import {
    scriptUtils,
    getAllModules,
    } from './modules/modules.js'
  
//Single worker instance that goes through the while process of data digestion/ingestion
self.onmessage = async (e) => {
  let st = 0, end = 0;
  let {data, funcName, funcArgs} = e.data
  let wasmMods = await getAllModules()
  try {
    Object.keys(wasmMods).forEach((module) => {
      if (Object.keys(wasmMods[module]).includes(funcName)) {
        let mod = wasmMods[module],
        ref = mod[funcName],
        result,
        views = new scriptUtils()
        if (module === "matrixUtils"){
          funcArgs = funcArgs[0]
            let mat1 = views.retainP(
                views.lowerTypedArray(
                    Float32Array, 4, 2, data[0], mod,
                ),
                mod
            );
            let mat2 = views.lowerTypedArray(
                Float32Array, 4, 2, data[1], mod
            );
            Object.keys(mod).includes('__setArgumentsLength') ? mod.__setArgumentsLength(funcArgs.length) : null
            try{
                funcArgs.unshift(mat2), funcArgs.unshift(mat1);
                st = performance.now()
                result = views.liftTypedArray(
                    Float32Array, ref(...funcArgs)>>> 0, mod
                )
                end = performance.now()
            } finally{
                views.releaseP(mat1, mod)

            }
        } else {
          (funcArgs === null || funcArgs === undefined) ? funcArgs = [] : funcArgs;
            let arr = views.lowerTypedArray(
                Float32Array, 4, 2, data, mod
            )
            mod.__setArgumentsLength(funcArgs.length === 0 ? 1 : funcArgs.length);
            funcArgs.unshift(arr)
            st = performance.now()
            result = views.liftTypedArray(
                Float32Array, 
                ref(...funcArgs) >>> 0, mod
            )
        }
        typeof result === "undefined" ? (result = "") : result;
        //end = performance.now();
        self.postMessage({
          id: e.data.id,
          results: result,
          step: e.data.step,
          exec: end - st,
        });
      }
    });
  } catch (e) {
    console.error(e)
  }
};
