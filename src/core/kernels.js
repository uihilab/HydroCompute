import webrtc from "../webrtc/webrtc.js";
// import wasm from "../wasm/wasm.js";
// import webgpu from "../webgpu/webgpu.js";
// import webgl from "../webgl/webgl.js";
// import javascript from "../javascript/javascript.js";

export const kernels = {
    wasm: "../../src/wasm/worker.js",
    javascript: "../../src/javascript/worker.js",
    webgpu: "../../src/webgpu/worker.js",
    webrtc: new webrtc()
}


// export { wasm, webrtc, webgpu, webgl, javascript };
// export { kernels };
