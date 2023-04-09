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
    { funcName, funcArgs, id, step, data} = e.data;
  
    data = new Float32Array(data);

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

    self.postMessage(
      {
        id,
        results: result,
        step,
        funcName,
        funcExec: performance.measure('measure-execution', 'start-function', 'end-function').duration,
        workerExec: performance.measure('measure-execution', 'start-script', 'end-script').duration
      },
      [result]
    );
  } catch (e) {
    console.error(e);
    return
  }
};
