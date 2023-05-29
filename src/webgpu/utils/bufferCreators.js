/**
 * Returns the sizes of two square matrices.
 * @member matrixSize
 * @memberof gpuUtils
 * @param {Array} matrix - Matrix as a 1D array.
 * @param {Object} args - Additional partitions required.
 * @returns {Array} - Array containing the sizes of the matrices.
 */
export const matrixSize = (matrix, args = undefined) => {
  const isSquare = matrix.length % Math.sqrt(matrix.length) === 0;
  const sizes = args || (isSquare ? [Math.sqrt(matrix.length), Math.sqrt(matrix.length)] : console.error("Please input the sizes of your matrices."));
  return sizes;
};

/**
 * Creates a buffer for the matrix data.
 * @member bufferCreator
 * @memberof gpuUtils
 * @param {boolean} mapped - Indicates whether the buffer is mapped at creation.
 * @param {GPUDevice} device - The GPU device.
 * @param {Float32Array} matrix - The matrix data.
 * @returns {GPUBuffer} - The created matrix buffer.
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
 * Changes the matrix layout by removing the sizes.
 * @memberof matrixChanger
 * @memberof gpuUtils
 * @param {Float32Array} mat - The matrix data.
 * @param {Array} sizes - The sizes of the matrix.
 * @returns {Float32Array} - The modified matrix data.
 */
export const matrixChanger = (mat, sizes) => {
  const matrix = [...sizes, ...mat];
  const [, ...result] = new Float32Array(matrix);
  return result;
};

/**
 * Creates a buffer to hold the result matrix.
 * @member resultHolder
 * @memberof gpuUtils
 * @param {GPUDevice} device - The GPU device.
 * @param {Array} matrices - The matrices data.
 * @param {number} reads - The number of read partitions.
 * @param {number} writes - The number of write partitions.
 * @returns {Array} - Array containing the size and buffer of the result matrix.
 */
export const resultHolder = (device, matrices, reads, writes) => {
  const sizeMappings = {
    '3-1': Float32Array.BYTES_PER_ELEMENT * (2 + matrices[0][0] * matrices[1][0]),
    '2-1': Float32Array.BYTES_PER_ELEMENT * (1 + matrices[0][0]),
    '3-2': [
      Float32Array.BYTES_PER_ELEMENT * (1 + matrices[0][0]),
      Float32Array.BYTES_PER_ELEMENT * (1 + matrices[0][0])
    ]
  };

  const key = `${reads}-${writes}`;
  const resultMatSize = sizeMappings[key];

  const resultBuffer = device.createBuffer({
    size: resultMatSize instanceof Array ? resultMatSize.reduce((a,b) => a +b) : resultMatSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  return [resultMatSize, resultBuffer];
};

/**
 * Destroys the buffers.
 * @member bufferDestroyer
 * @memberof gpuUtils
 * @param {Array} buffers - Array of GPU buffers.
 */
export const bufferDestroyer = (buffers) => {
  for (const buffer of buffers) {
    buffer.destroy();
  }
};
