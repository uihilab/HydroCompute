/**
 * Directed Acyclic Graph implementation for solving promised-based functions
 * adopted from https://github.com/daanmichiels/promiseDAG
 * @param {*} functions 
 * @param {*} dag 
 * @returns 
 */

export const DAG = (functions, dag, args) => {
    return new Promise((resolve, reject) => {
        var N = functions.length;
        var counts = dag.map((x) => x.length);
        var stopped = false;
        var remaining = N;
        var values = [];

        const handleResolution = (promise, i, value) => {
            values[i] = value;
            if(stopped) {
                return;
            }
            remaining -= 1;
            if(remaining == 0) {
                resolve(values);
            }
            for(let j=0; j<N; ++j) {
                if(counts[j] < 1) {
                    continue;
                }
                if(dag[j].indexOf(i) >= 0) {
                    counts[j] -= 1;
                    if(counts[j] == 0) {
                        var _args = []
                        for(let k=0; k<dag[j].length; ++k) {
                            _args = values[dag[j][k]];
                        }
                        args.data = _args
                        var promise = functions[j](args);
                        promise.then(
                            (value) => { handleResolution(promise, j, value); },
                            (error) => { handleRejection(promise, j, error); });
                    }
                }
            }
        }

        const handleRejection = (promise, i, error) => {
            stopped = true;
            reject(error);
        }

        for(let i=0; i<N; ++i) {
            if(counts[i] > 0) {
                continue;
            }
            var promise = functions[i](args);
            promise.then(
                (value) => { handleResolution(promise, i, value); },
                (error) => { handleRejection(promise, i, error); });
        }
    });
}

export const promisify = {
    any: (v, t) => {
        t = t | 1000
        return new Promise((resolve, reject) => {
            setTimeout(() =>{
                resolve(v)
            }, t)
        })
    },
    resolve: (v) => {
        return Promise.resolve(v)
    },
    reject: (v) => {
        return Promise.reject(v)
    },
    all: (fns) => {
        return Promise.all(fns) 
    }
}

/**
 * 
 */

//This is meant to be filled with any sort of helper functions for matricial purposes.
//Similar approaches can be taken for other types of workloads diverted into a worker.

export const arrayChanger = (arr, width) =>
        arr.reduce((rows, key, index) =>
            (index % width == 0 
            ? rows.push([key])
            : rows[rows.length-1].push(key)) && rows, []
        )