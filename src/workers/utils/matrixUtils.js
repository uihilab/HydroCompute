import { arrayChanger } from "../../core/utils/globalUtils.js"

export const matrixUtils = {
    //Matrix multiplication. Accepts 2d arrays as [Arr1, Arr2]
    matrixMul: (d, sizes) => {
        if (typeof sizes === "undefined") 
        //This checks if the input matrices are of the same size
        sizes = (() => {
            if ((d[0].length % Math.sqrt(d[0].length) === 0) 
            && (d[1].length % Math.sqrt(d[1].length) === 0)) {
                return [Math.sqrt(d[0].length), Math.sqrt(d[1].length), Math.sqrt(d[0].length)]   
            } else {
                console.error("Please input the sizes of your matrices.")
            } 
        })()
        d = d.slice()
        d[0] = arrayChanger(d[0], sizes[2]); d[1] = arrayChanger(d[1], sizes[2])
        d.map(x => x.map(y => y))
        var res;
        !(d instanceof Array)
        ?
        (()=>{
            console.error("Please make sure you are passing an array type object")
        })()
        :
        (()=>{if (d.length === 1) {
            console.error("Please input array sizes nxm")
            return
        } else {
            res = d[0].map((row, i) =>
            d[1][0].map((_, j) =>
              row.reduce((acc, _, n) =>
                acc + d[0][i][n] * d[1][n][j], 0
              )
            )
          )
        }})()
        return res
    },
    
    //Matrix addition. Accepts 2d arrays like [Arr1, Arr2]
    matrixAdd: d => {
        if (d.length === 1) {
            console.error("Please input array sizes nxm")
            return
        } else {
            var res = []
            for (var i = 0; i < d[0].length; i++){
                res.push(d[0][i] + d[1][i])
            }
            return res
        }
    },

    sumAction: d => {
        console.log(`Callback function for sumAction`)
    },

    backArray: d => {
        console.log(`Callback function for backArray`)
        return d
    },

    //Main function to run any of the functions described in the object.
    main: (name,data) => {
        if (typeof matrixUtils[name] === "undefined") {
            return console.error("Function is not found in the given script.")
        } else {
            return matrixUtils[name](data)
        }
        }
    }