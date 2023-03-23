/**
 * @description main kernels used for computation. Any additional backends will be added here.
 * 
 */

export const kernels = {
    wasm: "../../src/wasm/worker.js",
    javascript: "../../src/javascript/worker.js",
    webgpu: "../../src/webgpu/worker.js",
}
