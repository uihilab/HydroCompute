/**
 * @namespace globalUtils
 */

/**
 * @method DAG
 * @memberof globalUtils
 * @description Directed Acyclic Graph implementation for solving promised-based functions
 * adopted from https://github.com/daanmichiels/promiseDAG
 * @param {Array} functions - functions required to run during a simulation as promised using the order [func1, func2...]
 * @param {Array} dag - dependency array listing the sequential executions for each funciton as [[0], [1], [0,1]...]
 * @param {Object} args - argument list used to run a specific function. This will change already on the engine
 * @param {String} type - running either a function DAG or a step DAG
 * @returns {Promise} fulfills the resolution for the DAG or returns error with the execution context.
 */

export const DAG = ({ functions, dag, args, type } = {}) => {
  return new Promise((resolve, reject) => {
    const N = functions.length;
    let stopped = false;
    let remaining = N;
    let values = new Map(); // Store results by function index

    // Initialize dependency tracking
    const counts = dag.map(deps => deps.length);

    const handleResolution = async (promise, i, value) => {
      values.set(i, value);
      if (stopped) return;

      remaining -= 1;
      if (remaining === 0) {
        // Convert Map to array for final result
        const resultArray = Array.from(values.values());
        resolve(resultArray);
        return;
      }

      // Check which functions can now run
      for (let j = 0; j < N; ++j) {
        if (counts[j] < 1) continue; // Already running or completed

        // Check if all dependencies are met
        const deps = dag[j];
        const allDepsComplete = deps.every(depIndex => values.has(depIndex));

        if (allDepsComplete) {
          counts[j] = 0; // Mark as ready to run

          // Collect all dependency results
          const depResults = deps.map(depIndex => values.get(depIndex));

          // Combine dependency results into input data
          let inputData;
          if (depResults.length > 1) {
            // Multiple dependencies - combine the results
            const combinedData = new Float32Array(depResults.reduce((acc, curr) => {
              return acc.concat(Array.from(curr));
            }, []));
            inputData = combinedData;
          } else {
            // Single dependency
            inputData = depResults[0];
          }

          // Update args with combined input data
          const newArgs = {
            ...args[j],
            data: inputData,
            dependencyResults: depResults // Pass all dependency results if needed
          };

          try {
            const promise = functions[j](newArgs);
            const result = await promise;
            handleResolution(promise, j, result);
          } catch (error) {
            handleRejection(promise, j, error);
          }
        }
      }
    };

    const handleRejection = (promise, i, error) => {
      stopped = true;
      console.error(`Error in function ${i}:`, error);
      reject(error);
    };

    // Start independent functions (those with no dependencies)
    for (let i = 0; i < N; ++i) {
      if (counts[i] === 0) {
        const promise = functions[i](args[i]);
        promise.then(
          value => handleResolution(promise, i, value),
          error => handleRejection(promise, i, error)
        );
      }
    }
  });
};

/**
 * @method IndexedDAG
 * @memberof globalUtils
 * @description Directed Acyclic Graph implementation that utilizes IndexedDB for persistent data dependent executions.
 * Handles extensive dependencies, partitioned files, and reference items.
 * @param {Object} options - Configuration object
 * @param {Array} options.functions - List of functions to execute
 * @param {Array} options.dependencies - Dependency graph
 * @param {Array} options.args - Arguments for each function
 * @param {Array} options.dataIds - Unique IDs for data items
 * @param {Object} options.dbConfig - Database configuration
 * @param {String} options.type - Execution type
 * @returns {Object} Executor controller with canExecute and getExecutionContext methods
 */
