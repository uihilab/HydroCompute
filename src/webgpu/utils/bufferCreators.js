/**
 * @method matrixSize
 * @description returns the sizes of two square matrices
 * @param {Array} matrix - matrix as a 1d array
 * @param {Object} args - additional partitions required
 * @returns 
 */
export const matrixSize = (matrix, args = undefined) => {
  const isSquare = matrix.length % Math.sqrt(matrix.length) === 0;
  const sizes = args || (isSquare ? [Math.sqrt(matrix.length), Math.sqrt(matrix.length)] : console.error("Please input the sizes of your matrices."));
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
  const matrix = [...sizes, ...mat];
  const [, ...result] = new Float32Array(matrix);
  return result;
};

/**
 *
 * @param {*} device
 * @param {*} matrices
 * @returns
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

  //console.log(resultMatSize)  
  const resultBuffer = device.createBuffer({
    size: resultMatSize instanceof Array ? resultMatSize.reduce((a,b) => a +b) : resultMatSize,
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
    this.adapter = null;
    this.device = null;
    this.lostListener = null;
  }

  async initialize() {

    await this.deviceCall();

    if (!this.adapter) return false;

    while (!this.device) {
      this.adapter = null;
      await this.deviceCall();
      if (!this.adapter) return false
    }

    this.addLostListener();

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
  }

  addLostListener(){
    if (this.lostListener) return;

    this.lostListener = this.device.lost.then(async (info) => {
      console.error('Device was lost. Reconnecting... Info: ', info);

      try {
        await this.recoverDevice();
      } catch (error) {
        console.error('Device could not be recovered', error);
      }
    })
  }

  removeLostListener(){
    if (this.lostListener) {
      this.lostListener = null;
    }
  }

  async recoverDevice(){
    this.removeLostListener();
    await this.deviceCall();
    this.addLostListener();
  }
}


