import { arrayChanger } from "../../core/utils/globalUtils.js";

export const matrixUtils = {
  //Matrix multiplication. Accepts 2d arrays as [Arr1, Arr2]
  /**
   *
   * @param {*} d
   * @param {*} sizes
   * @returns
   */
  matrixMultiply: (d, sizes) => {

    d = [d.slice(0, d.length/2), d.slice(d.length/2, d.length)]
        
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
    const c = new Float32Array(m * p);

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

  //Matrix addition. Accepts 2d arrays like [Arr1, Arr2]
  /**
   *
   * @param {*} d
   * @returns
   */
  matrixAdd: (d) => {
    if (d.length === 1) {
      console.error("Please input array sizes nxm");
      return;
    } else {
      var res = [];
      for (var i = 0; i < d[0].length; i++) {
        res.push(d[0][i] + d[1][i]);
      }
      return res;
    }
  },

  /**
   *
   * @param {*} d
   * @returns
   */
  backArray: (d) => {
    console.log(`Callback function for backArray`);
    return d;
  },

  //Main function to run any of the functions described in the object.
  main: (name, data) => {
    if (typeof matrixUtils[name] === "undefined") {
      return console.error("Function is not found in the given script.");
    } else {
      return matrixUtils[name](data);
    }
  },
};

const unflatten = (arr) => {

}
