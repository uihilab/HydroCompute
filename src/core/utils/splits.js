import { ValueErr, NotImplemented } from "./errors.js";
//Different types of data splits can be added into this section.

/**
 * @namespace splits
 * @description Collection of functions to be used for splitting data across HydroCompute
 */

export const splits = {
  /**
   * Splits a 1D array into N different chunks.
   * @param {object} params - The parameters for splitting the array.
   * @param {Array} params.data - The 1D array of data.
   * @param {number} params.n - The number of chunks to create.
   * @returns {Array} - An array of chunks.
   */
  split1DArray: ({ data: data, n: n }) => {
    const chunkSize = Math.ceil(data.length / n);
    const chunks = [];
    for (let i = 0; i < n; i++) {
      const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
      chunks.push(chunk);
    }
    return chunks;
  },

  /**
   * Splits each array from a 2D matrix into N different chunks.
   * @param {object} params - The parameters for splitting the matrix.
   * @param {Array} params.data - The 2D matrix of data.
   * @param {number} params.n - The number of chunks to create.
   * @returns {Array} - An array of chunks.
   */
  splitmDArray: ({ data: data, n: n }) => {
    if (data.length === 0 || !Array.isArray(data[0])) {
      return splits.split1DArray({ data: data, n: n });
    } else {
      const result = [];
      for (const subarray of data) {
        result.push(splits.splitmDArray({ data: subarray, n: n }));
      }
      return result;
    }
  },

  /**
   * Splits a matrix into two submatrices.
   * @param {object} params - The parameters for splitting the matrix.
   * @param {Array} params.data - The matrix to split.
   * @param {number} params.n - The number of rows for the first submatrix.
   * @param {number} params.m - The number of columns for the first submatrix.
   * @returns {Array} - An array containing the two submatrices.
   */
  splitMatrix: ({ data: data, n: n, m: m }) => {
    const matrix1 = [];
    const matrix2 = [];
    for (let i = 0; i < n; i++) {
      matrix1[i] = data[i].slice(0, m);
      matrix2[i] = data[i].slice(m);
    }
    return [matrix1, matrix2];
  },

  /**
   * Divides a matrix into submatrices.
   * @param {object} params - The parameters for dividing the matrix.
   * @param {Array} params.data - The matrix to divide.
   * @param {number} params.k - The number of rows for each submatrix.
   * @param {number} params.l - The number of columns for each submatrix.
   * @returns {Array} - An array of submatrices.
   */
  divideIntoSubmatrices: ({ data: data, k: k, l: l }) => {
    const submatrices = [];
    for (var data of data)
      for (let i = 0; i < data.length; i += k) {
        for (let j = 0; j < data[0].length; j += l) {
          submatrices.push(
            data.slice(i, i + k).map((row) => row.slice(j, j + l))
          );
        }
      }
    return submatrices;
  },

  /**
   * Joins chunks of data together.
   * @param {object} params - The parameters for joining the chunks.
   * @param {Array} params.chunks - An array of chunks to join.
   * @returns {Array} - The joined array of chunks.
   */
  join: ({ chunks: chunks }) => {
    let firstChunk = chunks[0].slice();
    for (var i = 1; i < chunks.length; i++) {
      firstChunk.push(...chunks[i]);
    }
    chunks = undefined;
    return firstChunk;
  },

  /**
   * Runs a specific split function based on the provided name and data.
   * @param {string} name - The name of the split function to run.
   * @param {*} data - The data to pass to the split function.
   * @returns {*} - The result of the split function.
   * @throws {NotImplemented} - If the split function is not found.
   */
  main: (name, data) => {
    if (typeof splits[name] === "undefined") {
      throw new NotImplemented(`Function is not found in the given script.`);
    } else {
      return splits[name](data);
    }
  },
};
