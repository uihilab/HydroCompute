/**
 * This namespace should have available all the modules that have been added into the AS-compiled web assembly folder.
 * @memberof WASMUtils
 * @member ASUtils
 * @property matrixUtils_AS
 * @property timeSeries_AS
 */
export const ASUtils = {
    //anything else that has to be interfaced needs to be called from here
    matrixUtils: 'matrixUtils.wasm',
    timeSeries: 'timeSeries.wasm'
}