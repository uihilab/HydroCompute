//class that instantiates the wasm modules

export default class wasm{

    static initialize() {
        console.log("Web assembly scripts called!!")
        this.wasm = undefined
    }
    async instantiate(module, imports = {}) {
        const {exports} = await WebAssembly.instantiate(module, imports);
        return exports
    }

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