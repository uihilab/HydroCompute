var matrixUtils = matrixUtils || (() => {
    const matrixMul = (d, sizes) => {
        //sizes account for the following: 
        //sizes[0]: rows of matrix 1
        //sizes[1]: rows of matrix 2
        //sizes [2]: columns of both matrices
        if (typeof sizes === "undefined") 
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
    }

    const matrixAdd = d => {
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
    }

    //Any utils are going to come here
    const arrayChanger = (arr, width) =>
        arr.reduce((rows, key, index) =>
            (index % width == 0 
            ? rows.push([key])
            : rows[rows.length-1].push(key)) && rows, []
        )

    return {
        main: (name,data) => {
            return eval(name)(data)
        }
    }
})