/**
 * Utility functions for matrix operations.
 * @member matrixUtils_js
 * @memberof jsScripts
 */
export const matrixUtils = {
  /**
   * Performs matrix multiplication using the naive dot product.
   * @memberof matrixUtils_js
   * @param {number[]} d - The input matrices as a 2D array.
   * @param {number[]} sizes - The sizes of the matrices [m, n, p].
   * @returns {number[]} - The result of matrix multiplication.
   */
  matrixMultiply_js: (d, sizes) => {
    d = [d.slice(0, d.length / 2), d.slice(d.length / 2, d.length)];

    if (!sizes) {
      const n = Math.sqrt(d[0].length);
      if (d[0].length % n === 0 && d[1].length % n === 0) {
        sizes = [n, n, n];
      } else {
        console.error("Please input the sizes of your matrices.");
      }
    }
    const [m, n, p] = sizes;
    const a = d[0];
    const b = d[1];
    const c = new Array(m * p);

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < p; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
          sum += a[i * n + k] * b[k * p + j];
        }
        c[i * p + j] = sum;
      }
    }
    return c;
  },

  /**
   * Performs matrix addition.
   * @memberof matrixUtils_js
   * @param {number[]} d - The input matrices as a 2D array.
   * @returns {number[]} - The result of matrix addition.
   */
  matrixAdd_js: (d) => {
    if (d.length === 1) {
      console.error("Please input array sizes nxm");
      return;
    } else {
      d = [d.slice(0, d.length / 2), d.slice(d.length / 2, d.length)];
      var res = new Array(d.length);
      for (var i = 0; i < d[0].length; i++) {
        res.push(d[0][i] + d[1][i]);
      }
      return res;
    }
  },

  /**
   * Creates a convolution of a 2D matrix.
   * @memberof matrixUtils_js
   * @param {object} data - The input data object.
   * @param {number[][]} data.input - The input matrix.
   * @param {number[][]} data.kernel - The kernel matrix.
   * @returns {number[][]} - The convolution result.
   */
  conv2d_js: (data) => {
    let { input, kernel } = data;
    let output = [];

    let inputRows = input.length;
    let inputCols = input[0].length;
    let kernelRows = kernel.length;
    let kernelCols = kernel[0].length;

    let padRows = Math.floor(kernelRows / 2);
    let padCols = Math.floor(kernelCols / 2);

    let paddedInput = [];
    for (let i = 0; i < inputRows + 2 * padRows; i++) {
      let row = [];
      for (let j = 0; j < inputCols + 2 * padCols; j++) {
        row.push(0);
      }
      paddedInput.push(row);
    }

    for (let i = 0; i < inputRows; i++) {
      for (let j = 0; j < inputCols; j++) {
        paddedInput[i + padRows][j + padCols] = input[i][j];
      }
    }

    for (let i = 0; i < inputRows; i++) {
      let row = [];
      for (let j = 0; j < inputCols; j++) {
        let sum = 0;
        for (let m = 0; m < kernelRows; m++) {
          for (let n = 0; n < kernelCols; n++) {
            let ii = i + m - padRows;
            let jj = j + n - padCols;
            sum += paddedInput[ii][jj] * kernel[m][n];
          }
        }
        row.push(sum);
      }
      output.push(row);
    }

    return output;
  },
  /**
   * Runs the specified function in the `matrixUtils` object with the given data.
   * @memberof matrixUtils_js
   * @param {string} name - The name of the function to run.
   * @param {*} data - The input data for the function.
   * @returns {*} - The result of the function, or `undefined` if the function is not found.
   */
  main: (name, data) => {
    if (typeof matrixUtils[name] === "undefined") {
      return console.error("Function is not found in the given script.");
    } else {
      return matrixUtils[name](data);
    }
  },
};
