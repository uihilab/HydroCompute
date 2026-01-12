import { getPerformanceMeasures } from "../core/utils/globalUtils.js";
import { openDatabase } from "../core/utils/db-config.js";
import {
    verifyDatabaseAccess,
    getDataFromIndexedDB,
    storeResultInIndexedDB,
    prepareDataForStorage
} from "../core/utils/db-utils.js";

// WebR instance
let webRInstance = null;

// Helper to determine if we are in a worker context
const isWorker = typeof importScripts === "function";
console.log('[R Worker] Worker loaded successfully.');


/**
 * Initialize WebR instance
 * @returns {Promise} WebR instance
 */
async function getWebR() {
    if (!webRInstance) {
        console.log('Loading WebR in worker...');
        try {
            // Import WebR dynamically
            const { WebR } = await import('https://webr.r-wasm.org/v0.3.3/webr.mjs');

            const webR = new WebR({
                // interactive: false 
            });

            await webR.init();
            console.log('WebR loaded successfully');
            webRInstance = webR;
        } catch (error) {
            console.error('Error loading WebR:', error);
            throw new Error(`Failed to load WebR: ${error.message}`);
        }
    }
    return webRInstance;
}

/**
 * Install and load R packages
 * @param {Array<string>} packages - List of package names
 * @param {Object} webR - WebR instance
 */
async function loadRPackages(packages, webR) {
    if (!packages || packages.length === 0) return;

    console.log(`Loading R packages: ${packages.join(', ')}`);

    // Mount the implementation of install.packages (uses webr repo)
    await webR.installPackages(packages);

    // Load them using library()
    for (const pkg of packages) {
        try {
            await webR.evalR(`library(${pkg})`);
            console.log(`Library ${pkg} loaded.`);
        } catch (e) {
            console.error(`Failed to load library ${pkg}:`, e);
            throw e;
        }
    }
}

/**
 * Convert JavaScript data to R objects and bind them to the global environment
 * @param {any} jsData - JavaScript data
 * @param {string} bindName - Name of the variable in R
 * @param {Object} webR - WebR instance
 */
async function bindJsToR(jsData, bindName, webR) {
    try {
        console.log(`Binding JS data to R variable '${bindName}'...`, {
            type: typeof jsData,
            isArray: Array.isArray(jsData),
            constructor: jsData?.constructor?.name
        });

        // 1. TypedArrays (Efficient Direct Binding)
        // WebR supports creating R objects directly from TypedArrays
        if (jsData instanceof Float32Array || jsData instanceof Float64Array) {
            // Treat as double vector
            // webR.RObject can wrap these or we can use specific constructors
            // Current WebR API favors: new webR.toJs or binding via shelter?
            // Simplest robust way: 
            await webR.objs.globalEnv.bind(bindName, jsData);
        }
        else if (jsData instanceof Int32Array || jsData instanceof Int16Array || jsData instanceof Int8Array) {
            // Treat as integer vector
            await webR.objs.globalEnv.bind(bindName, jsData);
        }
        else if (jsData instanceof Uint8Array || jsData instanceof Uint16Array || jsData instanceof Uint32Array) {
            // Treat as integer/double vector depending on precision, usually double safe
            await webR.objs.globalEnv.bind(bindName, jsData);
        }
        // 2. Standard Arrays (Numeric/String/Boolean)
        else if (Array.isArray(jsData)) {
            // Check content type briefly
            if (jsData.length > 0 && typeof jsData[0] === 'number') {
                // Numeric array
                await webR.objs.globalEnv.bind(bindName, jsData);
            } else if (jsData.length > 0 && typeof jsData[0] === 'string') {
                // String array
                await webR.objs.globalEnv.bind(bindName, jsData);
            } else {
                // Mixed or objects -> pass as generic binding
                await webR.objs.globalEnv.bind(bindName, jsData);
            }
        }
        // 3. Objects (DataFrames / Lists)
        else if (typeof jsData === 'object' && jsData !== null) {
            // Bind as Named List (equivalent to JS Object)
            await webR.objs.globalEnv.bind(bindName, jsData);
        }
        // 4. Primitives
        else {
            await webR.objs.globalEnv.bind(bindName, jsData);
        }

        console.log(`Successfully bound '${bindName}'`);

    } catch (error) {
        console.error(`Error binding data to R variable '${bindName}':`, error);
        throw error;
    }
}

/**
 * Helper to convert Array of Objects (Row-oriented) to Object of Arrays (Columnar)
 * @param {Array} data - Input array of objects
 * @returns {Object} Columnar data
 */
function toColumnar(data) {
    if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== 'object' || data[0] === null) {
        return data;
    }

    const keys = Object.keys(data[0]);
    const columnarData = {};

    // Initialize arrays for each key
    keys.forEach(key => {
        columnarData[key] = [];
    });

    // Populate arrays
    for (const row of data) {
        for (const key of keys) {
            columnarData[key].push(row[key]);
        }
    }

    console.log(`[R Worker] Converted ${data.length} rows to columnar format:`, keys);
    return columnarData;
}

