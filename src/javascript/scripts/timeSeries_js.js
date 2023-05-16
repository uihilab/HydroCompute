/**
 * Collection of time series analysis functions.
 */
export const timeSeries = {
  /**
   * Calculates the exponential moving average for time series analysis.
   * @param {number[]} d - The input data.
   * @param {number} [alpha=0.5] - The alpha value for the calculation.
   * @returns {number[]} - The result of the exponential moving average.
   */
  expoMovingAverage_js: (d, alpha = 0.5) => {
    let result = new Array(d.length - 1);
    result[0] = d[0];
    for (let i = 1; i < d.length; i++) {
      result[i] = alpha * d[i] + (1 - alpha) * result[i - 1];
    }
    return result;
  },

  /**
   * Calculates the simple moving average for time series analysis.
   * @param {number[]} d - The input data.
   * @param {number} [window=5] - The window size for the calculation.
   * @param {number} [n=Infinity] - The maximum number of results to return.
   * @returns {number[]} - The result of the simple moving average.
   */
  simpleMovingAverage_js: (d, window = 5, n = Infinity) => {
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
   * Calculates the linear weighted average for time series analysis.
   * @param {number[]} d - The input data.
   * @param {number} [windowSize=2] - The window size for the calculation.
   * @returns {number[]} - The result of the linear weighted average.
   */
  linearWeightedAverage_js: (d, windowSize = 2) => {
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
   * Calculates the DSP iTrend for time series analysis.
   * @param {number[]} d - The input data.
   * @param {number} [period=7] - The period for the calculation.
   * @returns {number[]} - The result of the DSP iTrend.
   */
  dspItrend_js: (d, period = 7) => {
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
   * Calculates the noise smoother for time series analysis.
   * @param {number[]} d - The input data.
   * @param {number} [windowSize=1] - The window size for the calculation.
   * @returns {number[]} - The result of the noise smoother.
   */
  noiseSmoother_js: (d, windowSize = 1) => {
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

  /**
   * Runs the specified function in the `timeSeries` object with the given data.
   * @param {string} name - The name of the function to run.
   * @param {number[]} data - The input data for the function.
   * @returns {number[]|undefined} - The result of the function, or `undefined` if the function is not found.
   */
  main: (name, data) => {
    if (typeof timeSeries[name] === "undefined") {
      return console.error("Function is not found in the given script.");
    } else {
      return timeSeries[name](data);
    }
  },
};
