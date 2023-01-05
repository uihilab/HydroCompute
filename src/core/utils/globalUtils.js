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
    dag =
      type === "steps"
        ? (() => {
            let x = Array.from({ length: N }, (_, i) => [i - 1]);
            x[0] = [];
            return x;
          })()
        : dag;
    const counts = dag.map((x) => x.length);
    let stopped = false;
    let remaining = N;
    let values = [];

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
    let temp = [];
    arr.forEach((ob) => {
      if (Array.isArray(ob)) {
        temp.push(arrayCloner(ob));
      } else {
        if (typeof ob === "object") {
          temp.push(objectCloner(ob));
        } else {
          temp.push(ob);
        }
      }
    });
    return temp;
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
    return arrayCloner(data);
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
