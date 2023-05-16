/**
 * @method DAG
 * @memberof globalUtils
 * @description Directed Acyclic Graph implementation for solving promised-based functions
 * adopted from https://github.com/daanmichiels/promiseDAG
 * @param {Array} functions - functions required to run during a simulation as promised using the order [func1, func2...]
 * @param {Array} dag - dependency array listing the sequential executions for each funciton as [[0], [1], [0,1]...]
 * @param {Object} args - argument list used to run a specific function. This will change already on the engine
 * @param {String} type - running either a function DAG or a step DAG
 * @returns {Promise} fulfills the resolution for the DAG or returns error with the execution context.
 */

export const DAG = ({ functions, dag, args, type } = {}) => {
  dag = dag || [];
  return new Promise((resolve, reject) => {
    const N = functions.length;
    //A DAG can be both stepwise or functionwise. The next definition
    //asserts that there is a dag ready for each step linearly
    //e.g. step0->step1->step2...
    dag =
      type === "steps"
        ? (() => {
            let x = Array.from({ length: N }, (_, i) => [i - 1]);
            x[0] = [];
            return x;
          })()
        : dag;
    const counts = dag.map((x) => x.length);
    let stopped = false,
    remaining = N,
    values = [];

    const handleResolution = (promise, i, value) => {
      //Assumming that the worker is giving back a Float32Array. This slicing might be done some other way. Keep on mind!
      values[i] = value;
      if (stopped) {
        return;
      }
      remaining -= 1;
      if (remaining == 0) {
        resolve(values);
      }
      for (let j = 0; j < N; ++j) {
        if (counts[j] < 1) {
          continue;
        }
        if (dag[j].indexOf(i) >= 0) {
          counts[j] -= 1;
          if (counts[j] == 0) {
            let _args = [];
            for (let k = 0; k < dag[j].length; k++) {
              //Goes on a stepwise execution manner.
              _args =
                type === "steps"
                  ? new Float32Array(values[dag[j][k]][values[dag[j][k]].length - 1].slice())
                  //This needs correction
                  : values[dag[j][k]];
            }
            args[j].data = _args;
            var promise = null
            if (type === "steps"){
              promise = functions[j](j, _args)
            }
            else {
              promise = functions[j](args[j]);
            }
            promise.then(
              (value) => {
                handleResolution(promise, j, value);
              },
              (error) => {
                handleRejection(promise, j, error);
              }
            );
          }
        }
      }
    };

    const handleRejection = (promise, i, error) => {
      stopped = true;
      console.error('There was an error executing a function. More details: ', error)
      reject(error);
      return;
    };

    for (let i = 0; i < N; ++i) {
      if (counts[i] > 0) {
        continue;
      }

      var promise = null;
      
      if (type === "steps") {
      promise = functions[i](i);
    } else {
      promise = functions[i](args[i]);
    }
      promise.then(
        (value) => {
          handleResolution(promise, i, value);
        },
        (error) => {
          handleRejection(promise, i, error);
        }
      );
    }
  });
};

/**
 * @method dataCloner
 * @memberof globalUtils
 * @description Deep clones either objects or arrays
 * @param {Object} data - array or object
 * @returns {Object} deep clone of the object to copy
 */

export const dataCloner = (data) => {
  //Deep copy of array data using recursion
  const arrayCloner = (arr) => {
    if (arr instanceof Float32Array) {
      return arr;
    }
    if (Array.isArray(arr[0])) {
      const clonedArr = new Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        clonedArr[i] = new Float32Array(arrayCloner(arr[i]));
      }
      return clonedArr;
    } else {
      return new Float32Array(arr);
    }
  };

  const objectCloner = (inObject) => {
    let tempOb = {};

    for (let [key, value] of Object.entries(inObject)) {
      if (Array.isArray(value)) {
        tempOb[key] = arrayCloner(value);
      } else {
        if (typeof value === "object") {
          tempOb[key] = objectCloner(value);
        } else {
          tempOb[key] = value;
        }
      }
    }
    return tempOb;
  };

  try {
    if (Array.isArray(data)) {
      let stgD = arrayCloner(data);
      return flattenFloat32Array(stgD);
    } else {
      return objectCloner(data);
    }
  } catch (error) {
    return console.error(
      `There was an error cloning the data. More info: `,
      error
    );
  }
};

/**
 * @method arrayChanger
 * @memberof globalUtils
 * @description switches the rows/columns of an array
 *
 */

export const arrayChanger = (arr, width) =>
  arr.reduce(
    (rows, key, index) =>
      (index % width == 0
        ? rows.push([key])
        : rows[rows.length - 1].push(key)) && rows,
    []
  );

/**
 * Helper function for concatenating arrays.
 * @param {Array} arrays - collection of arrays to concatenate
 * @returns {Array} array - concatenated array
 */

export const concatArrays = (arrays) => {
  if (arrays.length === 1) {
    return arrays[0];
  }

  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const finalArray = new Float32Array(totalLength);

  let offset = 0;
  for (let i = 0; i < arrays.length; i++) {
    finalArray.set(arrays[i], offset);
    offset += arrays[i].length;
  }

  return finalArray;
};

/**
 * Helper function for flatennizing a 2D array
 * @memberof globalUtils
 * @param {Array} arr  - N-D array to be flattened
 * @returns {Array} flattenized ND array
 */
export const flattenFloat32Array = (arr) => {
  if (typeof arr[0] !== "object") return arr;
  let flatArray = [];
  arr.forEach(function (subArray) {
    flatArray = flatArray.concat(Array.from(subArray));
  });
  return new Float32Array(flatArray);
};

/**
 * Retrieves the performance measures for function execution and worker execution.
 * @memberof globalUtils
 * @returns {object} - The performance measures.
 * @property {number} funcExec - The duration of function execution.
 * @property {number} workerExec - The duration of worker execution.
 * @returns {Object} object containing execution times for both script and function exeuctions.
 */
export const getPerformanceMeasures = () => {
  return {
    funcExec: performance.measure(
      "measure-execution",
      "start-function",
      "end-function"
    ).duration,
    workerExec: performance.measure(
      "measure-execution",
      "start-script",
      "end-script"
    ).duration,
  };
};

/**
 * Imports JSON data from a file.
 * @memberof globalUtils
 * @param {string} jsonFile - The path or URL to the JSON file.
 * @param {string} [dataFieldName="data"] - The name of the field containing the data in the JSON file.
 * @returns {Promise<*>} - A promise that resolves to the imported data.
 */
export const importJSONdata = async (jsonFile, dataFieldName = "data") => {
  const response = await fetch(`${jsonFile}.json`);
  const json = await response.json();
  const data = json[dataFieldName];
  return data;
};
