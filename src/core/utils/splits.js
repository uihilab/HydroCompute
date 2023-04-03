import { ValueErr, NotImplemented } from "./errors.js";
//Different types of data splits can be added into this section.

/**
 * @namespace splits
 * @description Collection of functions to be used for splitting data across HydroCompute 
 * 
 */

export const splits = {
  //
  /**
   * @description Splits a 1D array into N different chunks
   * @param {Array} data - 1d array of data
   * @returns 
   */
  split1DArray: ({data: data, n: n}) => {
    const chunkSize = Math.ceil(data.length / n);
    const chunks = [];
    for (let i = 0; i < n; i++) {
      const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
      chunks.push(chunk);
    }
    return chunks;
  },

  /**
   * 
   * @param {*} param0 
   * @returns 
   */
  //Splits each array from a 2D matrix into N different chunks
  splitmDArray: ({data: data, n: n}) => {
    if (data.length === 0 || !Array.isArray(data[0])) {
      return splits.split1DArray({data:data, n:n});
    } else {
      const result = [];
      for (const subarray of data) {
        result.push(splits.splitmDArray({data:subarray, n:n}));
      }
      return result;
    }
  },

  /**
   * 
   * @param {*} param0 
   * @returns 
   */
  splitMatrix: ({data: data, n: n, m:m}) => {
    const matrix1 = [];
    const matrix2 = [];
    for (let i = 0; i < n; i++) {
      matrix1[i] = data[i].slice(0, m);
      matrix2[i] = data[i].slice(m);
    }
    return [matrix1, matrix2];
  },

  /**
   * 
   * @param {*} param0 
   * @returns 
   */
  divideIntoSubmatrices : ({data: data, k: k, l: l}) => {
    const submatrices = [];
    for (var data of data)
    for (let i = 0; i < data.length; i += k) {
      for (let j = 0; j < data[0].length; j += l) {
        submatrices.push(data.slice(i, i + k).map(row => row.slice(j, j + l)));
      }
    }
    return submatrices;
  },

  /**
   * Ordered chunks of data that are to be joined together
   * @param {*} chunks 
   */

  join: ({chunks: chunks}) => {
    let firstChunk = chunks[0].slice()
    for (var i = 1; i < chunks.length; i++){
      firstChunk.push(...chunks[i])
    }
    chunks = undefined
    return firstChunk
  },

  //Main function to run any of the functions described in the object.
  main: (name, data) => {
    if (typeof splits[name] === "undefined") {
      throw new NotImplemented(`Function is not found in the given script.`);
    } else {
      return splits[name](data);
    }
  },
};
