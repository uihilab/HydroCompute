import * as bind from "./utils/bindgroups.js";
import * as shade from "./utils/shaderModules.js";
import * as buffers from "./utils/bufferCreators.js";
import { matrixUtils, matrixSize } from "./utils/gslCode/matrixUtils.js";
import * as scripts from "./utils/gslCode/gslScripts.js"
/**
 * WebGPU engine for general computing purposes using the device's GPU.
 * It is bounded by the availability of the WebGPU API on the current browser.
 * If the API is not available, then the engine will be set to the default one.
 * @class
 * @name webgpu
 */
export default class webgpu {
  constructor(props = {}){
    //defaults, if any
  }
  /**
   *
   * @returns
   */
  static async initialize() {
    this.setEngine()
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
    console.log(
      `WebGPU engine called.\nMax cumulative size: ${this.device.limits.maxComputeWorkgroupStorageSize}\n`
    );
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
   * @param {*} args
   */

  static async run(args) {
    this.results === undefined ? this.results = [] : null
    let start = performance.now()
    let {data, functions, dependencies, steps, linked, funcArgs} = args
    funcArgs = funcArgs === undefined ? {} : funcArgs

    //Change this
    let matSize0 = matrixSize(data[0], funcArgs), matSize1 = matrixSize(data[1], funcArgs)

    const mat1 = buffers.matrixChanger(data[0], matSize0),
      mat2 = buffers.matrixChanger(data[1], matSize1),
      matBuf1 = buffers.bufferCreator(true, this.device, mat1),
      matBuf2 = buffers.bufferCreator(true, this.device, mat2),
      [rSize, rBuffer] = buffers.resultHolder(
        this.device,
        [mat1, mat2],
        functions[0]
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
        functions[0] === "matrixMul"
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
    this.results.push(Array.from(result).slice(2));
    let end = performance.now()
    console.log(`Execution time: ${end-start} ms`)
    this.execTime += (end-start)
  }

  /**
   * 
   */
  static availableScripts(){
    let r = Object.keys(scripts).map((script) => {
      return script;
    });
    let fun = new Map();
    for (let func of r) {
      let fn = []
      for (var i = 0; i < Object.keys(func).length; i++){
        fn.push(Object.keys(scripts[func])[i])
      }

      fn = fn.filter((ele) => ele === undefined || ele === "main" ? null : ele)
      fun.set(func, fn)
    }
    return fun;

  }

  static setEngine() {
    this.adapter = null;
    this.device = null;
    this.execTime = 0;
    this.results = [];
  }

  /**
   * 
   * @returns 
   */
  static getexecTime() {
    return this.execTime;
  }
}
