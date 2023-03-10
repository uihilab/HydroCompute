/**
 * Function returns a shader module back for usage in the compute section
 * @param {GPUDevice} device - instance of the GPU device stored within the GPU class
 * @param {String} code - string of code that is in webgl  format
 * @returns
 */
export const shaderModule = (device, code) => {
  return device.createShaderModule({
    code: code,
  });
};

/**
 *
 * @param {GPUDevice} device - instance of the GPU device stored within the GPU class
 * @param {Object[]} bindGroups - containing all possible bindgroups required for a computation
 * @returns
 */
export const computingPipelines = (device, shaderModule, bindGroups) => {
  return device.createComputePipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroups],
    }),
    compute: {
      module: shaderModule,
      entryPoint: "main",
    },
  });
};

/**
 *
 * @param {*} device
 * @param {*} pipeline
 * @param {*} bindgroup
 * @param {*} data
 * @param {*} result
 */
export const dispatchers = async (
  device,
  pipeline,
  bindgroup,
  data,
  result
) => {
  const encoder = device.createCommandEncoder(),
    passEncoder = encoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindgroup);
  //This will need modifications to extend the matrices and or new data types
  let x = data.map(arr => (arr[0] + 7 ) >>> 3)
  passEncoder.dispatchWorkgroups(
    ...x
  );
  passEncoder.end();

  //result buffer holder once the compute is done
  const gpuBuffer = device.createBuffer({
    size: result[0],
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  encoder.copyBufferToBuffer(result[1], 0, gpuBuffer, 0, result[0]);

  const gpuCommands = encoder.finish();
  device.queue.submit([gpuCommands]);

  await gpuBuffer.mapAsync(GPUMapMode.READ);
  const arrayBuffer = gpuBuffer.getMappedRange();
  //Removing the first 2 elements of the array. Only used for the
  //bind group.
  const dataResult = arrayBuffer.slice(8);
  gpuBuffer.unmap();
  return dataResult;
};
