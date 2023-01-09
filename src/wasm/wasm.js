import {assemblyModule} from './modules/modules.js'

//class that instantiates the wasm modules

export default class wasm{

    /**
     * Initialize the method with the same parameters available from all other engines
     */
    static initialize() {
        console.log("Web assembly scripts called.")
        this.wasm = undefined
        this.functions = [];
        this.results = [];
        this.execTime = 0;

    }

    /**
     * Instatiating the modules available from modules folder.
     * All modules are saved in the modules folder.
     * @param {*} module 
     * @param {*} imports 
     * @returns 
     */
    async instantiate(module, imports = {}) {
        const {exports} = await WebAssembly.instantiate(module, imports);
        return exports
    }

    /**
     * 
     * @param {*} mem - allocation based on the computation required per module. Initiated with 1 page or 
     * @param {*} location - parameter will change
     * @returns 
     */
    static async loadModule(mem = 1, module) {
        const memory = new WebAssembly.Memory({initial: mem, shared: true})
        this.wasm = await WebAssembly.instantiateStreaming(fetch(module), {
            env:
            {
                memory,
                abort: (_msg, _file, line, column) => console.error(`Abort at ${line}: ${column}`),
                //seed: () => new Date().getTime()
            }
        });
        return this.wasm.instance.exports
    }

    static async run(args){
        let d = []

        for (var i of args.data){
            d.push(new Float32Array(i))
        };
    }

    static showResults(){
        return this.results;
    }

    static getexecTime(){
        return this.execTime;
    }

}