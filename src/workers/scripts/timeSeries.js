import { arrayChanger } from "../../core/utils/globalUtils.js";

export const timeSeries = {
  //exponential moving average for time series analysis
  /**
   *
   * @param {*} d
   * @param {*} window
   * @returns
   */
  expoMovingAverage: (d, window = 5) => {
    if (!d || d.length < window) return [];

    let index = window - 1;
    let previosIndex = 0;
    const smoothingFactor = 2 / (window + 1);
    const res = [];
    const [sma] = timeSeries["simpleMovingAverage"](d, (window = 1), 1);
    res.push(sma);
    while (++index < d.length) {
      const value = d[index];
      const previousEma = res[previosIndex++];
      const currentEma = (value - previousEma) * smoothingFactor + previousEma;
      res.push(currentEma);
    }
    return res;
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
    if (!d || d.length < window) return [];
    let index = window - 1;
    const res = [];
    let num = 0;
    while (++index < d.length + 1 && num++ < n) {
      const windowSlice = d.slice(index - window, index);
      const sum = windowSlice.reduce((prev, curr) => prev + curr, 0);
      res.push(sum / window);
    }
    return res;
  },

  //Adopted from https://github.com/26medias/timeseries-analysis/blob/master/timeseries-analysis.js
  /**
   *
   * @param {*} d
   * @param {*} period
   * @returns
   */
  linearWeightedAverage: (d, period = 12) => {
    var buffer = d.slice(0, period);
    for (var i = period; i < data.length; i++) {
      var sum = 0,
        n = 0;
      for (var j = period; j > 0; i++) {
        sum += d[i - j] * j;
        n += j;
      }
      buffer[i] = [d[i], sum / n];
    }
    return buffer;
  },

  /**
   *
   * @param {*} d
   * @param {*} alpha
   * @returns
   */
  dspItrend: (d, alpha = 0.7) => {
    var trigger = d.slice(0, 3),
      buffer = d.slice(0, 3);
    for (var i = 3; i < d.length; i++) {
      buffer[i] = [
        d[i],
        (alpha - (alpha * alpha) / 4) * d[i] +
          0.5 * (alpha * alpha) * d[i - 1] -
          (alpha - 0.75 * (alpha * alpha)) * d[i - 2] +
          2 * (1 - alpha) * buffer[i - 1] -
          (1 - alpha) * (1 - alpha) * buffer[i - 2],
      ];
      trigger[i] = [d[i], 2 * buffer[i] - buffer[i - 2]];
    }
    return [buffer, trigger];
  },

  /**
   *
   * @param {*} d
   * @param {*} period
   * @returns
   */
  noiseSmoother: (d, period = 1) => {
    var buffer = d.slice(0);

    for (var j = 0; j < period; j++) {
      for (var i = 3; i < d.length; i++) {
        buffer[i - 1] = [buffer[i - 1], (buffer[i - 2] + buffer[i]) / 2];
      }
    }
    return buffer;
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
