import { arrayChanger } from "../../core/utils/globalUtils.js"

export const timeSeries = {
    //exponential moving average for time series analysis
    expoMovingAverage: (d, window = 5) => {
        if (!d || d.length < window) return []
        
        let index = window - 1;
        let previosIndex = 0;
        const smoothingFactor = 2 / (window + 1);
        const res = [];
        const [sma] = timeSeries["simpleMovingAverage"](d, window=1, 1);
        res.push(sma)
        while (++index < d.length){
            const value = d[index];
            const previousEma = res[previosIndex++];
            const currentEma = (value - previousEma) * smoothingFactor + previousEma;
            res.push(currentEma)
        }
        return res
    },
    
    //simple moving average analysis for time series analysis
    simpleMovingAverage: (d, window = 5, n = Infinity) => {
        if (!d||d.length < window) return []
        let index = window - 1;
        const res = []
        let num = 0;
        while(++index < d.length + 1 && num++<n){
            const windowSlice = d.slice(index - window, index);
            const sum = windowSlice.reduce((prev,curr)=>prev+curr, 0);
            res.push(sum / window);
        }
        return res
    },

    sumAction: d => {
        console.log(`This is working, right?`)
    },

    //Main function to run any of the functions described in the object.
    main: (name,data) => {
        if (typeof timeSeries[name] === "undefined") {
            return console.error("Function is not found in the given script.")
        } else {
            return timeSeries[name](data)
        }
        }
    }