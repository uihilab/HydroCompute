/**
 * 
 * @param {String} name - folder and wasm module name to import 
 * @returns 
 */
const loc = (name) => {
    return `./${name}/${name}.wasm`
}

/**
 * 
 * @param {*} name 
 * @returns 
 */
export const assemblyModule = async (mem =1, name) => {
    try {
        
        const wasm = await WebAssembly.instantiateStreaming(fetch(loc(name)), {
            env:{
                abort: (_msg, _file, line, column) => console.error(`Abort at ${line}: ${column}`),
            }
        });
        return wasm.instance.exports
    }
    catch (e) {
        console.log(e)
    }
}