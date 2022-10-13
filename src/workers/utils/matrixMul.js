//Any of the functions must be explicitely casted as constant or function
//that can be used as a script within a specific scope
const matrixMul = (d, sizes) => {
    var res = [];
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
        for (var i = 0; i < sizes[0]; i++){
            for (var j = 0; j < sizes[1]; j++) {
                var result = 0;
                for (var k = 0; k < sizes[2]; k++)
                result += d[0][i * sizes[2]] * d[1][k*sizes[1]+j]
            }
            res.push(result)
        }
        return res
    }})()
}