export const IndexedDAG = ({ functions, dependencies, args, dataIds, dbConfig, type }) => {
  // Check completion status in IndexedDB for a given key
  // CRITICAL: Must check both status AND that data actually exists
  const checkCompletion = async (key) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbConfig.database);

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([dbConfig.storeName], 'readonly');
        const store = transaction.objectStore(dbConfig.storeName);
        const getRequest = store.get(key);

        getRequest.onsuccess = () => {
          const result = getRequest.result;

          if (!result) {
            resolve(false);
            return;
          }

          // CRITICAL: Check both status AND that data exists
          // A dependency is only "completed" if it has status='completed' AND has actual data
          const isCompleted = result.status === 'completed' &&
            result.data !== undefined &&
            result.data !== null;

          resolve(isCompleted);
        };

        getRequest.onerror = (error) => {
          console.error(`Error getting key ${key}:`, error);
          reject(error);
        };

        transaction.oncomplete = () => {
          db.close();
        };
      };

      request.onerror = (error) => {
        console.error('Error opening database:', error);
        reject(error);
      };
    });
  };

  // Helper function to reassemble chunks for partitioned files
  const reassembleChunks = async (result, resultsStore) => {
    if (!result || !result.isPartitioned || !result.chunks || !Array.isArray(result.chunks) || result.chunks.length === 0) {
      return result; // Not partitioned or no chunks, return as-is
    }

    const chunkIds = result.chunks || [];
    const allChunks = [];

    // Load all chunks
    for (const chunkRef of chunkIds) {
      const chunkId = chunkRef.id || chunkRef;
      try {
        const chunkRequest = resultsStore.get(chunkId);
        const chunk = await new Promise((resolve, reject) => {
          chunkRequest.onsuccess = () => resolve(chunkRequest.result);
          chunkRequest.onerror = () => reject(new Error(`Failed to load chunk ${chunkId}`));
        });

        if (chunk && chunk.data !== undefined && chunk.data !== null) {
          allChunks.push({
            index: chunk.index !== undefined ? chunk.index : (chunkRef.index !== undefined ? chunkRef.index : 0),
            data: chunk.data
          });
        }
      } catch (e) {
        console.warn(`[IndexedDAG] Could not load chunk ${chunkId}:`, e);
      }
    }

    if (allChunks.length === 0) {
      // No chunks loaded, return original result
      return result;
    }

    // Sort chunks by index to ensure correct order
    allChunks.sort((a, b) => a.index - b.index);

    // Reassemble data based on file type
    if (result.originalFormat === 'CSV' || (result.type && result.type.includes('csv'))) {
      // For CSV: concatenate arrays
      const allData = [];
      for (const chunk of allChunks) {
        if (chunk.data && Array.isArray(chunk.data)) {
          allData.push(...chunk.data);
        }
      }

      return {
        ...result,
        data: allData.length > 0 ? allData : [],
        isPartitioned: false
      };
    } else {
      // For binary files: combine ArrayBuffers or Uint8Arrays
      const arrays = [];
      for (const chunk of allChunks) {
        if (chunk.data instanceof ArrayBuffer) {
          arrays.push(new Uint8Array(chunk.data));
        } else if (chunk.data instanceof Uint8Array) {
          arrays.push(chunk.data);
        } else if (Array.isArray(chunk.data)) {
          arrays.push(new Uint8Array(chunk.data));
        }
      }

      if (arrays.length > 0) {
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const arr of arrays) {
          combined.set(arr, offset);
          offset += arr.length;
        }

        return {
          ...result,
          data: combined.buffer,
          isPartitioned: false
        };
      } else {
        return {
          ...result,
          data: new ArrayBuffer(0),
          isPartitioned: false
        };
      }
    }
  };

  // Check completion AND if dependency is definitively failed (will never resolve)
  const checkDependencyStatus = async (depId) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbConfig.database);

      request.onsuccess = async (event) => {
        const db = event.target.result;

        // Check if settings store exists
        const hasSettingsStore = db.objectStoreNames.contains('settings');
        const storesToOpen = hasSettingsStore ? [dbConfig.storeName, 'settings'] : [dbConfig.storeName];
        const transaction = db.transaction(storesToOpen, 'readonly');
        const resultsStore = transaction.objectStore(dbConfig.storeName);
        const settingsStore = hasSettingsStore ? transaction.objectStore('settings') : null;

        // First, check if this is a reference item by checking settings
        const getSettingsRequest = settingsStore ? settingsStore.get(depId) : null;

        const checkReferenceItem = (settings) => {
          if (!settings) {
            return false;
          }

          const isRef = settings.isReference === true || settings.parameters?.source === 'database';

          if (isRef) {
            // This is a reference item - check the referenced data instead
            const referenceId = settings.arguments?.referenceId || settings.referenceData?.id || settings.parameters?.referenceId;

            if (referenceId) {
              const refRequest = resultsStore.get(referenceId);

              refRequest.onsuccess = async () => {
                let refResult = refRequest.result;

                if (!refResult) {
                  resolve({ completed: false, blocked: false });
                  return;
                }

                // CRITICAL: Reassemble chunks if this is a partitioned file
                refResult = await reassembleChunks(refResult, resultsStore);

                // Check if referenced data is valid
                if (refResult.status === 'error' || refResult.status === 'terminated' || refResult.status === 'failed') {
                  resolve({ completed: false, blocked: true, reason: `Referenced data ${referenceId} failed: ${refResult.status}` });
                  return;
                }

                // Reference item is satisfied if referenced data exists and has data
                const isCompleted = refResult.data !== undefined && refResult.data !== null;
                resolve({ completed: isCompleted, blocked: false });
              };

              refRequest.onerror = (error) => {
                console.error(`[IndexedDAG] Error getting referenced data ${referenceId}:`, error);
                resolve({ completed: false, blocked: false });
              };

              return true; // Indicates we're handling as reference (promise will resolve in callback)
            }
          }
          return false; // Not a reference item or no referenceId
        };

        if (getSettingsRequest) {
          getSettingsRequest.onsuccess = () => {
            const settings = getSettingsRequest.result;

            if (settings) {
              // If it's a reference item, handle it specially (checkReferenceItem will resolve the promise)
              if (checkReferenceItem(settings)) {
                return; // Promise will be resolved in checkReferenceItem callback
              }
            }

            // Not a reference item, check normally
            const getRequest = resultsStore.get(depId);

            getRequest.onsuccess = async () => {
              let result = getRequest.result;

              if (!result) {
                // Dependency doesn't exist - might still resolve (external dep could be created later)
                resolve({ completed: false, blocked: false });
                return;
              }

              // CRITICAL: Reassemble chunks if this is a partitioned file
              result = await reassembleChunks(result, resultsStore);

              // CRITICAL: Check if dependency is definitively failed (will never resolve)
              if (result.status === 'error' || result.status === 'terminated' || result.status === 'failed') {
                resolve({ completed: false, blocked: true, reason: result.status });
                return;
              }

              // Check if dependency is completed with valid data
              const hasData = result.data !== undefined && result.data !== null;
              const isCompleted = ((result.status === 'completed' || result.status === 'ready') && hasData) ||
                (depId.startsWith('upload-') && hasData);

              resolve({ completed: isCompleted, blocked: false });
            };

            getRequest.onerror = (error) => {
              console.error(`[IndexedDAG] Error getting dependency ${depId}:`, error);
              reject(error);
            };
          };

          getSettingsRequest.onerror = () => {
            // Settings not found or error - check as regular dependency
            const getRequest = resultsStore.get(depId);

            getRequest.onsuccess = async () => {
              let result = getRequest.result;

              if (!result) {
                resolve({ completed: false, blocked: false });
                return;
              }

              // CRITICAL: Reassemble chunks if this is a partitioned file
              result = await reassembleChunks(result, resultsStore);

              if (result.status === 'error' || result.status === 'terminated' || result.status === 'failed') {
                resolve({ completed: false, blocked: true, reason: result.status });
                return;
              }

              const isCompleted = (result.status === 'completed' || result.status === 'ready') &&
                result.data !== undefined &&
                result.data !== null;

              resolve({ completed: isCompleted, blocked: false });
            };

            getRequest.onerror = (error) => {
              console.error(`[IndexedDAG] Error getting dependency ${depId}:`, error);
              reject(error);
            };
          };
        } else {
          // No settings store - check as regular dependency
          const getRequest = resultsStore.get(depId);

          getRequest.onsuccess = async () => {
            let result = getRequest.result;

            if (!result) {
              resolve({ completed: false, blocked: false });
              return;
            }

            // CRITICAL: Reassemble chunks if this is a partitioned file
            result = await reassembleChunks(result, resultsStore);

            if (result.status === 'error' || result.status === 'terminated' || result.status === 'failed') {
              resolve({ completed: false, blocked: true, reason: result.status });
              return;
            }

            const isCompleted = (result.status === 'completed' || result.status === 'ready') &&
              result.data !== undefined &&
              result.data !== null;

            resolve({ completed: isCompleted, blocked: false });
          };

          getRequest.onerror = (error) => {
            console.error(`[IndexedDAG] Error getting dependency ${depId}:`, error);
            reject(error);
          };
        }

        transaction.oncomplete = () => {
          db.close();
        };
      };

      request.onerror = (error) => {
        console.error('Error opening database:', error);
        reject(error);
      };
    });
  };

  // Check if dependencies are completed
  // Returns: { canRun: boolean, blockedDeps: Array<{depId, reason}> }
  const canExecute = async (funcIndex) => {
    if (!dependencies[funcIndex] ||
      dependencies[funcIndex].length === 0) {
      return { canRun: true, blockedDeps: [] };
    }

    try {
      const deps = dependencies[funcIndex];
      const depIds = dataIds[funcIndex];
      // console.log(`[IndexedDAG] Checking dependencies for function ${funcIndex}`, depIds);

      // CRITICAL: Filter out invalid dependency IDs (-1 or undefined)
      const validDepIds = depIds.filter((depId, index) => {
        if (!depId || depId === -1 || depId === '-1') {
          return false;
        }
        return true;
      });

      if (validDepIds.length === 0 && depIds.length > 0) {
        console.error(`[IndexedDAG] All dependency IDs are invalid for function ${funcIndex}`);
        return { canRun: false, blockedDeps: [] };
      }

      const depStatuses = await Promise.all(
        validDepIds.map(async (depId) => {
          try {
            const status = await checkDependencyStatus(depId);
            return { depId, ...status };
          } catch (error) {
            console.error(`[IndexedDAG] Error checking dependency ${depId}:`, error);
            return { depId, completed: false, blocked: false };
          }
        })
      );

      const allCompleted = depStatuses.every(status => status.completed === true);
      const blockedDeps = depStatuses.filter(status => status.blocked === true);

      const canRun = allCompleted && blockedDeps.length === 0;

      // Only log errors or blocked dependencies
      if (blockedDeps.length > 0) {
        console.error(`[IndexedDAG] Function ${funcIndex} blocked by failed dependencies:`, blockedDeps.map(d => `${d.depId} (${d.reason})`).join(', '));
      } blockedDeps.length > 0 ? `(blocked by: ${blockedDeps.map(d => d.depId).join(', ')})` : '';

      return { canRun, blockedDeps };
    } catch (error) {
      console.error(`Error checking dependencies for function ${funcIndex}:`, error);
      return { canRun: false, blockedDeps: [] };
    }
  };

  const getExecutionContext = (funcIndex) => {
    const func = functions[funcIndex];
    // func can be a string (ID/name) or an object (metadata)

    if (typeof func === 'string') {
      return {
        funcName: func, // Pass string directly, worker knows how to handle it
        uniqueId: func, // Use name as ID
        dependencies: dataIds[funcIndex],
        dbConfig,
        type
      };
    }

    return {
      funcName: {
        func: func.func,
        module: func.module,
        component: func.component,
        params: func.params,
        args: func.args,
        id: func.id,
        functionName: func.functionName
      },
      uniqueId: func.id,
      dependencies: dataIds[funcIndex],
      dbConfig,
      type
    };
  };

  return {
    canExecute,
    getExecutionContext,
    totalCount: functions.length
  };
}

