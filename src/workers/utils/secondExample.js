const matUtils = {
    matrixMul: d => {
        var res = [];
            if (d.length === 1) {
            console.error("Please input array sizes nxm")
            return
        } else {
            for (var i = 0; i < d[0].length; i++){
                res.push(d[0][i] * d[1][i])
            }
            return res
        }
    // })()
    },

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
    
    main: (name,data) => {
            return matUtils[name](data)
        }
    }