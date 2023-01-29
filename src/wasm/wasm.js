import {assemblyModule, availableModules} from './modules/modules.js'
import { NotFound } from '../core/utils/errors.js';


/**
 * Imports modules from different web assembly compilations for usage
 * This class will not be released, but rather serves as a comparison between
 * other methods.
 * @class wasm
 */
export default class wasm{
    constructor(props = {}){
        //defaults, if any
    }

    /**
     * Initialize the method with the same parameters available from all other engines
     */
    static initialize() {
        this.setEngine()
        this.getAllModules()
        console.log(`Web assembly scripts called.\nModules available: ${Object.keys(availableModules)}`)
    }

    /**
     * 
     * @param {*} mem - allocation based on the computation required per module. Initiated with 1 page or 
     * @param {*} location - parameter will change
     * @returns 
     */
    static async loadModule(moduleName) {
        try {
        const myCurrentModule = await new Promise((resolve, reject) => {
          resolve(assemblyModule(moduleName));
        });
            return myCurrentModule
        } catch (e) {
            throw new NotFound(`Module not found in available scripts.`)
        }
      }


    /**
     * 
     * @param {*} args 
     */
    static async run(args){
        this.results === []
        let {funcArgs, data, functions} = args

        Array.isArray(funcArgs[0]) ? funcArgs = funcArgs[0] : funcArgs = []

        //Need change to adopt to the functions from other scripts
        Object.keys(this.wasmMods).forEach((module) => {
            let start = performance.now()
            let r;
            for (var func of functions) {
            if (Object.keys(this.wasmMods[module]).includes(func)) {
                let mod = this.wasmMods[module]
                let ref = mod[func]
                if (module === "matrixUtils") {
                    let mat1 = this.retainP(this.lowerTypedArray(Float32Array, 4, 2, data[0], mod), mod)
                    let mat2 = this.lowerTypedArray(Float32Array, 4, 2, data[1], mod)
                    Object.keys(mod).includes('__setArgumentsLength') ? mod.__setArgumentsLength(arguments.length) : null
                    try {
                        funcArgs.unshift(mat2)
                        funcArgs.unshift(mat1)
                        console.log(funcArgs)
                        r = this.liftTypedArray(Float32Array, ref(...funcArgs) >>> 0, mod)
                        this.results.push(r.slice())
                    } finally {
                        this.releaseP(mat1, mod)
                    }
                } else {
                    let arr = this.lowerTypedArray(Float32Array, 4, 2, data, mod)
                    mod.__setArgumentsLength(arguments.length);
                    funcArgs.unshift(arr)
                    r = this.liftTypedArray(Float32Array, ref(...funcArgs) >>> 0, mod)
                    this.results.push(r.slice())
                }
            }
            }
            let end = performance.now()
            console.log(`Execution time: ${end-start} ms`)
            this.execTime += (end-start)
        })
    }

    /**
     * 
     * @param {*} constructor 
     * @param {*} pointer 
     * @param {*} module 
     * @returns 
     */
    static liftTypedArray(constructor, pointer, module) {
        if (!pointer) return null;
        return new constructor(
            module.memory.buffer,
            this.getU32(pointer+4, module),
            this.dataview.getUint32(pointer + 8, true) / constructor.BYTES_PER_ELEMENT
        ).slice()
    }

    /**
     * 
     * @param {*} constructor 
     * @param {*} id 
     * @param {*} align 
     * @param {*} values 
     * @param {*} module 
     * @returns 
     */
    static lowerTypedArray(constructor, id, align, values, module){
        if (values == null) return 0;

        const length = values.length,
        buffer = module.__pin(module.__new(length << align, 1)) >>> 0,
        header = module.__new(12, id) >>> 0;

        this.setU32(header + 0, buffer, module);
        this.dataview.setUint32(header + 4, buffer, true)
        this.dataview.setUint32(header + 8, length << align, true);
        new constructor(module.memory.buffer, buffer, length).set(values);
        module.__unpin(buffer);
        return header
    }

    /**
     * 
     * @param {*} pointer 
     * @param {*} value 
     * @param {*} module 
     */
    static setU32(pointer, value, module) {
        try{
            this.dataview.setUint32(pointer, value, true)
        } catch {
            this.dataview = new DataView(module.memory.buffer);
            this.dataview.setInt32(pointer, value, true)
        }
    }

    /**
     * 
     * @param {*} pointer 
     * @param {*} module 
     * @returns 
     */
    static getU32(pointer, module) {
        try{
            return this.dataview.getUint32(pointer, true)
        } catch {
            this.dataview = new DataView(module.memory.buffer);
            return this.dataview.getUint32(pointer, true)

        }
    }

    /**
     * 
     */
    static async getAllModules() {
        for (var mod of Object.keys(availableModules)) {
            let stgMod = await this.loadModule(mod)
            this.wasmMods[mod] = stgMod
        }
    }

    /**
     * 
     * @param {*} pointer 
     * @param {*} module 
     * @returns 
     */
    static retainP(pointer, module) {
        if (pointer) {
            const refcount = this.refCounts.get(pointer);
            if (refcount) this.refCounts.set(pointer, refcount+1)
            else this.refCounts.set(module.__pin(pointer), 1)
        }
        return pointer
    }

    /**
     * 
     * @param {*} pointer 
     * @param {*} module 
     */
    static releaseP(pointer, module) {
        if (pointer) {
            const refcount = this.refCounts.get(pointer);
            if (refcount === 1) module.__unpin(pointer), this.refCounts.delete(pointer);
            else if (refcount) this.refCounts.set(pointer, refcount-1);
            else throw Error(`no refcounter "${refcount}" for the reference "${pointer}"`)
        }
    }

    /**
     * 
     * @returns 
     */
    static async availableScripts() {
        await this.getAllModules()
        let r = Object.keys(this.wasmMods).map((module) => {
          return module;
        });
        let fun = new Map();
        for (let func of r) {
          let fn = []
          for (var i = 0; i < Object.keys(func).length; i++){
            fn.push(Object.keys(this.wasmMods[func])[i])
          }
  
          fn = fn.filter((ele) => ele === undefined || ele === "memory" || ele === "__collect" || ele === "__new" || ele === "__pin" || ele === "__rtti_base" || ele === "__unpin" || ele === "__setArgumentsLength" ? null : ele)
          fun.set(func, fn)
        }
        return fun;
    }

    /**
     * 
     */
    static setEngine() {
        this.wasmMods = {}
        this.functions = [];
        this.results = [];
        this.refCounts = new Map()
        this.execTime = 0;
        this.dataview = undefined;
        this.memory = undefined;
      }

    /**
     * 
     * @returns 
     */
    static getexecTime(){
        return this.execTime;
    }

}