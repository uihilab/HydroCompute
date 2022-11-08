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