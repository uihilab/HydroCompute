
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
    usage: GPUBufferUsage.STORAGE,
  });
  const arrayBuffer = matrixBuffer.getMappedRange();
  new Float32Array(arrayBuffer).set(matrix);
  matrixBuffer.unmap();
  return matrixBuffer;
};

/**
 *
 * @param {*} mat
 * @param {*} size
 * @returns
 */
export const matrixChanger = (mat, sizes) => {
  var matrix = mat.slice();
  //this needs to be resolved. Having a matrix like this is unuseful
  matrix.unshift(...sizes);
  mat = [];
  sizes = [];
  return new Float32Array(matrix);
};

/**
 *
 * @param {*} device
 * @param {*} matrices
 * @returns
 */
export const resultHolder = (device, matrices, reads, writes) => {
  const resultMatSize = (() => {
    if (reads === 3 && writes === 1)
      return (
        Float32Array.BYTES_PER_ELEMENT * (2 + matrices[0][0] * matrices[1][0])
      );
    if (reads === 2 && writes === 1)
    return (
      Float32Array.BYTES_PER_ELEMENT * (1 + matrices[0][0])
    )
    if (reads === 3 && writes === 2)
    //change...
    return (
      [Float32Array.BYTES_PER_ELEMENT * (1 + matrices[0][0]),
      Float32Array.BYTES_PER_ELEMENT * (1 + matrices[0][0])]
    )
  })();
  //console.log(resultMatSize)  
  const resultBuffer = device.createBuffer({
    size: resultMatSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  return [resultMatSize, resultBuffer];
};

/**
 *
 * @param {*} buffers
 */
export const bufferDestroyer = (buffers) => {
  for (const buffer of buffers) {
    buffer.destroy();
  }
};
