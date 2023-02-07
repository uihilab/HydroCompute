/**
 * Directed Acyclic Graph implementation for solving promised-based functions
 * adopted from https://github.com/daanmichiels/promiseDAG
 * @param {*} functions
 * @param {*} dag
 * @returns
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
                  ? values[dag[j][k]][args.functions.length - 1]
                  : values[dag[j][k]];
            }
            args.data = _args;
            var promise = functions[j](args);
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
      console.log(error)
      reject(error);
    };

    for (let i = 0; i < N; ++i) {
      if (counts[i] > 0) {
        continue;
      }
      var promise = functions[i](args);
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
 * Deep clones either objects or arrays
 * @param {Object{}} data - array or object
 * @returns
 */

export const dataCloner = (data) => {
  //Deep copy of array data using recursion
  const arrayCloner = (arr) => {
    if (Array.isArray(arr[0])) {
      return arr.map(subArr => arrayCloner(subArr));
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

  if (Array.isArray(data)) {
    return flattenFloat32Array(arrayCloner(data));
  } else {
    return objectCloner(data);
  }
};

/**
 *
 */

//This is meant to be filled with any sort of helper functions for matricial purposes.
//Similar approaches can be taken for other types of workloads diverted into a worker.

export const arrayChanger = (arr, width) =>
  arr.reduce(
    (rows, key, index) =>
      (index % width == 0
        ? rows.push([key])
        : rows[rows.length - 1].push(key)) && rows,
    []
  );

//Check if shared array buffer is available.
export const checkSharedArrays = () => {
  try{
    var sab = new SharedArrayBuffer(1024);
    if (sab !== undefined) return true
  }
  catch(e) {
    console.log(`Shared Array Buffer not supported.\nPleasee use another type of data partition.`);
    return false
  }
}

export const waitFor = (conditionFunction) => {

  const poll = resolve => {
    if(conditionFunction()) resolve();
    else setTimeout(_ => poll(resolve), 10);
  }

  return new Promise(poll);
}

export const concatArrays = (arrays) => {
  if (arrays.length === 1) return arrays[0]
  let totalLength = arrays.reduce((sum, array) => 
  sum + array.length, 0
  ),
  finalArray = new Float32Array(totalLength),
  offset = 0;
  for (let array of arrays){
    finalArray.set(array, offset);
    offset += array.length;
  };
  return finalArray
}

export const flattenFloat32Array = (arr) => {
  if(typeof arr[0] !== 'object') return arr
  let flatArray = [];
  arr.forEach(function(subArray) {
    flatArray = flatArray.concat(Array.from(subArray));
  });
  return new Float32Array(flatArray);
}
