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

var someName = someName || (()=> {
    return {
    main: function () {

    },
    //Please delare all your functions below
    someFunc: function () {

    }
}
})

main('someFunc', data) //someFunc is the funciton of the user