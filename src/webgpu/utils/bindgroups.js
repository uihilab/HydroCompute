/**
 * Creates a layout entry to be bound into the layout group.
 * @member layoutEntry
 * @memberof gpuUtils
 * @param {number} btype - The binding type.
 * @param {string} bufferType - The buffer type.
 * @returns {object} - The layout entry object.
 */
export const layoutEntry = (btype, bufferType) => {
  return {
    binding: btype,
    visibility: GPUShaderStage.COMPUTE,
    buffer: {
      type: bufferType,
    },
  };
};

/**
 * Creates a group entry to be bound into the layout group.
 * @member groupEntry
 * @memberof gpuUtils
 * @param {number} bind - The binding number.
 * @param {object} bufferLength - The buffer length resource.
 * @returns {object} - The group entry object.
 */
export const groupEntry = (bind, bufferLength) => {
  return {
    binding: bind,
    resource: {
      buffer: bufferLength,
    },
  };
};

/**
 * Creates a bind group layout.
 * @member bindLayout
 * @memberof gpuUtils
 * @param {GPUDevice} device - The GPU device.
 * @param {object[]} entries - The layout entries.
 * @returns {GPUBindGroupLayout} - The bind group layout.
 */
export const bindLayout = (device, entries) => {
  return device.createBindGroupLayout({
    entries: entries,
  });
};

/**
 * Creates a bind group.
 * @member bindGroup
 * @memberof gpuUtils
 * @param {GPUDevice} device - The GPU device.
 * @param {GPUBindGroupLayout} layout - The bind group layout.
 * @param {object[]} entries - The bind group entries.
 * @returns {GPUBindGroup} - The bind group.
 */
export const bindGroup = (device, layout, entries) => {
  return device.createBindGroup({
    layout: layout,
    entries: entries,
  });
};
