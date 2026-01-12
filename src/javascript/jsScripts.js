import * as scripts from './scripts/scripts.js'

/**
 * @description Retrieves available JavaScript analysis scripts and their exported functions.
 * Scans the 'scripts' directory structure and maps generic script names to their specific available functions.
 * This map is used by the ComputeEngine to validate and route function calls.
 * 
 * @memberof Scripts
 * @module JSScripts
 * @function jsScripts
 * @returns {Map<string, string[]>} A map where keys are script names and values are arrays of available function names.
 */
export const jsScripts = () => {
  let r = Object.keys(scripts).map((script) => {
    return script;
  });
  let fun = new Map();
  for (let func of r) {
    let fn = []
    for (var i = 0; i < Object.keys(func).length; i++) {
      fn.push(Object.keys(scripts[func])[i])
    }

    fn = fn.filter((ele) => ele === undefined || ele === "main" ? null : ele)
    fun.set(func, fn)
  }
  return fun;
}