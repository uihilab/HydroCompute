import * as bind from "./utils/bindgroups.js";
import * as shade from "./utils/shaderModules.js";
import * as buffers from "./utils/bufferCreators.js";
import { matrixUtils } from "./utils/gslCode/matrixUtils.js";

/**
 * @class
 * @name webgpu
 */
export default class webgpu {
  constructor() {
    this.adapter = null;
    this.device = null;
  }

  /**
   * 
   * @returns 
   */
  static async initialize() {
    await this.deviceCall();

    if (!this.adapter) return false;

    while (!this.device) {
      this.adapter = null;
      await this.deviceCall();
      if (!this.adapter) return false;
    }

    return true;
  }

  /**
   * 
   * @returns 
   */
  static async deviceCall() {
    if (!this.adapter) {
      this.adapter = await navigator.gpu.requestAdapter();
      if (!this.adapter) {
        console.error(
          "This function cannot be used, WebGPU not available in your browser"
        );
        return Error();
      }
    }
    this.device = await this.adapter.requestDevice();

    this.device.lost.then((info) => {
      console.error("Device was lost: ", info);
      this.initialize();
    });
    return console.log("web gpu called!!");
  }

  /**
   * 
   * @returns 
   */
  //This method might not be as helpful as it seems
  static setDevice() {
    return this.device;
  }

  /**
   *
   * @param  {Object} args containing
   * @returns
   */
  static async digestData(...args) {
    //data will be kept in the initial position
    args = args[0];

    //assuming that the matrices are square, no need to input sizes
    if (typeof args[1].sizes === "undefined")
      args[1].sizes = (() => {
        if (
          args[0][0].length % Math.sqrt(args[0][0].length) === 0 &&
          args[0][1].length % Math.sqrt(args[0][1].length) === 0
        ) {
          return [
            [Math.sqrt(args[0][0].length), Math.sqrt(args[0][0].length)],
            [Math.sqrt(args[0][1].length), Math.sqrt(args[0][0].length)],
          ];
        } else {
          return console.error("Please input the sizes of your matrices.");
        }
      })();

    const mat1 = buffers.matrixChanger(args[0][0], args[1].sizes[0]),
      mat2 = buffers.matrixChanger(args[0][1], args[1].sizes[1]),
      matBuf1 = buffers.bufferCreator(true, this.device, mat1),
      matBuf2 = buffers.bufferCreator(true, this.device, mat2),
      [rSize, rBuffer] = buffers.resultHolder(
        this.device,
        [mat1, mat2],
        args[1].function
      ),
      lay1 = bind.layoutEntry(0, "read-only-storage"),
      lay2 = bind.layoutEntry(1, "read-only-storage"),
      lay3 = bind.layoutEntry(2, "storage"),
      group1 = bind.groupEntry(0, matBuf1),
      group2 = bind.groupEntry(1, matBuf2),
      group3 = bind.groupEntry(2, rBuffer),
      bindGroupLayout = bind.bindLayout(this.device, [lay1, lay2, lay3]),
      bindgroup = bind.bindGroup(this.device, bindGroupLayout, [
        group1,
        group2,
        group3,
      ]),
      shader = shade.shaderModule(
        this.device,
        args[1].function === "matrixMul"
          ? matrixUtils.matrixMul()
          : matrixUtils.matrixAdd()
      ),
      pipeline = shade.computingPipelines(this.device, shader, bindGroupLayout);

    var result = await shade.dispatchers(
      this.device,
      pipeline,
      bindgroup,
      [mat1, mat2],
      [rSize, rBuffer]
    );

    return Array.from(result).slice(2);
  }
}