/**
 * Handle dependency retrieval with Reference Item support (mirroring Python worker)
 * @param {string} depId - Dependency ID
 * @param {Object} dbConfig - Database configuration
 * @returns {Promise<any>} The actual data
 */
async function resolveDependency(depId, dbConfig) {
    let actualDataId = depId;
    const dbName = dbConfig.database || 'hydrocomputeDB';
    const storeName = dbConfig.storeName || 'results';

    try {
        const db = await openDatabase(dbName);

        // Check if it is a reference item in 'settings'
        if (db.objectStoreNames.contains('settings')) {
            const transaction = db.transaction(['settings'], 'readonly');
            const settingsStore = transaction.objectStore('settings');

            const settings = await new Promise((resolve) => {
                const req = settingsStore.get(depId);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
            });

            if (settings && (settings.isReference === true || settings.parameters?.source === 'database')) {
                const refId = settings.arguments?.referenceId ||
                    settings.referenceData?.id ||
                    settings.parameters?.referenceId;
                if (refId) {
                    console.log(`Dependency ${depId} is a reference to ${refId}`);
                    actualDataId = refId;
                }
            }
        }
        db.close();
    } catch (e) {
        console.warn(`Error resolving references for ${depId}, using ID as-is.`, e);
    }

    const result = await getDataFromIndexedDB(dbName, storeName, actualDataId);

    if (!result) return null;

    // Return .data if it exists (standard wrap), else result itself
    return (result.data !== undefined) ? result.data : result;
}


/**
 * @description WebR Worker Message Handler
 * Executes R scripts using WebR by evaluating code retrieved from IndexedDB.
 * 
 * Workflow:
 * 1. Receives execution context (funcName, uniqueId, dependencies).
 * 2. Resolves dependencies from IndexedDB (handling Reference Items).
 * 3. Initializes WebR (if not already loaded).
 * 4. Loads required R packages defined in settings.
 * 5. Binds resolved data to the R global environment (as `data_input`).
 * 6. Executes the R code using `webR.evalR`.
 * 7. Captures the result, converts it to JavaScript, and stores it in IndexedDB.
 * 8. Sends completion message and performance metrics back to the main thread.
 * 
 * @param {MessageEvent} e - The message event containing execution details.
 * @param {Object} e.data - The execution data object.
 * @param {string|Object} e.data.funcName - The function/script identifier.
 * @param {string} e.data.uniqueId - Unique ID for the task/result.
 * @param {Array<string>} e.data.dependencies - List of data IDs to load.
 * @param {Object} e.data.dbConfig - Database configuration (database, storeName).
 */
