import * as bind from "./utils/bindgroups.js";
import * as shade from "./utils/shaderModules.js";
import * as buffers from "./utils/bufferCreators.js";
import { matrixUtils, matrixSize } from "./utils/gslCode/matrixUtils.js";
import * as scripts from "./utils/gslCode/gslScripts.js"

self.onmessage = async (e) => {
  //
  const adapter = await navigator.gpu?.requestAdapter();
  if (!adapter) {
    console.error(
      "This function cannot be used, WebGPU not available in your browser"
    );
    return Error();
  }

  const device = await adapter.requestDevice();

  device.lost.then((info) => {
    console.error("Device was lost: ", info);
  });

  let st = 0,
    end = 0;
  const { funcName, funcArgs } = e.data;
  let data = new Float32Array(e.data.data);
  let result = null;
  let matData = [],
    matSize = [],
    matBuffers = [],
    lays = [],
    groups = [];

  //this needs to change
  data = [
    data.slice(0, data.length / 2),
    data.slice(data.length / 2, data.length),
  ];
  try {
    for (const scr in scripts) {
      if (funcName in scripts[scr]) {

        st = performance.now();
        funcArgs === null ?? {};
        for (var i = 0; i < data.length; i++) {
          matSize.push(matrixSize(data[i], funcArgs));
          matData.push(new Float32Array([...matSize[i], ...data[i]]));
          matBuffers.push(buffers.bufferCreator(true, device, matData[i]));
        }

        const [rSize, rBuffer] = buffers.resultHolder(
          device,
          matData,
          funcName
        );

        for (var j = 0; j <= matData.length; j++) {
          lays.push(
            bind.layoutEntry(
              j,
              j === matData.length ? "storage" : "read-only-storage"
            )
          );
          groups.push(
            bind.groupEntry(j, j === matData.length ? rBuffer : matBuffers[j])
          );
        }
        console.log(scripts[scr][funcName]);
        const bindGroupLayout = bind.bindLayout(device, lays),
          bindgroup = bind.bindGroup(device, bindGroupLayout, groups),
          shader = shade.shaderModule(device, scripts[scr][funcName]()),
          pipeline = shade.computingPipelines(device, shader, bindGroupLayout);

        let stgR = await shade.dispatchers(
          device,
          pipeline,
          bindgroup,
          matData,
          [rSize, rBuffer]
        );
        result = stgR.slice(2);
      }
    }
    end = performance.now();

    console.log(result);
    self.postMessage({
      id: e.data.id,
      results: result,
      step: e.data.step,
      exec: end - st,
    });
  } catch (e) {
    console.error(e);
  }
};