/**
 * @method dataCloner
 * @memberof globalUtils
 * @description Deep clones either objects or arrays
 * @param {Object} data - array or object
 * @returns {Object} deep cloned object or array to be used
 * @example
 * const arr = [1, 2, 3, [4, 5]];
 * const clonedArr = dataCloner(arr);
 */

export const dataCloner = (data) => {
  //Deep copy of array data using recursion
  const arrayCloner = (arr) => {
    if (arr instanceof Float32Array) {
      return arr;
    }
    if (Array.isArray(arr[0])) {
      const clonedArr = new Array(arr.length);
      for (let i = 0; i < arr.length; i++) {
        clonedArr[i] = new Float32Array(arrayCloner(arr[i]));
      }
      return clonedArr;
    } else {
      return new Float32Array(arr);
    }
  };

  const objectCloner = (inObject) => {
    let tempOb = {};

    for (let [key, value] of Object.entries(inObject)) {
      if (Array.isArray(value)) {
        tempOb[key] = arrayCloner(value);
      } else {
        if (typeof value === "object") {
          tempOb[key] = objectCloner(value);
        } else {
          tempOb[key] = value;
        }
      }
    }
    return tempOb;
  };

  try {
    if (Array.isArray(data)) {
      let stgD = arrayCloner(data);
      return flattenFloat32Array(stgD);
    } else {
      return objectCloner(data);
    }
  } catch (error) {
    return console.error(
      `There was an error cloning the data. More info: `,
      error
    );
  }
};

