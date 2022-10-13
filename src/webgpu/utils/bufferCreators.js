/**
 * 
 * @param {*} mapped 
 * @param {*} device 
 * @param {*} matrix 
 * @returns 
 */
export const bufferCreator = (mapped, device, matrix) => {
    const matrixBuffer = device.createBuffer({
        mappedAtCreation: mapped,
        size: matrix.byteLength,
        usage: GPUBufferUsage.STORAGE
    })
    const arrayBuffer = matrixBuffer.getMappedRange();
    new Float32Array(arrayBuffer).set(matrix)
    matrixBuffer.unmap();
    return matrixBuffer
}

export const matrixChanger = (mat, size) => {
    var matrix = mat.slice()
    //this needs to be resolved. Having a matrix like this is unuseful
    matrix.unshift(size[0], size[1])
    return new Float32Array(matrix)
}

/**
 * 
 * @param {*} device 
 * @param {*} matrices 
 * @returns 
 */

export const resultHolder = (device, matrices, type) => {
    const resultMatSize = (() => {
    if (type === "matrixMul") return Float32Array.BYTES_PER_ELEMENT * (2 + matrices[0][0] * matrices[1][0]) 
    if (type === "matrixAdd") return Float32Array.BYTES_PER_ELEMENT * (2 + matrices[0][0] + matrices[1][0])
})()
    const resultBuffer = device.createBuffer({
        size: resultMatSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    })
    return [resultMatSize, resultBuffer]
}

export const bufferDestroyer = (buffers) => {
    for (const buffer in buffers) {
        buffer.destroy()
    }
}