/**
 * Exposes the available modules to be digested by the wasm engine.
 * 
 */
export const availableModules = {
    matrixUtils: 'matrixUtils',
    timeSeries: 'timeSeries'
}

/**
 * 
 * @param {String} name - folder and wasm module name to import 
 * @returns 
 */
const loc = (name) => {
    return `../../src/wasm/modules/${name}/${name}.wasm`
}

/**
 * 
 * @param {*} name 
 * @returns 
 */
export const assemblyModule = async (name) => {
    try {
        const memory = new WebAssembly.Memory({
            initial: 10,
            maximum: 100,
            shared: true
        })
        const module = await WebAssembly.instantiateStreaming(fetch(loc(name)), {
            js: {mem: memory},
            env:{
                abort: (_msg, _file, line, column) => console.error(`Abort at ${line}: ${column}`),
            },
        });
        return module.instance.exports
    }
    catch (e) {
        console.log(e)
    }
}