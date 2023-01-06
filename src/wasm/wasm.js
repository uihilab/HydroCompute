//class that instantiates the wasm modules

export default class wasm{

    /**
     * Initialize the method with the same parameters available from all other engines
     */
    static initialize() {
        console.log("Web assembly scripts called!!")
        this.wasm = undefined
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
     * @param {*} mem - allocation based on the computation required per module 
     * @param {*} location - parameter will change
     * @returns 
     */
    static async loadModule(mem, location) {
        const memory = new WebAssembly.Memory({initial: mem})
        this.wasm = await WebAssembly.instantiateStreaming(fetch(location), {
            env:
            {
                memory,
                abort: (_msg, _file, line, column) => console.error(`Abort at ${line}: ${column}`),
                seed: () => new Date().getTime()
            }
        });
        return this.wasm.instance.exports
    }

    
}