/**
 * Web worker script for executing GPU computations.
 * @module WebWorker
 * @memberof Worker
 * @name GPUWorker
 */
import {
  layoutEntry,
  groupEntry,
  bindLayout,
  bindGroup,
} from "./utils/bindgroups.js";
import {
  shaderModule,
  computingPipelines,
  dispatchers,
} from "./utils/shaderModules.js";
import {
  matrixSize,
  bufferCreator,
  resultHolder,
} from "./utils/bufferCreators.js";
import { deviceConnect } from "./device.js";
import { getPerformanceMeasures } from "../core/utils/globalUtils.js";
import { splits } from "../core/utils/splits.js";


const adapter = new deviceConnect();

/**
 * Event listener for the 'message' event.
 * @param {MessageEvent} e - The message event.
 */
self.onmessage = async (e) => {
  performance.mark("start-script");

  const device = await adapter.initialize();
  //
  let result = null,
    matData = [],
    matSize = [],
    matBuffers = [],
    lays = [],
    groups = [],
    { funcName, funcArgs, id, step, data, scriptName, length } = e.data;
  data = new Float32Array(data);

  let scripts;
  if (scriptName) {
    scripts = await import(`../../${scriptName}`);
        //using the inner object saved in the default variable
        scripts = scripts.default
  } else {
    scripts = await import("./utils/gslCode/gslScripts.js");
  }

  try {
    if (scriptName !== undefined) {
    } else {
      for (const scr in scripts) {
        if (funcName in scripts[scr]) {
          let glslCode = scripts[scr][funcName](),
            countWrite = (glslCode.match(/read_write/g) || []).length,
            countRead = (glslCode.match(/read/g) || []).length;


          data = splits.split1DArray({data: data, n: length})

          funcArgs === null ?? {};
          for (var i = 0; i < data.length; i++) {
            matSize.push(matrixSize(data[i], funcArgs));
            matData.push(new Float32Array([...matSize[i], ...data[i]]));
            matBuffers.push(bufferCreator(true, device, matData[i]));
          }

          const [rSize, rBuffer] = resultHolder(
            device,
            matData,
            countRead,
            countWrite
          );

          for (var j = 0; j <= matData.length; j++) {
            lays.push(
              layoutEntry(
                j,
                j === matData.length ? "storage" : "read-only-storage"
              )
            );
            groups.push(
              groupEntry(j, j === matData.length ? rBuffer : matBuffers[j])
            );
          }
          const bindGroupLayout = bindLayout(device, lays),
            bindgroup = bindGroup(device, bindGroupLayout, groups),
            shader = shaderModule(device, glslCode),
            pipeline = computingPipelines(device, shader, bindGroupLayout);

          performance.mark("start-function");

          result = await dispatchers(device, pipeline, bindgroup, matData, [
            rSize,
            rBuffer,
          ]);
          performance.mark("end-function");
        }
      }
    }
    performance.mark("end-script");
    let getPerformance = getPerformanceMeasures();

    self.postMessage(
      {
        id,
        results: result,
        step,
        funcName,
        ...getPerformance,
      },
      [result]
    );
  } catch (error) {
    if (!(error instanceof DOMException) && typeof scripts !== "undefined") {
      console.error(
        `There was an error executing:\nfunction: ${funcName}\nid: ${id} at the worker`
      );
      throw error;
    } else {
      console.error("There was an error running the webgpu worker script. ");
      throw error;
    }
  }
};
