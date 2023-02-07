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
    //defaults for removing any faulty behavior
    this.results === undefined ? this.results = [] : null
    this.execTime = 0

    //start of performance time analysis
    let start = performance.now()

    //argument extraction
    let {data, functions, dependencies, steps, linked, funcArgs} = args
    funcArgs = funcArgs === undefined ? {} : funcArgs
    
    
    data = [data.slice(0, data.length/2), data.slice(data.length/2, data.length)]

    let matData = [],
    matSize = [],
    matBuffers = [],
    lays = [],
    groups = [];
    
    for (var i =0; i < data.length; i++){
      matSize.push(matrixSize(data[i], funcArgs))
      matData.push(new Float32Array([...matSize[i], ...data[i]]))
      matBuffers.push(buffers.bufferCreator(true, this.device,matData[i]))
    }

    const [rSize, rBuffer] = buffers.resultHolder(
        this.device,
        matData,
        functions[0]
      );

      for (var j=0; j <= matData.length; j++){
        lays.push(bind.layoutEntry(j, j === matData.length ? "storage" : "read-only-storage"))
        groups.push(bind.groupEntry(j, j === matData.length ? rBuffer : matBuffers[j]))
      }
      const bindGroupLayout = bind.bindLayout(this.device, lays),
      bindgroup = bind.bindGroup(this.device, bindGroupLayout, groups),
      shader = shade.shaderModule(
        this.device,
        functions[0] === "matrixMul"
          ? matrixUtils.matrixMul()
          : matrixUtils.matrixAdd()
      ),
      pipeline = shade.computingPipelines(this.device, shader, bindGroupLayout);

    let result = await shade.dispatchers(
      this.device,
      pipeline,
      bindgroup,
      matData,
      [rSize, rBuffer]
    );
    this.results.push(Array.from(result).slice(2));
    let end = performance.now()
    console.log(`Execution time: ${end-start} ms`)
    this.execTime += (end-start)
    this.finished = true;
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

  /**
   * 
   */
  static setEngine() {
    this.adapter = null;
    this.device = null;
    this.execTime = 0;
    this.results = [];
    this.finished = false
  }

  /**
   * 
   * @returns 
   */
  static getexecTime() {
    return this.execTime;
  }
}
