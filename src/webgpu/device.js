/**
 * Class representing device connection and management for WebGPU.
 */
export class deviceConnect {
  constructor() {
    /**
     * The WebGPU adapter.
     * @type {GPUAdapter}
     */
    this.adapter = null;

    /**
     * The WebGPU device.
     * @type {GPUDevice}
     */
    this.device = null;

    /**
     * The listener for device loss event.
     * @type {Promise}
     */
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
