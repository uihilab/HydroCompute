import engine from "../core/utils/engine.js";


/**
 * @class
 * @name wasm
 * The data structures supported for the workers scripts are limited to: JSON objects, JS objects, strings, numbers, and arrays
 */
export default class wasm {
    constructor(){
      this.initialize()
    }
  /**
   * 
   * @param {*} args 
   */
  static initialize(args) {
    this.setLocations();
    this.engine = new engine('wasm', this.workerLocation)
  }

  /**
   *
   * @param {*} args
   * @returns
   */
  static async run(args) {
    await this.engine.run(args)
  }

  /**
   * 
   */
  static setLocations() {
        this.workerLocation = "../../src/wasm/worker.js"
      }

  /**
   * 
   * @returns 
   */
  static availableScripts() {
    return this.engine.availableScripts()
  }

  /**
   * 
   * @returns 
   */
  static async showResults() {
    return this.engine.showResults()
  }

  /**
   * 
   * @returns 
   */
  static getexecTime() {
    return this.engine.getexecTime()
  }
}