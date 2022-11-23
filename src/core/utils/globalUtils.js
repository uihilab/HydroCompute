/**
 * Directed Acyclic Graph implementation for solving promised-based functions
 * adopted from https://github.com/daanmichiels/promiseDAG
 * @param {*} functions 
 * @param {*} dag 
 * @returns 
 */

export const DAG = (functions, dag) => {
    return new Promise((resolve, reject) => {
        var N = functions.length,
        counts = dag.map(x => x.length),
        stopped = false,
        remaining = N,
        values = [];

        for (let i = 0; i < N; i++) {
            if(counts[i] > 0) {
                continue;
            }
            var promise = functions[i]();
            promise.then(
                value => handleResol(promise, i, value),
                error => handleError(promise, i, error)
            )
        }

        const handleResol = (promise, i, value) => {
            values[i] = value;
            if(stopped) return;
            remaining--;

            if(remaining === 0) resolve(values);

            for (let j =0; j < N; j++) {
                if(counts[j] < 1) continue;
            
            if(dag[j].indexOf(i) >= 0 ) {
                counts[j]--;
                if(counts[j] === 0) {
                    var args = []
                    for (let k=0; k < dag[j].length; k++) {
                        args.push(values[dag[j][k]])
                    }
                    var promise = functions[j].apply(null, args);
                    promise.then(
                        value => handleResol(promise, j, value),
                        error => handleError(promise, j, error)
                    )
                }
            }
            }
        }

        const handleError = (promise, i, error) => {
            stopped = true;
            reject(error);
        }
    }
    
    )
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