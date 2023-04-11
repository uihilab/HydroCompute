export const timeSeries = {
  //exponential moving average for time series analysis
  /**
   *
   * @param {*} d
   * @param {*} window
   * @returns
   */
  expoMovingAverage: (d, alpha = 0.5) => {
    let result = new Array(d.length-1);
    result[0] = d[0];
    for (let i = 1; i < d.length; i++) {
      result[i] = alpha * d[i] + (1 - alpha) * result[i - 1];
    }
    return result;
  },

  //simple moving average analysis for time series analysis
  /**
   *
   * @param {*} d
   * @param {*} window
   * @param {*} n
   * @returns
   */
  simpleMovingAverage: (d, window = 5, n = Infinity) => {
    if (!d || d.length < window) return new Array(0);
    let index = window - 1;
    let num = 0;
    const res = new Array(Math.min(n, d.length - window + 1));
    while (++index < d.length + 1 && num++ < n) {
      let sum = 0;
      for (let i = index - window; i < index; i++) {
        sum += d[i];
      }
      res[num - 1] = sum / window;
    }
    return res;
  },
  

  /**
   *
   * @param {*} d
   * @param {*} period
   * @returns
   */

  linearWeightedAverage: (d, windowSize = 2) => {
    let weightedData = [];
    for (let i = 0; i < d.length; i++) {
      let sum = 0;
      let weightSum = 0;
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j >= 0 && j < d.length) {
          let weight = Math.abs(i - j);
          sum += data[j] * weight;
          weightSum += weight;
        }
      }
      weightedData[i] = sum / weightSum;
    }
    return weightedData;
  },

  /**
   *
   * @param {*} d
   * @param {*} alpha
   * @returns
   */
  dspItrend: (d, period = 7) => {
    let output = new Array(d.length);
    let sum = 0;
    let avg;

    for (let i = 0; i < period; i++) {
      sum += d[i];
    }
    avg = sum / period;
    output[0] = avg;

    for (let i = 1; i < d.length; i++) {
      avg = (d[i] - avg) * (2 / (period + 1)) + avg;
      output[i] = avg;
    }
    return output;
  },

  /**
   *
   * @param {*} d
   * @param {*} period
   * @returns
   */
  noiseSmoother: (d, windowSize = 1) => {
    let smoothedData = [];
    for (let i = 0; i < d.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = i - windowSize; j <= i + windowSize; j++) {
        if (j >= 0 && j < d.length) {
          sum += d[j];
          count++;
        }
      }
      smoothedData[i] = sum / count;
    }
    return smoothedData;
  },

  //Main function to run any of the functions described in the object.
  main: (name, data) => {
    if (typeof timeSeries[name] === "undefined") {
      return console.error("Function is not found in the given script.");
    } else {
      return timeSeries[name](data);
    }
  },
};
