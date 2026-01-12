/**
 * @module kernels
 * @description main kernel workers used for computation. Any additional backends will be added here.
 */

export const kernels = {
    wasm: "../../src/wasm/wasm.worker.js",
    javascript: "../../src/javascript/js.worker.js",
    webgpu: "../../src/webgpu/wgpu.worker.js",
    python: "../../src/python/python.worker.js",
    webr: "../../src/R/webr.worker.js",
}
