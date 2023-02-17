import engine from "../core/utils/engine.js";

/**
 * @class
 * @name webgpu
 * The data structures supported for the workers scripts are limited to: JSON objects, JS objects, strings, numbers, and arrays
 */
export default class webgpu {
    constructor(){
        this.initialize()
    }
  /**
   * 
   * @param {*} args 
   */
  static initialize(args) {
    this.setLocations();
    this.engine = new engine('webgpu', this.workerLocation)
  }

  /**
   *
   * @param {*} args
   * @returns
   */
  static async run(args) {
    await this.engine.run(args)
  }

    static setLocations() {
        this.workerLocation = "../../src/webgpu/worker.js"
      }

  /**
   * 
   * @returns 
   */
  static showResults() {
    return this.engine.showResults()
  }

  static availableScripts(){
    return this.engine.availableScripts()
  }

  /**
   * 
   * @returns 
   */
  static getexecTime() {
    return this.engine.getexecTime()
  }
}