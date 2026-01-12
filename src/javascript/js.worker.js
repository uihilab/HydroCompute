import { getPerformanceMeasures } from "../core/utils/globalUtils.js";
import Hydrolang from "../../../hydrolang/hydrolang.js";
import { openDatabase } from "../core/utils/db-config.js";
import {
  verifyDatabaseAccess,
  getDataFromIndexedDB,
  storeResultInIndexedDB,
  prepareDataForStorage
} from "../core/utils/db-utils.js";

/**
 * @description JavaScript worker for executing JS scripts and functions. The worker does not utilize any subset functions to call any computation and runs directly based on the implementation of the underlying scripts.
 * @memberof Workers
 * @module WebWorker
 * @name JSWorker
 */


self.onmessage = async (e) => {
  performance.mark("start-script");
  const { funcName = null, id, step, scriptName, data, dbConfig, type = null, uniqueId, dependencies } = e.data;

  self.postMessage({
    type: 'status',
    itemId: uniqueId,
    status: 'running'
  });

  // Convert the incoming data into a Float32Array
  let dataArray;

  if (dbConfig) {
    try {
      // CRITICAL: Ensure dependencies is always an array (even if empty)
      // This prevents "Cannot read properties of undefined (reading 'map')" errors
      const deps = Array.isArray(dependencies) ? dependencies : (dependencies ? [dependencies] : []);

      // If no dependencies, skip data loading (value mapping mode - value is in args)
      if (deps.length === 0) {
        dataArray = []; // Empty array - function will use args/params instead
      } else {
        // Function to get data with retry logic
        const getDataWithRetry = async (funcName, depId, maxRetries = 5) => {
          // Workaround - NEED CHANGE
          if (funcName === 'retrieve') return;

          for (let i = 0; i < maxRetries; i++) {
            try {
              const data = await getDataFromIndexedDB(dbConfig.database, dbConfig.storeName, depId);
              if (data) {
                return data;
              }

              // If data not found, wait before retry
              const delayMs = 100 * Math.pow(2, i); // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, delayMs));
            } catch (error) {
              if (i === maxRetries - 1) throw error;

              // Wait before retry
              const delayMs = 100 * Math.pow(2, i); // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
          throw new Error(`Failed to get data for ID ${depId} after ${maxRetries} attempts`);
        };

        // Process all dependencies and get data with retry logic
        const dataPromises = deps.map(depId => getDataWithRetry(
          typeof funcName === 'object' ? funcName.func : funcName,
          depId
        ));

        dataArray = await Promise.all(dataPromises);
      }
    } catch (error) {
      console.error('Error retrieving dependency data:', error);
      self.postMessage({
        type: 'status',
        itemId: uniqueId,
        status: 'error',
        error: `Failed to retrieve dependency data: ${error.message}`
      });
      throw error;
    }
  } else {
    dataArray = new Float32Array(e.data.data);
  }

  let result = null;

  try {
    // Start function execution
    performance.mark("start-function");

    // Handle Hydrolang function
    if (type === 'hydrolang') {
      // Instantiate Hydrolang directly - no visuals for workers
      const hydro = new Hydrolang({ includeVisuals: false, cache: false });
      // Execute Hydrolang function with its expected structure
      const { module, component = null, func } = funcName;

      let stage;

      // Handle empty dataArray (value mapping mode - no data dependencies)
      if (Array.isArray(dataArray) && dataArray.length === 0) {
        dataArray = null; // No data - value is in args/params
      } else {
        // For all functions including geoprocessor, pass data as array: [data1, data2, ...]
        // Keep as array - don't unwrap single items for geoprocessor
        // Other functions may unwrap, but geoprocessor needs array format
        if (component === 'geoprocessor' && func === 'execute') {
          // CRITICAL: Data from IndexedDB should already be decompressed by maybeDecompressGzip in db-utils.js
          // Gzipped files are serialized as Base64 when saving and decompressed when retrieving
          // We just need to ensure it's in ArrayBuffer format for geoprocessor

          // Convert string-encoded payloads (e.g., legacy data or non-database sources) to ArrayBuffer
          function toArrayBuffer(input) {
            // CRITICAL: Handle ArrayBuffer directly
            if (input instanceof ArrayBuffer) {
              return input;
            }

            // CRITICAL: Handle TypedArray views
            if (ArrayBuffer.isView(input)) {
              return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
            }

            // CRITICAL: Handle result objects from IndexedDB (e.g., {id: '...', data: ArrayBuffer(...), ...})
            // When data is retrieved from database, it might be wrapped in a result object
            if (input && typeof input === 'object' && input.data !== undefined) {
              // Recursively call toArrayBuffer on the data property
              return toArrayBuffer(input.data);
            }

            // CRITICAL: Handle objects that might be ArrayBuffer-like (e.g., from structured clone)
            // Sometimes ArrayBuffers get wrapped in objects during transfer
            if (input && typeof input === 'object' && input.byteLength !== undefined) {
              // This might be an ArrayBuffer that was wrapped - try to reconstruct
              // Check if it has the structure of a wrapped ArrayBuffer
              if (input.constructor && input.constructor.name === 'ArrayBuffer') {
                // It's actually an ArrayBuffer, just check failed - return as-is
                return input;
              }
            }

            // Handle string inputs (base64 or direct)
            if (typeof input === 'string') {
              // Try base64 first (common for binary data stored as strings)
              try {
                const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                if (input.length % 4 === 0 && base64Regex.test(input.replace(/\s+/g, ''))) {
                  const binary = atob(input.replace(/\s+/g, ''));
                  const buf = new ArrayBuffer(binary.length);
                  const view = new Uint8Array(buf);
                  for (let i = 0; i < binary.length; i++) {
                    view[i] = binary.charCodeAt(i);
                  }
                  return buf;
                }
              } catch (e) {
                // Not base64, continue with direct conversion
              }

              // Direct conversion: treat each char code as a byte
              const buf = new ArrayBuffer(input.length);
              const view = new Uint8Array(buf);
              for (let i = 0; i < input.length; i++) {
                view[i] = input.charCodeAt(i) & 0xFF;
              }
              return buf;
            }

            console.error('[js.worker] Unsupported input type:', typeof input, input);
            throw new Error(`Unsupported input type: ${typeof input}. Expected ArrayBuffer, TypedArray, string, or object with data property.`);
          }

          // CRITICAL: Data from IndexedDB is already decompressed by maybeDecompressGzip
          // Just ensure it's in ArrayBuffer format
          // CRITICAL: Geoprocessor needs data as an array of ArrayBuffers, even if single item
          if (Array.isArray(dataArray)) {
            dataArray = dataArray.map((item, idx) => {
              const buffer = toArrayBuffer(item);

              // CRITICAL: Ensure we're returning a proper ArrayBuffer, not a view
              if (!(buffer instanceof ArrayBuffer)) {
                console.error(`[js.worker] ERROR: toArrayBuffer returned non-ArrayBuffer for item ${idx}:`, typeof buffer, buffer);
                throw new Error(`Failed to convert item ${idx} to ArrayBuffer. Got: ${typeof buffer}`);
              }

              return buffer;
            });
          } else {
            const buffer = toArrayBuffer(dataArray);
            if (!(buffer instanceof ArrayBuffer)) {
              console.error(`[js.worker] ERROR: toArrayBuffer returned non-ArrayBuffer:`, typeof buffer, buffer);
              throw new Error(`Failed to convert dataArray to ArrayBuffer. Got: ${typeof buffer}`);
            }
            dataArray = [buffer];
          }

          // CRITICAL: Verify all items are ArrayBuffers before passing to geoprocessor
          const allAreArrayBuffers = dataArray.every(item => item instanceof ArrayBuffer);
          if (!allAreArrayBuffers) {
            console.error('[js.worker] ERROR: Not all items in dataArray are ArrayBuffers:',
              dataArray.map((item, idx) => ({
                idx,
                type: typeof item,
                isArrayBuffer: item instanceof ArrayBuffer,
                constructor: item?.constructor?.name
              }))
            );
            throw new Error('Geoprocessor requires all data items to be ArrayBuffers');
          }

          // Geoprocessor expects data as array: [data1, data2, ...]
        } else {
          // For other functions, unwrap single-item arrays as before
          dataArray = dataArray.length === 1 ? dataArray[0] : dataArray;
        }
      }

      if (component == null) {
        // Some callers pass the "component" in func (e.g., analyze.stats.* or analyze.nn.*),
        // so if hydro[module][func] is not a function but is an object, treat func as the component.
        const target = hydro[module]?.[func];
        if (typeof target === 'function') {
          stage = await target({
            params: funcName.params,
            args: funcName.args,
            data: dataArray
          });
        } else if (target && typeof target === 'object') {
          // Try treating func as component and use an inner function name
          const innerFunc =
            funcName?.functionName ||
            funcName?.method ||
            funcName?.action ||
            funcName?.targetFunction ||
            funcName?.func2 ||
            funcName?.func; // fallback to provided func

          if (innerFunc && typeof target[innerFunc] === 'function') {
            stage = await target[innerFunc]({
              params: funcName.params || {},
              args: funcName.args || {},
              data: dataArray
            });
          } else {
            const available = Object.keys(target || {});
            throw new Error(`Hydrolang component "${func}" does not expose function "${innerFunc || 'undefined'}". Available: ${available.join(', ')}`);
          }
        } else {
          throw new Error(`Hydrolang function not found: hydro.${module}.${func}`);
        }
      } else {
        // CRITICAL: For geoprocessor, pass ArrayBuffer directly (not wrapped in array)
        // Geoprocessor expects: data: ArrayBuffer (not data: [ArrayBuffer])
        let dataToPass = dataArray;
        if (component === 'geoprocessor' && Array.isArray(dataArray) && dataArray.length === 1) {
          const firstItem = dataArray[0];
          if (firstItem instanceof ArrayBuffer) {
            dataToPass = firstItem; // Pass ArrayBuffer directly, not wrapped in array
          } else if (ArrayBuffer.isView(firstItem)) {
            dataToPass = firstItem.buffer.slice(firstItem.byteOffset, firstItem.byteOffset + firstItem.byteLength);
          } else {
            console.error('[js.worker] ERROR: First item is not ArrayBuffer or TypedArray:', typeof firstItem, firstItem);
          }
        }

        // CRITICAL: For geoprocessor ONLY, ensure we pass the ArrayBuffer correctly
        // Other components (stats, hydro, etc.) can receive arrays or other data types
        let finalData = dataToPass;
        if (component === 'geoprocessor') {
          // CRITICAL: Ensure we're passing an ArrayBuffer, not a string or other type
          if (!(dataToPass instanceof ArrayBuffer) && !ArrayBuffer.isView(dataToPass)) {
            console.error('[js.worker] ERROR: Geoprocessor requires ArrayBuffer, but dataToPass is not ArrayBuffer or TypedArray!', {
              type: typeof dataToPass,
              value: dataToPass,
              constructor: dataToPass?.constructor?.name
            });
            throw new Error(`Geoprocessor requires ArrayBuffer, but received: ${typeof dataToPass} (${dataToPass?.constructor?.name || 'unknown'})`);
          }

          // Keep as ArrayBuffer (geoprocessor expects ArrayBuffer directly)
          if (dataToPass instanceof ArrayBuffer) {
            finalData = dataToPass; // Keep original ArrayBuffer
          } else if (ArrayBuffer.isView(dataToPass)) {
            // Convert TypedArray to ArrayBuffer
            finalData = dataToPass.buffer.slice(dataToPass.byteOffset, dataToPass.byteOffset + dataToPass.byteLength);
          }
        } else {
          // For non-geoprocessor components (stats, hydro, etc.), use data as-is
          finalData = dataToPass;
        }

        // CRITICAL: Verify one more time right before passing
        if (component === 'geoprocessor') {
          if (!(finalData instanceof ArrayBuffer)) {
            console.error('[js.worker] FATAL ERROR: finalData is not ArrayBuffer right before passing!', {
              type: typeof finalData,
              isArrayBuffer: finalData instanceof ArrayBuffer,
              isTypedArray: ArrayBuffer.isView(finalData),
              constructor: finalData?.constructor?.name,
              value: finalData
            });
            throw new Error(`Geoprocessor requires ArrayBuffer, but received: ${typeof finalData} (${finalData?.constructor?.name || 'unknown'})`);
          }
        }

        // CRITICAL: Log exactly what we're passing
        const functionCallData = {
          params: funcName.params || {},
          args: funcName.args || {},
          data: finalData
        };

        // CRITICAL: Also try passing data in args if geoprocessor expects it there
        if (component === 'geoprocessor') {
          // Some geoprocessor functions might expect data in args.data
          if (!functionCallData.args.data && finalData instanceof ArrayBuffer) {
            console.log('[js.worker] Also adding ArrayBuffer to args.data for geoprocessor');
            functionCallData.args.data = finalData;
          }
        }

        stage = await hydro[module][component][func](functionCallData);
      }

      // CRITICAL: Ensure stage is not a Promise (it should be resolved by await above)
      // But double-check in case the function returns a Promise
      if (stage && typeof stage.then === 'function') {
        console.warn('Hydrolang function returned a Promise, awaiting resolution...');
        result = await stage;
      } else {
        result = stage;
      }
    } else if (type === 'javascript' && funcName && funcName.func === 'javascript_code') {
      // Handle JavaScript code block execution
      // Get settings from database to retrieve JavaScript code
      if (!uniqueId || !dbConfig) {
        throw new Error('Missing uniqueId or dbConfig for JavaScript code execution');
      }

      const db = await openDatabase();
      const settingsStore = db.transaction('settings', 'readonly').objectStore('settings');
      const settings = await new Promise((resolve, reject) => {
        const request = settingsStore.get(uniqueId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!settings || !settings.code) {
        throw new Error(`Settings or code not found for item ${uniqueId}`);
      }

      const jsCode = settings.code;
      const language = settings.language || 'javascript';

      if (language !== 'javascript') {
        throw new Error(`Expected JavaScript code but got language: ${language}`);
      }

      // Validate code structure
      if (!jsCode || typeof jsCode !== 'string' || jsCode.trim().length === 0) {
        throw new Error('JavaScript code is empty or invalid');
      }

      // Prepare data for code execution
      const inputData = dataArray && dataArray.length === 1 ? dataArray[0] : dataArray;

      // Execute JavaScript code with defined structure and error handling
      try {
        // CRITICAL: Wrap code in a structured function with proper error handling
        // Structure: function receives data, processes it, and returns result
        const structuredCode = `
          (function(data) {
            try {
              // User's code starts here
              ${jsCode}
              // User's code ends here
              
              // CRITICAL: If code doesn't explicitly return, try to capture last expression
              // Check if code ends with return statement
              const codeEndsWithReturn = ${jsCode.trim().endsWith('return') || jsCode.trim().endsWith('return;')};
              
              // If no explicit return, evaluate the last expression
              if (!codeEndsWithReturn) {
                // Try to execute and capture result
                const lastExpression = (function() {
            ${jsCode}
                })();
                return lastExpression;
              }
            } catch (error) {
              // Provide structured error information
              throw new Error(\`JavaScript code execution failed: \${error.message}\\n\\nStack trace:\\n\${error.stack || 'N/A'}\\n\\nCode location: Check your code block for syntax errors or runtime issues.\`);
            }
          })
        `;

        // Validate code syntax before execution
        try {
          // Try to parse as function to catch syntax errors early
          new Function('return ' + structuredCode);
        } catch (syntaxError) {
          throw new Error(`JavaScript syntax error: ${syntaxError.message}\n\nPlease check your code for:\n- Missing brackets, parentheses, or semicolons\n- Undefined variables\n- Invalid function calls\n- Syntax errors`);
        }

        const codeFunction = new Function('return ' + structuredCode)();
        let codeResult = codeFunction(inputData);

        // CRITICAL: If result is a Promise, await it
        if (codeResult && typeof codeResult.then === 'function') {
          codeResult = await codeResult;
        }

        result = codeResult;

        // Validate result
        if (result === undefined) {
          console.warn('JavaScript code executed but returned undefined. Make sure your code returns a value.');
          result = null; // Store null instead of undefined for database compatibility
        }

      } catch (error) {
        console.error('Error executing JavaScript code:', error);

        // Provide structured error message
        const errorMessage = error.message || 'Unknown JavaScript execution error';
        const enhancedError = new Error(
          `JavaScript Code Block Execution Failed\n\n` +
          `Error: ${errorMessage}\n\n` +
          `Troubleshooting:\n` +
          `1. Check that your code returns a value (use 'return' statement)\n` +
          `2. Verify that 'data' variable contains expected input\n` +
          `3. Check for syntax errors (missing brackets, parentheses, etc.)\n` +
          `4. Ensure all variables are defined before use\n` +
          `5. Check browser console for detailed error information`
        );
        throw enhancedError;
      }
    } else {
      // Handle other execution types (legacy script handling, etc.)
      // Load the script file dynamically
      let scripts;
      if (scriptName) {
        scripts = await import(`../../${scriptName}`);
        //using the inner object saved in the default variable
        scripts = scripts.default
      } else {
        scripts = await import("./scripts/scripts.js");
      }

      // Existing script handling logic
      if (scriptName !== undefined) {
        if (Object.keys(scripts).includes("main") &&
          Object.keys(scripts).includes(funcName) &&
          funcName !== "main") {
          result = new Float32Array(scripts["main"](funcName, [...dataArray]));
        } else if (!Object.keys(scripts).includes("main")) {
          result = new Float32Array(scripts[funcName]([...dataArray]));
        } else if ((funcName === undefined || funcName === "main") &&
          Object.keys(scripts).includes("main")) {
          result = new Float32Array(scripts["main"]([...dataArray]));
        }
      } else {
        // Existing script search logic
        for (const script in scripts) {
          if (Object.keys(scripts[script]).includes("main") &&
            Object.keys(scripts[script]).includes(funcName)) {
            result = new Float32Array(scripts[script]["main"](funcName, [...dataArray]));
            break;
          } else if (!Object.keys(scripts[script]).includes("main") &&
            Object.keys(scripts[script]).includes(funcName)) {
            result = new Float32Array(scripts[script][funcName]([...dataArray]));
            break;
          }
        }
      }
    }

    // Store result in database if dbConfig is provided and we have a result
    if (dbConfig && dbConfig.storeName && result !== null && result !== undefined && uniqueId) {
      try {
        // First verify database access
        await verifyDatabaseAccess(dbConfig.database, dbConfig.storeName);

        // CRITICAL: Ensure result is fully resolved before preparing for storage
        // Some functions might return Promises that weren't caught earlier
        let resolvedResult = result;
        if (result && typeof result.then === 'function') {
          console.warn('Result is still a Promise, awaiting final resolution...');
          resolvedResult = await result;
        }

        // Double-check for nested Promises in the resolved result
        // This handles cases where the result structure itself contains Promises
        if (resolvedResult && typeof resolvedResult === 'object') {
          // Check if result is an array with Promises
          if (Array.isArray(resolvedResult)) {
            const hasPromises = resolvedResult.some(item => item && typeof item.then === 'function');
            if (hasPromises) {
              console.warn('Array contains Promises, resolving all...');
              resolvedResult = await Promise.all(resolvedResult.map(async item => {
                if (item && typeof item.then === 'function') {
                  return await item;
                }
                return item;
              }));
            }
          }
        }

        // Prepare data for storage (handle serialization issues)
        // CRITICAL: prepareDataForStorage is now async and handles Promises
        const serializableData = await prepareDataForStorage(resolvedResult);

        // Make sure we have the correct data structure
        const resultToStore = {
          id: uniqueId,
          data: serializableData, // Store the serialized result data
          status: "completed",
          timestamp: new Date().toISOString()
        };

        // Include additional metadata but keep proper structure
        if (funcName && typeof funcName === 'object') {
          resultToStore.function = funcName.path || funcName.func;
          resultToStore.module = funcName.module;
          resultToStore.component = funcName.component;
        } else if (typeof funcName === 'string') {
          resultToStore.function = funcName;
        }

        await storeResultInIndexedDB(
          dbConfig.database,
          dbConfig.storeName,
          resultToStore
        );
      } catch (dbError) {
        console.error('Failed to store result in IndexedDB:', dbError);
        // Don't throw the error - let the computation succeed even if storage fails
        // throw dbError; // Propagate the error
      }
    }

    // Send status update
    if (uniqueId) {
      self.postMessage({
        type: 'status',
        itemId: uniqueId,
        status: 'completed'
      });
    }

    performance.mark("end-function");
    performance.mark("end-script");

    let getPerformance = getPerformanceMeasures();

    // CRITICAL: Ensure result doesn't contain Promises before sending via postMessage
    // postMessage cannot clone Promises
    let serializableResult = result;
    if (result && typeof result.then === 'function') {
      console.warn('Result is a Promise, awaiting before postMessage...');
      serializableResult = await result;
    } else if (result && typeof result === 'object' && result !== null) {
      // Check for nested Promises by trying to serialize
      try {
        JSON.stringify(result);
      } catch (e) {
        // If serialization fails, clean it using prepareDataForStorage
        serializableResult = await prepareDataForStorage(result);
      }
    }

    self.postMessage({
      id,
      status: 'completed',
      step,
      funcName: type === 'hydrolang' ? funcName.path : (typeof funcName === 'object' ? funcName.func : funcName),
      results: serializableResult, // CRITICAL: Include result in postMessage for JavaScript code blocks
      ...getPerformance
    });

  } catch (error) {
    console.error('Error executing function:', error);

    // Send error status update
    if (uniqueId) {
      self.postMessage({
        type: 'status',
        itemId: uniqueId,
        status: 'error',
        error: error.message || 'Unknown error'
      });
    }

    throw error;
  }
};

// Database utility functions are now imported from shared db-utils.js