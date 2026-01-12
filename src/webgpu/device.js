/**
 * @namespace gpuUtils
 */

/**
 * Class representing device connection and management for WebGPU.
 * @member deviceConnect
 * @memberof gpuUtils
 * @property {GPUAdapter | null} adapter - The GPU adapter object. Set to null if no adapter is connected.
 * @property {GPUDevice | null} device - The GPU device object. Set to null if no device is connected. 
 * @property {EventListener | null} lostListener - The event listener for device loss. Set to null if no listener is attached.
 */
export class deviceConnect {
  constructor() {
    this.adapter = null;
    this.device = null;
    this.lostListener = null;
  }

  /**
   * Initializes the device and adds a lost listener to it.
   * @returns {Promise<GPUDevice|boolean>} - A promise that resolves to the initialized device, or `false` if initialization fails.
   */
  async initialize() {
    await this.initDevice();

    if (!this.adapter) return false;

    while (!this.device) {
      this.adapter = null;
      await this.initDevice();
      if (!this.adapter) return false;
    }

    this.addLostListener();

    return this.device;
  }

  /**
   * Requests the adapter and device for WebGPU.
   * @returns {Promise<void>} - A promise that resolves when the adapter and device are requested.
   */
  async initDevice() {
    if (!this.adapter) {
      this.adapter = await navigator.gpu.requestAdapter();

      if (!this.adapter) {
        console.error(
          'WebGPU is not available in your browser. Return to other engines, if possible.'
        );
        return;
      }
    }

    this.device = await this.adapter.requestDevice();
  }

  /**
   * Adds a lost listener to the device.
   * @returns {void}
   */
  addLostListener() {
    if (this.lostListener) return;

    this.lostListener = this.device.lost.then(async (info) => {
      console.error('Device was lost. Reconnecting... Info: ', info);

      try {
        await this.recoverDevice();
      } catch (error) {
        console.error('Device could not be recovered', error);
      }
    });
  }

  /**
   * Removes the lost listener from the device.
   * @returns {void}
   */
  removeLostListener() {
    if (this.lostListener) {
      this.lostListener = null;
    }
  }

  /**
   * Recovers the device after it has been lost.
   * @returns {Promise<void>} - A promise that resolves when the device is recovered.
   */
  async recoverDevice() {
    this.removeLostListener();
    await this.initDevice();
    this.addLostListener();
  }
}