/**
 * @method arrayChanger
 * @memberof globalUtils
 * @description switches the rows/columns of an array
 *
 */

export const arrayChanger = (arr, width) =>
  arr.reduce(
    (rows, key, index) =>
      (index % width == 0
        ? rows.push([key])
        : rows[rows.length - 1].push(key)) && rows,
    []
  );

/**
 * Helper function for concatenating arrays.
 * @method concatArrays
 * @memberof globalUtils
 * @param {Array} arrays - collection of arrays to concatenate
 * @returns {Array} array - concatenated array
 */

export const concatArrays = (arrays) => {
  if (arrays.length === 1) {
    return arrays[0];
  }

  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const finalArray = new Float32Array(totalLength);

  let offset = 0;
  for (let i = 0; i < arrays.length; i++) {
    finalArray.set(arrays[i], offset);
    offset += arrays[i].length;
  }

  return finalArray;
};

/**
 * Helper function for flatennizing a 2D array
 * @method flattenFloat32Array
 * @memberof globalUtils
 * @param {Array} arr  - N-D array to be flattened
 * @returns {Array} flattenized ND array
 */
export const flattenFloat32Array = (arr) => {
  if (typeof arr[0] !== "object") return arr;
  let flatArray = [];
  arr.forEach(function (subArray) {
    flatArray = flatArray.concat(Array.from(subArray));
  });
  return new Float32Array(flatArray);
};

/**
 * Retrieves the performance measures for function execution and worker execution.
 * @method getPerformanceMeasures
 * @memberof globalUtils
 * @returns {object} - The performance measures.
 * @property {number} funcExec - The duration of function execution.
 * @property {number} workerExec - The duration of worker execution.
 * @returns {Object} object containing execution times for both script and function exeuctions.
 */
export const getPerformanceMeasures = () => {
  return {
    funcExec: performance.measure(
      "measure-execution",
      "start-function",
      "end-function"
    ).duration,
    workerExec: performance.measure(
      "measure-execution",
      "start-script",
      "end-script"
    ).duration,
  };
};

/**
 * Imports JSON data from a file.
 * @method importJSONdata
 * @memberof globalUtils
 * @param {string} jsonFile - The path or URL to the JSON file.
 * @param {string} [dataFieldName="data"] - The name of the field containing the data in the JSON file.
 * @returns {Promise<*>} - A promise that resolves to the imported data.
 */
export const importJSONdata = async (jsonFile, dataFieldName = "data") => {
  const response = await fetch(`${jsonFile}.json`);
  const json = await response.json();
  const data = json[dataFieldName];
  return data;
};
