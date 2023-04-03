/**
 * Any script that is added into the worker is added here and the import/export list
 * should be updated accordingly.
 * @module scripts
 */
import { matrixUtils } from "./matrixUtils.js";
import { timeSeries } from "./timeSeries.js";

export { matrixUtils, timeSeries, 
}

// const modules = import.meta.glob('./**/*.js');

// for (const path in modules) {
// console.log(path)
//   //const module = await modules[path]();
//   // Do something with the module...
// }