self.onmessage = async (e) => {
    console.log('[R Worker] Message received:', e.data);
    const executionData = e.data;
    performance.mark("start-script");

    // Extract uniqueId - can be direct, nested in funcName, or just funcName string
    const uniqueId = executionData.uniqueId ||
        ((executionData.funcName && executionData.funcName.id) ? executionData.funcName.id :
            (typeof executionData.funcName === 'string' ? executionData.funcName : null));

    // Dependencies resolution logic
    let dependencies = executionData.dependencies || [];
    if ((!dependencies || dependencies.length === 0) && executionData.dataIds) {
        // If dataIds is present, use it as dependencies
        // If it's a list, use it. If nested?
        if (Array.isArray(executionData.dataIds)) {
            // Check if it's a list of lists (split data) or simple list of IDs
            if (Array.isArray(executionData.dataIds[0])) {
                dependencies = executionData.dataIds[0];
            } else {
                dependencies = executionData.dataIds;
            }
        } else {
            dependencies = [executionData.dataIds];
        }
    }

    const dbConfig = executionData.dbConfig;
    const funcName = executionData.funcName;
    const id = executionData.id;
    const step = executionData.step;
    const data = executionData.data; // Direct data passing?

    self.postMessage({
        type: 'status',
        itemId: uniqueId,
        status: 'running'
    });

    let result = null;

    try {
        const dbName = dbConfig?.database || 'hydrocomputeDB';

        // 1. Retrieve R Code & Settings
        let rCode = null;
        let requiredPackages = [];
        let scriptId = null;

        if (funcName) {
            scriptId = (typeof funcName === 'string') ? funcName :
                (funcName.id || funcName.name || funcName.functionName);
        }

        console.log(`Script Lookup - funcName:`, funcName, `extracted scriptId:`, scriptId, `uniqueId:`, uniqueId);
        // Fallback to uniqueId if strict mapping implies uniqueId IS the script ID (unlikely for new runs)
        // But for stored tasks, uniqueId might be relevant. Check scriptId first.

        const lookupId = scriptId || uniqueId;

        if (lookupId) {
            try {
                const db = await openDatabase(dbName);
                const settingsStore = db.transaction('settings', 'readonly').objectStore('settings');
                const settings = await new Promise((resolve, reject) => {
                    const req = settingsStore.get(lookupId);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
                db.close();

                if (settings) {
                    if (settings.code) rCode = settings.code;
                    if (settings.libraries) {
                        requiredPackages = Array.isArray(settings.libraries) ? settings.libraries : [settings.libraries];
                    }
                    // Handle mixed library formats (strings, objects?)
                    requiredPackages = requiredPackages.map(p => (typeof p === 'string' ? p : p.name || p.toString()));
                }
            } catch (err) {
                console.warn('Could not retrieve settings/code from DB:', err);
            }
        }

        // 2. Retrieve Data (Dependencies)
        let dataInputs = [];
        if (dependencies && dependencies.length > 0) {
            // Ensure dependencies is an array
            if (!Array.isArray(dependencies)) {
                // If it's a string, wrap it. Spreading string is BAD for IDs.
                dependencies = [dependencies];
            }
            console.log(`Resolving ${dependencies.length} dependencies:`, dependencies);

            dataInputs = await Promise.all(
                dependencies.map(depId => resolveDependency(depId, dbConfig))
            );
            // Validate
            if (dataInputs.some(d => d === null || d === undefined)) {
                throw new Error("One or more dependencies could not be resolved.");
            }
        } else if (data) {
            // Support direct data injection if not DB-based
            dataInputs = Array.isArray(data) ? data : [data];
        }

        // 3. Initialize WebR
        performance.mark("start-function");
        const webR = await getWebR();

        // 4. Install Packages
        if (requiredPackages.length > 0) {
            await loadRPackages(requiredPackages, webR);
        }

        // 5. Bind Data Inputs
        // Determine binding strategy.
        // If 1 input: bind as 'data'
        // If >1 input: bind as 'data1', 'data2'... OR a list 'data'
        // Following Python worker pattern: usually 'data_input' contains the list of inputs
        // Let's bind 'data_input' as a list if multiple, or just the object if single.

        // Actually, consistency with Python worker (which typically passes 'data_input' as list)
        // We will bind 'data_input' as a LIST in R.

        const shelter = await new webR.Shelter();

        // Bind individual items first? No, bind the array directly if possible.
        // WebR JS binding handles arrays well.
        // We want `data_input` in R to be a list where `data_input[[1]]` is the first dep.

        // Preprocess dependencies: Convert Array-of-Objects to Columnar
        console.log('[R Worker] Inspecting dataInputs for conversion:',
            dataInputs.map(d => ({
                isArray: Array.isArray(d),
                length: d?.length,
                firstItemType: typeof d?.[0],
                firstItemIsObject: typeof d?.[0] === 'object',
                firstItemKeys: (d?.[0] && typeof d?.[0] === 'object') ? Object.keys(d[0]) : null
            }))
        );

        const processedInputs = dataInputs.map(dep => {
            // Check if it's an array of objects
            if (Array.isArray(dep) && dep.length > 0 && typeof dep[0] === 'object' && dep[0] !== null) {
                return toColumnar(dep);
            }
            return dep;
        });

        console.log('[R Worker] Final binding data structure:', JSON.stringify(processedInputs));
        await bindJsToR(processedInputs, 'data_input', webR);

        // 6. Execute R Code
        if (rCode) {
            console.log("Executing R Code...");
            // Ensure R code uses 'data_input'
            // Wrap execution in captureR
            // We expect the script to either return the result directly or assign to 'result' or something?
            // Python worker assumes the script returns something or we parse stdout? 
            // Actually Python settings usually have the return value handling or last expression.

            // We'll capture the return value of the code block.
            // Using evalR instead of captureR to ensure we get an RObject
            const resultRObj = await webR.evalR(rCode, {
                env: webR.objs.globalEnv,
                bind: { data_input: 'data_input' } // Explicit binding if supported or relies on globalEnv?
                // bindJsToR already put it in globalEnv? 
                // bindJsToR likely did `webR.objs.globalEnv.bind("data_input", ...)`
            });

            console.log("R Evaluation Result Object:", resultRObj);

            // Convert back to JS
            try {
                result = await resultRObj.toJs();
            } catch (e) {
                console.warn("toJs() failed, trying values/toArray?", e);
                result = resultRObj; // Fallback
            }

            // Clean up? If we used webR.evalR, we assume we might need to free it?
            // If we used a shelter content, we should use shelter.
        } else {
            throw new Error("No R code provided.");
        }

        // 7. Store Result
        if (dbConfig && dbConfig.storeName && result !== null && uniqueId) {
            const serializableData = await prepareDataForStorage(result);
            await storeResultInIndexedDB(dbConfig.database, dbConfig.storeName, {
                id: uniqueId,
                data: serializableData,
                status: 'completed',
                timestamp: new Date().toISOString()
            });
        }

        shelter.purge();

        // 8. Send Completion
        self.postMessage({
            type: 'status',
            itemId: uniqueId,
            status: 'completed'
        });

        performance.mark("end-function");
        performance.mark("end-script");
        const getPerformance = getPerformanceMeasures();

        self.postMessage({
            id,
            status: 'completed',
            step,
            funcName: funcName ? (funcName.path || funcName) : null,
            results: result,
            ...getPerformance
        });

    } catch (error) {
        console.error('Error executing R function:', error);
        if (uniqueId) {
            self.postMessage({
                type: 'status',
                itemId: uniqueId,
                status: 'error',
                error: error.message
            });
        }
        throw error;
    }
};
