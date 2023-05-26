import * as scripts from "./utils/gslCode/gslScripts.js"
/**
 * Retrieves the available GPU scripts and their corresponding functions.
 * @name gpuScripts
 * @returns {Map} - A map of GPU scripts and their functions.
 */
export const gpuScripts = () =>{
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