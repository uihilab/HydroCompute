/**
 *
 * @param {*} matrices
 * @param {*} args
 * @returns
 */
export const matrixSize = (matrix, count, args) => {
  let sizes;
  //assuming that the matrices are square, no need to input sizes
  if (args === null || typeof args === undefined || args == undefined)
    sizes = (() => {
      if (count === 1){
        return [matrix.length, 1];
      }
      if (matrix.length % Math.sqrt(matrix.length) === 0) {
        //return back square matrix
        return [Math.sqrt(matrix.length), Math.sqrt(matrix.length)];
      } else {
        return console.error("Please input the sizes of your matrices.");
      }
    })();
  //console.log(sizes)
  return sizes;
};


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

export class deviceConnect{
  constructor(){
  }

  async initialize() {
    this.adapter = null;
    this.device = null;
    await this.deviceCall();

    if (!this.adapter) return false;

    while (!this.device) {
      this.adapter = null;
      await this.deviceCall();
      if (!this.adapter) return false
    }
    return this.device
  }

  async deviceCall(){
    if (!this.adapter) {
      this.adapter = await navigator.gpu.requestAdapter();

      if (!this.adapter) {
        console.error(
          'WebGPU is not available in your browser. Return to other engines, if possible.'
        );
        return
      }
    }

    this.device = await this.adapter.requestDevice();
    this.device.lost.then((info) => {
      console.error("Device was lost. Reconnecting... Info: ");
      try{
        this.recoverDevice()
      } catch (error){
        console.error('Device could not be recovered.', error)
      }
    })
  }

  async recoverDevice(){
    this.deviceCall()
    return this.adapter
  }
}
