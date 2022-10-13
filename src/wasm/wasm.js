//class that instantiates the wasm modules

export default class wasm{

    static initialize() {
        console.log("Web assembly scripts called!!")
    }
    async instantiate(module, imports = {}) {
        const {exports} = await WebAssembly.instantiate(module, imports);
        return exports

    }
}