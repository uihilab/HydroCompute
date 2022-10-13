/**
 * Creates multiple entries to be binded into the layout group
 * @param {*} btype 
 * @param {*} bufferType 
 * @returns 
 */
export const layoutEntry = (btype, bufferType) => {
    return {
        binding: btype,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
            type: bufferType
        }
    }
}

/**
 * 
 * @param {*} bind 
 * @param {*} bufferLength 
 * @returns 
 */
export const groupEntry = (bind, bufferLength)=>{
    return {
        binding: bind,
        resource: {
            buffer: bufferLength
        }
    }
}

/**
 * 
 * @param {*} device 
 * @param {*} entries 
 * @returns 
 */
export const bindLayout = (device, entries) => {
    return device.createBindGroupLayout({
        entries: entries
    })

}

/**
 * 
 * @param {*} device 
 * @param {*} layout 
 * @param {*} entries 
 * @returns 
 */
export const bindGroup = (device, layout, entries) => {
    return device.createBindGroup({
        layout: layout,
        entries: entries
    })
}