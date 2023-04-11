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
  deviceConnect,
} from "./utils/bufferCreators.js";
import * as scripts from "./utils/gslCode/gslScripts.js";
import { getPerformanceMeasures } from "../core/utils/globalUtils.js";

const adapter = new deviceConnect()

self.onmessage = async (e) => {
  performance.mark('start-script');

  const device = await adapter.initialize()
    //  
  let result = null,
    matData = [],
    matSize = [],
    matBuffers = [],
    lays = [],
    groups = [],
    { funcName, funcArgs, id, step, data, scriptName} = e.data;
    data = new Float32Array(data);

    if (scriptName !== undefined) {
      let scr = await import (e.data.scriptName);
    }

  try {
    for (const scr in scripts) {
      if (funcName in scripts[scr]) {
        let glslCode = scripts[scr][funcName](),
        countWrite = (glslCode.match(/read_write/g) || []).length,
        countRead = (glslCode.match(/read/g) || []).length;
        let length = data.length

        countRead === 3 && countWrite === 1
          ? (data = [
              data.slice(0, length >> 1),
              data.slice(length >> 1, length),
            ])
          : (data = [data]);

        //   const matData = countRead === 3 && countWrite === 1
        //   ? ([
        //     floatData.subarray(0, data.length >> 1),
        //     floatData.subarray(data.length >> 1)
        //   ])
        // : ([floatData]);

        funcArgs === null ?? {};
        for (var i = 0; i < data.length; i++) {
          matSize.push(matrixSize(data[i], countRead - countWrite, funcArgs));
          matData.push(new Float32Array([...matSize[i], ...data[i]]));
          matBuffers.push(bufferCreator(true, device, matData[i]));
        }

        // const matSize = matData.map(
        //   (item) => matrixSize(item, countRead - countWrite, funcArgs)
        // );
        // const matBuffers = matData.map(
        //   (item, index) => bufferCreator(true, device, new Float32Array([...matSize[index], ...item]))
        // );

        // console.log(matSize, matBuffers)

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

        performance.mark('start-function');

        result = await dispatchers(device, pipeline, bindgroup, matData, [
          rSize,
          rBuffer,
        ]);
        performance.mark('end-function');
      }
    }
    performance.mark('end-script');
    let getPerformance = getPerformanceMeasures()

    self.postMessage(
      {
        id,
        results: result,
        step,
        funcName,
        ...getPerformance
      },
      [result]
    );
  } catch (error) {
    if (!(error instanceof DOMException) && typeof scripts !== "undefined") {
      console.error(
        `There was an error executing:\nfunction: ${funcName}\nid: ${id}`,
        error
      );
      return 
    } else {
      console.error(
        "There was an error running the script. More info: ",
        error
      );
       return
    }
  }
};
