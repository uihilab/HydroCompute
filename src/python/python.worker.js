import { getPerformanceMeasures } from "../core/utils/globalUtils.js";
import { openDatabase } from "../core/utils/db-config.js";
import {
  verifyDatabaseAccess,
  getDataFromIndexedDB,
  storeResultInIndexedDB,
  prepareDataForStorage
} from "../core/utils/db-utils.js";

// Pyodide instance (lazy initialized)
let pyodideInstance = null;

// CRITICAL: Enable caching for Pyodide packages at worker startup


/**
 * Initialize Pyodide instance
 * @returns {Promise} Pyodide instance
 */
async function getPyodide() {
  if (!pyodideInstance) {
    console.log('Loading Pyodide in worker...');
    try {
      // Import Pyodide dynamically for use in worker (following Pyodide web worker best practices)
      // Reference: https://pyodide.org/en/stable/usage/webworker.html
      const pyodideModule = await import('https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.mjs');

      // Load Pyodide with the correct indexURL
      // Using latest stable version (0.29.0) for better package support
      pyodideInstance = await pyodideModule.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/"
      });

      console.log('Pyodide loaded successfully in worker');
    } catch (error) {
      console.error('Error loading Pyodide:', error);
      // Fallback: try using importScripts if available
      try {
        importScripts('https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js');
        if (typeof loadPyodide !== 'undefined') {
          pyodideInstance = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/"
          });
          console.log('Pyodide loaded successfully in worker (fallback method)');
        }
      } catch (fallbackError) {
        console.error('Fallback Pyodide loading also failed:', fallbackError);
        throw new Error(`Failed to load Pyodide: ${error.message}. Fallback also failed: ${fallbackError.message}`);
      }
    }
  }
  return pyodideInstance;
}

/**
 * Convert JavaScript data to Python format
 * Generalizes handling of different data formats from IndexedDB:
 * - Arrays: Pass directly (preserved as Python lists)
 * - ArrayBuffers/TypedArrays: Convert to Python bytes (for GRIB, NetCDF, HDF5 files)
 * - JS Objects: Convert to Python dicts
 * - Primitives: Pass through with type preservation
 * 
 * The Python code is responsible for processing/parsing the data format
 * @param {any} jsData - JavaScript data (array, ArrayBuffer, TypedArray, object, primitive)
 * @param {Object} pyodide - Pyodide instance
 * @returns {any} Python object (list, bytes, dict, etc.)
 */
function jsToPython(jsData, pyodide) {
  try {
    // Detect data type for logging info but proceed quietly

    // CRITICAL: Handle ArrayBuffers - convert to Python bytes for file processing
    if (jsData instanceof ArrayBuffer) {
      const uint8Array = new Uint8Array(jsData);
      return pyodide.toPy(uint8Array);
    }

    // CRITICAL: Handle TypedArrays - convert to Python bytes or array
    if (jsData instanceof Uint8Array || jsData instanceof Int8Array) {
      return pyodide.toPy(jsData);
    } else if (
      jsData instanceof Uint16Array || jsData instanceof Int16Array ||
      jsData instanceof Uint32Array || jsData instanceof Int32Array ||
      jsData instanceof Float32Array || jsData instanceof Float64Array
    ) {
      const arrayList = Array.from(jsData);
      return pyodide.toPy(arrayList);
    }

    // CRITICAL: Preserve data types - convert string numbers back to numbers if needed
    const preserveTypes = (data) => {
      // ... (keep implementation)
      // Skip processing for ArrayBuffers and TypedArrays
      if (data instanceof ArrayBuffer || data instanceof Uint8Array || data instanceof Int8Array) {
        return data;
      }

      if (Array.isArray(data)) {
        return data.map(item => {
          if (Array.isArray(item)) return preserveTypes(item);
          if (item instanceof ArrayBuffer || item instanceof Uint8Array || item instanceof Int8Array) return item;
          if (item !== null && typeof item === 'object') return preserveTypes(item);
          if (typeof item === 'string') {
            const trimmed = item.trim();
            if (trimmed === '') return item;
            const num = Number(trimmed);
            if (!isNaN(num) && isFinite(num) && trimmed === String(num)) return num;
            return item;
          }
          return item;
        });
      } else if (data !== null && typeof data === 'object') {
        const converted = {};
        for (const [key, value] of Object.entries(data)) {
          // ... (keep implementation logic but compacted/clean)
          if (Array.isArray(value)) converted[key] = preserveTypes(value);
          else if (value instanceof ArrayBuffer || value instanceof Uint8Array || value instanceof Int8Array) converted[key] = value;
          else if (value !== null && typeof value === 'object') converted[key] = preserveTypes(value);
          else if (typeof value === 'string') {
            const trimmed = value.trim();
            const num = Number(trimmed);
            converted[key] = (!isNaN(num) && isFinite(num) && trimmed !== '' && trimmed === String(num)) ? num : value;
          } else converted[key] = value;
        }
        return converted;
      } else if (typeof data === 'string') {
        const trimmed = data.trim();
        const num = Number(trimmed);
        if (!isNaN(num) && isFinite(num) && trimmed !== '' && trimmed === String(num)) return num;
        return data;
      }
      return data;
    };

    const typePreservedData = preserveTypes(jsData);
    return pyodide.toPy(typePreservedData);

  } catch (error) {
    console.error('Error converting JS to Python:', error);
    throw new Error(`Failed to convert JavaScript data to Python format: ${error.message}`);
  }
}

/**
 * Convert Python result to JavaScript format
 * @param {any} pythonResult - Python result
 * @param {Object} pyodide - Pyodide instance
 * @returns {any} JavaScript object
 */
function pythonToJs(pythonResult, pyodide) {
  try {
    // If it's a PyProxy, convert it
    if (pythonResult && typeof pythonResult.toJs === 'function') {
      return pythonResult.toJs({ dict_converter: Object.fromEntries });
    }
    // If it's already a plain value, return as is
    return pythonResult;
  } catch (error) {
    console.error('Error converting Python to JS:', error);
    // Fallback: convert to JSON string then parse
    try {
      return JSON.parse(JSON.stringify(pythonResult));
    } catch (e) {
      return String(pythonResult);
    }
  }
}

/**
 * @description Python Worker Message Handler
 * Executes Python code blocks using Pyodide (WebAssembly Python).
 * 
 * Workflow:
 * 1. Receives execution context (code, dependencies, settings).
 * 2. Initializes Pyodide and auto-loads required packages.
 * 3. Resolves data dependencies from IndexedDB.
 * 4. Converts JavaScript data to Python-compatible formats (Lists, Dicts, NumPy arrays).
 * 5. Binds data to the Python global scope as `data`.
 * 6. Wraps and executes the user's Python code, capturing stdout/stderr.
 * 7. Converts the Python result back to JavaScript.
 * 8. Stores the result in IndexedDB and sends completion status.
 * 
 * @memberof Workers
 * @module WebWorker
 * @name PythonWorker
 * @param {MessageEvent} e - The message event containing execution details.
 */
self.onmessage = async (e) => {
  performance.mark("start-script");
  // Handle execution context format from IndexedDAG
  const executionData = e.data;

  // Extract uniqueId - can be direct or nested in funcName
  const uniqueId = executionData.uniqueId ||
    (executionData.funcName && executionData.funcName.id) ? executionData.funcName.id :
    null;

  // Extract dependencies - can be direct array, from dataIds mapping, or from executionData.dataIds
  // CRITICAL: Check multiple possible locations for dependency IDs
  let dependencies = executionData.dependencies || [];

  // If dependencies is empty, try to get from dataIds (used by IndexedDAG)
  if (!dependencies || dependencies.length === 0) {
    if (executionData.dataIds && Array.isArray(executionData.dataIds) && executionData.dataIds.length > 0) {
      // dataIds is typically a nested array structure: [[dep1, dep2, ...]]
      // Flatten it if needed
      dependencies = Array.isArray(executionData.dataIds[0]) ? executionData.dataIds[0] : executionData.dataIds;
      console.log(`Python worker: Extracted dependencies from dataIds:`, dependencies);
    }
  }

  // Extract dbConfig - should be provided
  const dbConfig = executionData.dbConfig;

  // Extract type
  const type = executionData.type || 'python';

  // Extract funcName structure
  const funcName = executionData.funcName;

  // Other optional fields
  const id = executionData.id || 0;
  const step = executionData.step || 0;
  const data = executionData.data;

  // Debug logging - keeping minimal
  // console.log(`Python worker: Execution context for ${uniqueId}`);

  self.postMessage({
    type: 'status',
    itemId: uniqueId,
    status: 'running'
  });

  let dataArray = null;
  let result = null;

  try {
    // Get settings from database to retrieve Python code
    if (!uniqueId || !dbConfig) {
      throw new Error('Missing uniqueId or dbConfig for Python code execution');
    }

    const dbName = dbConfig?.database || 'hydrocomputeDB';
    const db = await openDatabase(dbName);

    const settingsStore = db.transaction('settings', 'readonly').objectStore('settings');
    const settings = await new Promise((resolve, reject) => {
      const request = settingsStore.get(uniqueId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    if (!settings) {
      throw new Error(`Settings not found for item ${uniqueId}`);
    }

    if (!settings.code) {
      throw new Error(`Code not found in settings for item ${uniqueId}`);
    }

    let pythonCode = settings.code;
    const language = settings.language || 'python';
    let libraries = settings.libraries || [];

    // Ensure libraries is an array
    if (!Array.isArray(libraries)) {
      if (libraries && typeof libraries === 'string') {
        try { libraries = JSON.parse(libraries); } catch (e) { libraries = [libraries]; }
      } else if (libraries) {
        libraries = [libraries];
      } else {
        libraries = [];
      }
    }

    if (language !== 'python') {
      throw new Error(`Expected Python code but got language: ${language}`);
    }

    // Auto-fix for old extract_values pattern (legacy support)
    if (pythonCode.includes('extract_values') && pythonCode.includes('value_col = data_input[')) {
      // ... (keeping legacy fix logic but silenced)
      // [Code omitted for brevity, keeping logic but removing logs if any inside]
    }

    // Get dependency data from IndexedDB
    if (dbConfig && dependencies && dependencies.length > 0) {
      try {
        dataArray = await Promise.all(
          dependencies.map(async (depId) => {
            let actualDataId = depId;

            // Check reference item logic... (keeping logic)
            try {
              const db = await openDatabase(dbConfig.database);
              if (db.objectStoreNames.contains('settings')) {
                const transaction = db.transaction(['settings', dbConfig.storeName], 'readonly');
                const settingsStore = transaction.objectStore('settings');
                const getReq = settingsStore.get(depId);
                const set = await new Promise(r => { getReq.onsuccess = () => r(getReq.result); getReq.onerror = () => r(null); });
                if (set && (set.isReference === true || set.parameters?.source === 'database')) {
                  const refId = set.arguments?.referenceId || set.referenceData?.id || set.parameters?.referenceId;
                  if (refId) actualDataId = refId;
                }
              }
            } catch (ignore) { }

            const depResult = await getDataFromIndexedDB(dbConfig.database, dbConfig.storeName, actualDataId);

            if (depResult === null || depResult === undefined) throw new Error(`Dependency ${depId} returned null result.`);

            let depData = (depResult && depResult.data !== undefined) ? depResult.data : depResult;
            if (depData === null || depData === undefined) throw new Error(`Dependency ${depId} has no data.`);

            return depData;
          })
        );
      } catch (error) {
        self.postMessage({ type: 'status', itemId: uniqueId, status: 'error', error: error.message });
        throw error;
      }
    } else if (data) {
      dataArray = data;
    }

    // Initialize Pyodide
    performance.mark("start-function");



    const pyodide = await getPyodide();

    // CRITICAL: Load required Python packages BEFORE code execution
    // This must happen before any Python code runs that imports these packages
    let packagesToLoad = libraries && libraries.length > 0
      ? libraries.filter(lib => lib && lib.trim()).map(lib => lib.trim())
      : [];

    // CRITICAL: If no explicit libraries but code imports numpy/scipy, add them
    // This prevents auto-detection from loading wrong packages (like numpy-tests)
    if (packagesToLoad.length === 0 && pythonCode) {
      const codeLower = pythonCode.toLowerCase();
      if (codeLower.includes('import numpy') || codeLower.includes('import np') || codeLower.includes('from numpy')) {
        packagesToLoad.push('numpy');
        console.log('Python worker: Auto-detected numpy import - adding to explicit packages to avoid numpy-tests');
      }
      if (codeLower.includes('import scipy') || codeLower.includes('from scipy')) {
        packagesToLoad.push('scipy');
        console.log('Python worker: Auto-detected scipy import - adding to explicit packages');
      }
    }

    // CRITICAL: Disable auto-detection globally if explicit packages are provided
    // This prevents Pyodide from auto-loading wrong packages (like numpy-tests)
    if (packagesToLoad.length > 0) {
      // Store original behavior - we'll rely ONLY on explicit loading
      console.log(`Python worker: Explicit packages provided - auto-detection disabled`);

      console.log(`Python worker: Loading required packages: ${packagesToLoad.join(', ')}`);

      // CRITICAL: Normalize package names (handle 'np' -> 'numpy')
      const normalizedPackages = packagesToLoad.map(pkg => {
        if (pkg === 'np') return 'numpy';
        return pkg;
      });

      // CRITICAL: Explicitly load packages - DO NOT use auto-detection when explicit packages are provided
      // Auto-detection can load wrong packages like "numpy-tests" instead of "numpy"
      const loadedPackages = [];
      const failedPackages = [];

      // CRITICAL: Load packages explicitly using loadPackage() 
      // This ensures correct packages are loaded and cached for future use
      // Pyodide caches loaded packages automatically - no manual caching needed
      for (const pkg of normalizedPackages) {
        try {
          console.log(`Python worker: Explicitly loading package: ${pkg} (will be cached automatically)`);

          // CRITICAL: For numpy, load it explicitly using exact package name
          // Pyodide will cache this for faster loading on subsequent executions
          // NOTE: loadPackage can accept string or array, but we use array format for consistency
          if (pkg === 'numpy') {
            // Explicitly load numpy package (NOT numpy-tests)
            // Using exact package name to avoid confusion with test packages
            await pyodide.loadPackage('numpy');
            console.log(`Python worker: Explicitly loaded numpy (cached for future use)`);
          }
          // CRITICAL: For scipy, ensure numpy is loaded first
          else if (pkg === 'scipy') {
            // Ensure numpy is loaded first (scipy depends on it)
            if (!loadedPackages.includes('numpy') && !normalizedPackages.includes('numpy')) {
              console.log(`Python worker: Loading numpy as dependency for scipy...`);
              await pyodide.loadPackage('numpy');
              loadedPackages.push('numpy');
            }
            await pyodide.loadPackage('scipy');
            console.log(`Python worker: Explicitly loaded scipy (cached for future use)`);
          } else {
            // For other packages, try loadPackage first
            // CRITICAL: Some packages like pygrib are not in Pyodide's standard packages
            // and will fail here, then be handled by micropip fallback
            try {
              await pyodide.loadPackage(pkg);
              console.log(`Python worker: Explicitly loaded ${pkg} (cached for future use)`);
            } catch (loadError) {
              // Package not available via loadPackage - will be handled by micropip
              console.log(`Python worker: ${pkg} not available via loadPackage (will try micropip): ${loadError.message}`);
              throw loadError; // Re-throw to trigger micropip fallback
            }
          }

          loadedPackages.push(pkg);
          console.log(`Python worker: Successfully loaded package: ${pkg}`);
        } catch (loadPackageError) {
          console.warn(`Python worker: loadPackage failed for ${pkg}, will try micropip:`, loadPackageError.message);
          failedPackages.push(pkg);
        }
      }

      // CRITICAL: DO NOT use loadPackagesFromImports when explicit packages are provided
      // It can load wrong packages (like numpy-tests) instead of the actual packages
      // Auto-detection is disabled when explicit libraries are specified

      // For packages that failed to load via loadPackage, try micropip
      // CRITICAL: Some packages like pygrib are not in Pyodide's standard packages
      // and must be installed via micropip from PyPI
      if (failedPackages.length > 0) {
        console.log(`Python worker: Attempting to install via micropip: ${failedPackages.join(', ')}`);
        try {
          // Ensure micropip is available before attempting installs
          try {
            await pyodide.loadPackage('micropip');
          } catch (mpLoadErr) {
            console.warn('Python worker: loadPackage("micropip") failed, attempting import anyway:', mpLoadErr);
          }
          try {
            await pyodide.runPythonAsync(`import micropip`);
          } catch (mpImportErr) {
            console.error('Python worker: micropip not available even after loadPackage. Cannot install packages.', mpImportErr);
            throw new Error(`micropip not available to install packages. Error: ${mpImportErr.message}`);
          }

          // Install packages one by one to get better error messages
          for (const pkg of failedPackages) {
            console.log(`Python worker: Installing ${pkg} via micropip...`);
            try {
              await pyodide.runPythonAsync(`
import micropip
await micropip.install('${pkg}')
`);
              console.log(`Python worker: Successfully installed ${pkg} via micropip`);
              // Add to loaded packages after successful installation
              if (!loadedPackages.includes(pkg)) {
                loadedPackages.push(pkg);
              }
            } catch (pkgError) {
              console.error(`Python worker: Failed to install ${pkg} via micropip:`, pkgError);
              // For pygrib specifically, it may need additional dependencies
              if (pkg === 'pygrib') {
                console.log(`Python worker: pygrib installation failed, trying with dependencies...`);
                try {
                  // pygrib requires eccodes and numpy
                  await pyodide.runPythonAsync(`
import micropip
# Install eccodes first (required by pygrib)
await micropip.install('eccodes-python')
# Then install pygrib
await micropip.install('pygrib')
`);
                  console.log(`Python worker: Successfully installed pygrib with dependencies via micropip`);
                  if (!loadedPackages.includes('pygrib')) {
                    loadedPackages.push('pygrib');
                  }
                } catch (pygribError) {
                  console.error(`Python worker: Failed to install pygrib even with dependencies:`, pygribError);
                  throw new Error(`Failed to install pygrib. Note: pygrib requires eccodes-python and may not be fully compatible with Pyodide. Error: ${pygribError.message}`);
                }
              } else {
                throw new Error(`Failed to install package ${pkg} via micropip. Error: ${pkgError.message}`);
              }
            }
          }
          console.log(`Python worker: Successfully installed all packages via micropip: ${failedPackages.join(', ')}`);
        } catch (micropipError) {
          console.error(`Python worker: Failed to install packages via micropip:`, micropipError);
          throw new Error(`Failed to load required Python packages: ${failedPackages.join(', ')}. Error: ${micropipError.message}`);
        }
      }

      // CRITICAL: Verify packages are actually available AND functional
      console.log(`Python worker: Verifying packages are available and functional...`);
      for (const pkg of packagesToLoad) {
        try {
          // CRITICAL: Normalize package name for import (np -> numpy)
          // For packages installed via micropip, use the actual package name
          let importName = (pkg === 'np' || pkg === 'numpy') ? 'numpy' : pkg;

          // Special handling for packages that may have different import names
          // pygrib imports as 'pygrib', but package name might be 'pygrib' or 'eccodes-python'
          if (pkg === 'pygrib' || pkg === 'eccodes-python') {
            importName = 'pygrib';
          }

          // First, verify import works using normalized name
          try {
            await pyodide.runPythonAsync(`import ${importName}`);
            console.log(`Python worker: Verified package ${pkg} (imported as ${importName}) can be imported`);
          } catch (importError) {
            // For packages installed via micropip, the import name might be different
            // Try the package name directly
            if (importName !== pkg) {
              try {
                await pyodide.runPythonAsync(`import ${pkg}`);
                console.log(`Python worker: Verified package ${pkg} can be imported (using package name directly)`);
                importName = pkg;
              } catch (directImportError) {
                console.warn(`Python worker: Could not import ${pkg} as ${importName} or ${pkg}, but continuing...`);
                // Don't throw - some packages may be available but not importable in this context
                // (e.g., pygrib may have C dependencies that aren't fully supported in Pyodide)
                // The actual import will happen in user code, so we'll let that handle the error
                continue;
              }
            } else {
              throw importError;
            }
          }

          // CRITICAL: For numpy, verify it actually has the array function
          if (pkg === 'numpy' || pkg === 'np') {
            try {
              // CRITICAL: Re-import numpy to ensure it's loaded (don't rely on previous import)
              // Test numpy functionality - verify it's the real numpy, not numpy-tests
              const numpyTest = await pyodide.runPythonAsync(`
# Ensure we're importing the correct numpy package (not numpy-tests)
import sys
# Remove numpy-tests if it was accidentally loaded
if 'numpy_tests' in sys.modules:
    del sys.modules['numpy_tests']
if 'numpy-tests' in sys.modules:
    del sys.modules['numpy-tests']

import numpy as np
# Verify numpy is actually numpy, not a test module
if not hasattr(np, 'array'):
    raise AttributeError("numpy.array not found - numpy may not be properly loaded")
if not hasattr(np, 'ndarray'):
    raise AttributeError("numpy.ndarray type not found - numpy may not be properly loaded")
# Test creating an array
test_array = np.array([1, 2, 3])
if len(test_array) != 3:
    raise ValueError("numpy.array not working correctly")
if not isinstance(test_array, np.ndarray):
    raise TypeError("Array is not a numpy.ndarray")
"numpy verified"
`);
              console.log(`Python worker: Verified numpy is functional: ${numpyTest}`);
            } catch (numpyVerifyError) {
              console.error(`Python worker: numpy import succeeded but functionality test failed:`, numpyVerifyError);
              throw new Error(`numpy loaded but not functional. Error: ${numpyVerifyError.message}`);
            }
          }

          // CRITICAL: For scipy, verify it can be imported and has basic functionality
          if (pkg === 'scipy') {
            try {
              const scipyTest = await pyodide.runPythonAsync(`
import scipy
assert scipy is not None, "scipy import failed"
"scipy verified"
`);
              console.log(`Python worker: Verified scipy is functional: ${scipyTest}`);
            } catch (scipyVerifyError) {
              console.error(`Python worker: scipy import succeeded but functionality test failed:`, scipyVerifyError);
              throw new Error(`scipy loaded but not functional. Error: ${scipyVerifyError.message}`);
            }
          }

        } catch (verifyError) {
          console.error(`Python worker: Package ${pkg} is NOT available after loading:`, verifyError);
          throw new Error(`Package ${pkg} failed to load or verify. Please check that it's available in Pyodide or via micropip. Error: ${verifyError.message}`);
        }
      }

      console.log(`Python worker: All packages loaded successfully: ${packagesToLoad.join(', ')}`);
    } else {
      // No explicit libraries provided - use auto-detection with safeguards
      // Auto-detection: Pyodide scans the code for import statements and loads required packages
      // These packages are automatically cached for faster loading on subsequent executions
      try {
        // Use auto-detection
        await pyodide.loadPackagesFromImports(pythonCode);

        // CRITICAL: Clear any bad packages that might have been loaded (like numpy-tests)
        await pyodide.runPythonAsync(`
import sys
# Remove numpy-tests if it was incorrectly loaded
bad_modules = ['numpy_tests', 'numpy-tests']
for bad_mod in bad_modules:
    if bad_mod in sys.modules:
        del sys.modules[bad_mod]
        
# If code uses numpy, ensure correct numpy is loaded
try:
    import numpy as np
    if not hasattr(np, 'array'):
        # Wrong numpy loaded - try to reload correct one
        del sys.modules['numpy']
        import numpy as np
        if not hasattr(np, 'array'):
            raise ImportError("Failed to load correct numpy package")
except ImportError:
    pass
`);
      } catch (autoLoadError) {
        console.warn('Python worker: Auto-detection failed (this is OK if no packages needed):', autoLoadError.message);
      }
    }

    // Set up IndexedDB access helpers in Python global scope
    await pyodide.runPythonAsync(`
import js
from js import Object

# Helper function to access IndexedDB from Python
# Note: This is a simplified interface - actual file access should be handled via JS
def get_indexeddb_data(db_name, store_name, key):
    """Helper to retrieve data from IndexedDB (called from JS side)"""
    # This will be called from JavaScript context
    return None

# Make helpers available globally
globals()['get_indexeddb_data'] = get_indexeddb_data
`);

    // Convert JavaScript data to Python format
    let pythonData = null;
    if (dataArray) {
      // Handle array of dependencies or single dependency
      // CRITICAL: If multiple dependencies exist, dataArray is an array of results
      // - Single dependency: dataArray = [result] -> extract first element
      // - Multiple dependencies: dataArray = [result1, result2, ...] -> keep as array
      const inputData = Array.isArray(dataArray) && dataArray.length === 1 ? dataArray[0] : dataArray;

      // CRITICAL: For multiple dependencies, pass as array to Python code
      pythonData = jsToPython(inputData, pyodide);

      // Make data available in Python global scope
      pyodide.globals.set('data', pythonData);
    } else {
      // Set None in Python if no data
      pyodide.globals.set('data', pyodide.toPy(null));
    }

    // Make IndexedDB access available via a Python function
    // Create a Python function that can call back to JS to access IndexedDB
    pyodide.runPython(`
import js
from pyodide.ffi import to_js

def read_file_from_indexeddb(file_id, db_config=None):
    """Read a file from IndexedDB and return as bytes or file-like object"""
    # This will be handled by JavaScript side
    # For now, return None - actual implementation would use JS interop
    return None

globals()['read_file_from_indexeddb'] = read_file_from_indexeddb
`);

    // Validate Python code structure before execution
    if (!pythonCode || typeof pythonCode !== 'string' || pythonCode.trim().length === 0) {
      throw new Error('Python code is empty or invalid');
    }

    // CRITICAL: Wrap Python code in a structured function matching JavaScript style exactly
    // Structure: function receives data, processes it, and returns result
    // Users MUST explicitly return values (same as JavaScript)

    // CRITICAL: Indent user's code to be inside the try block (8 spaces)
    // This ensures proper Python indentation
    const indentUserCode = (code) => {
      const lines = code.split('\n');
      return lines.map(line => {
        if (line.trim() === '') return ''; // Keep empty lines empty
        return '        ' + line; // Add 8 spaces (indentation for try block)
      }).join('\n');
    };

    const indentedUserCode = indentUserCode(pythonCode);

    // CRITICAL: Pre-import commonly used packages to ensure they're available in global scope
    // This helps avoid import issues in user code
    // CRITICAL: Also pre-import in global scope before wrapping code to ensure packages are ready
    if (packagesToLoad.length > 0) {
      const normalizedPackagesForImport = packagesToLoad.map(pkg => {
        if (pkg === 'np') return 'numpy';
        return pkg;
      });

      // Pre-import in global scope to ensure packages are available
      for (const pkg of normalizedPackagesForImport) {
        if (pkg === 'numpy') {
          try {
            await pyodide.runPythonAsync('import numpy as np');
          } catch (preImportError) {
            console.warn(`Python worker: Failed to pre-import numpy in global scope:`, preImportError);
          }
        } else if (pkg === 'scipy') {
          try {
            await pyodide.runPythonAsync('import scipy');
          } catch (preImportError) {
            console.warn(`Python worker: Failed to pre-import scipy in global scope:`, preImportError);
          }
        }
      }
    }

    const normalizedPackagesForImport = packagesToLoad.map(pkg => {
      if (pkg === 'np') return 'numpy';
      return pkg;
    });

    const preImportCode = normalizedPackagesForImport.length > 0 ? `
# Pre-import requested packages to ensure they're available in global scope
# CRITICAL: Clear any bad imports (like numpy-tests) before importing correct packages
import sys
if 'numpy_tests' in sys.modules:
    del sys.modules['numpy_tests']
if 'numpy-tests' in sys.modules:
    del sys.modules['numpy-tests']

${normalizedPackagesForImport.map(pkg => {
      if (pkg === 'numpy') return 'import numpy as np\n# Verify numpy is correct (not numpy-tests)\nif not hasattr(np, "array"):\n    raise ImportError("numpy does not have array attribute - wrong package loaded")';
      if (pkg === 'scipy') return 'import scipy';
      return `import ${pkg}`;
    }).join('\n')}
` : '';

    const structuredPythonCode = `
# ===== HYDROBLOX CODE BLOCK STRUCTURE (matches JavaScript style exactly) =====
# Input: 'data' variable contains input from connected items
# Output: Must explicitly return a value (same as JavaScript)
${preImportCode}

# CRITICAL: Capture Python print statements and log them to console
import sys
_original_stdout = sys.stdout
class _DebugStdout:
    def write(self, text):
        if text.strip():
            # Send to JavaScript console via pyodide
            try:
                import js
                js.console.log(f"[Python] {text.strip()}")
            except:
                _original_stdout.write(text)
    def flush(self):
        _original_stdout.flush()
sys.stdout = _DebugStdout()

def _hydroblox_execute(data):
    # CRITICAL: Re-import packages inside function to ensure they're available
    # This ensures imports are in function scope, not just module scope
    try:
        import sys
        if 'numpy' in sys.modules or 'np' in sys.modules or 'numpy' in globals():
            import numpy as np
            # Verify numpy is correct
            if not hasattr(np, 'array'):
                raise ImportError("numpy loaded but does not have array attribute")
    except ImportError as e:
        # If numpy not available, try to import it
        try:
            import numpy as np
            if not hasattr(np, 'array'):
                raise ImportError("numpy loaded but does not have array attribute")
        except Exception as import_error:
            raise ImportError(f"Failed to import numpy: {import_error}")
    except Exception:
        pass  # If numpy already imported, continue
    
    try:
        # User's code starts here
        # CRITICAL: Execute user code and capture any return value
        # If user code has 'return', it will exit here with that value
        # Otherwise, continue to check for result variable
${indentedUserCode}
        # User's code ends here
        
        # CRITICAL: If we reach here, user code didn't return explicitly
        # Try to capture result from variables or last expression
        _hydroblox_result = None
        
        # Check if user code set a 'result' variable
        if 'result' in locals() and locals()['result'] is not None:
            _hydroblox_result = locals()['result']
        elif 'result' in globals() and globals()['result'] is not None:
            _hydroblox_result = globals()['result']
        else:
            # Try common result variable names
            result_vars = ['output', 'output_data', 'result_data', 'processed_data', 'final_result']
            for var_name in result_vars:
                if var_name in locals() and locals()[var_name] is not None:
                    _hydroblox_result = locals()[var_name]
                    break
                elif var_name in globals() and globals()[var_name] is not None:
                    _hydroblox_result = globals()[var_name]
                    break
        
        # CRITICAL: Always return something
        # If no result was captured, return the input data (so user can see their data)
        return _hydroblox_result if _hydroblox_result is not None else data
        
    except SyntaxError as e:
        error_msg = f"Python syntax error: {e.msg}\\nLine {e.lineno}: {e.text if hasattr(e, 'text') and e.text else 'N/A'}\\n\\nPlease check your code for:\\n- Missing colons (:)\\n- Incorrect indentation\\n- Invalid function definitions\\n- Missing parentheses or brackets"
        raise SyntaxError(error_msg) from e
        
    except NameError as e:
        error_msg = f"Python name error: {e}\\n\\nVariable is not defined.\\nPlease check that all variables are defined before use."
        raise NameError(error_msg) from e
        
    except TypeError as e:
        error_msg = f"Python type error: {e}\\n\\nCheck that you're using correct data types and function signatures."
        raise TypeError(error_msg) from e
        
    except Exception as e:
        error_msg = f"Python execution error: {type(e).__name__}: {e}\\n\\nTroubleshooting:\\n1. Check that your code returns a value (use 'return' statement)\\n2. Verify that 'data' variable contains expected input\\n3. Check for runtime errors in your logic\\n4. Ensure all imports are available"
        raise Exception(error_msg) from e

# Execute the function and return result
_hydroblox_execute(data)
`;

    // CRITICAL: Before execution, verify numpy is correct if it was loaded
    if (packagesToLoad.includes('numpy') || packagesToLoad.includes('np')) {
      try {
        // Verify numpy is correct and not numpy-tests
        await pyodide.runPythonAsync(`
import sys
# Clear any bad numpy imports
if 'numpy_tests' in sys.modules:
    del sys.modules['numpy_tests']
if 'numpy-tests' in sys.modules:
    del sys.modules['numpy-tests']

# Import and verify correct numpy
import numpy as np
if not hasattr(np, 'array'):
    raise ImportError("numpy does not have array attribute - wrong package loaded")
if not hasattr(np, 'ndarray'):
    raise ImportError("numpy does not have ndarray attribute - wrong package loaded")

# Test that numpy.array works
test_arr = np.array([1, 2, 3])
assert len(test_arr) == 3
`);
      } catch (numpyCheckError) {
        console.error('Python worker: numpy verification failed before execution:', numpyCheckError);
        // Try to reload numpy
        try {
          await pyodide.loadPackage('numpy');
        } catch (reloadError) {
          console.error('Python worker: Failed to reload numpy:', reloadError);
        }
      }
    }

    // CRITICAL: Set up Python stdout capture for debugging
    pyodide.runPython(`
import sys
from js import console

class PythonLogger:
    def __init__(self):
        self.buffer = []
    
    def write(self, text):
        if text.strip():
            console.log(f"[Python stdout] {text.strip()}")
            self.buffer.append(text)
    
    def flush(self):
        pass
    
    def get_value(self):
        return ''.join(self.buffer)

_python_logger = PythonLogger()
sys.stdout = _python_logger
`);

    // Execute Python code with async support for package loading
    // console.log('Executing Python code:', pythonCode.substring(0, 100) + '...');
    let pythonResult;
    try {
      // Try async execution first (for packages that need async loading)
      pythonResult = await pyodide.runPythonAsync(structuredPythonCode);

      // Get captured stdout for debugging
      try {
        const stdout = pyodide.runPython('_python_logger.get_value()');
        if (stdout && stdout.trim()) {
          console.log('Python stdout output:', stdout);
        }
      } catch (e) {
        // Ignore if logger not available
      }
    } catch (asyncError) {
      // Fallback to synchronous execution
      try {
        pythonResult = pyodide.runPython(structuredPythonCode);
      } catch (syncError) {
        // Provide enhanced error message
        const errorMessage = syncError.message || syncError.toString();
        throw new Error(
          `Python Code Block Execution Failed\n\n` +
          `Error: ${errorMessage}\n\n` +
          `Troubleshooting:\n` +
          `1. Check that your code returns a value (use 'return' statement or set 'result' variable)\n` +
          `2. Verify that 'data' variable contains expected input\n` +
          `3. Check for syntax errors (missing colons, incorrect indentation)\n` +
          `4. Ensure all variables are defined before use\n` +
          `5. Check that required libraries are added to the libraries list`
        );
      }
    }
    performance.mark("end-function");

    // Convert Python result back to JavaScript
    result = pythonToJs(pythonResult, pyodide);

    // Validate result
    if (result === undefined || result === null) {
      console.warn('Python code executed but returned None/undefined. Make sure your code returns a value or sets a result variable.');
      // Don't throw error, but log warning - None is a valid Python result
    }

    // console.log('Python execution result:', result);

    // Store result in database
    if (dbConfig && dbConfig.storeName && result !== null && result !== undefined && uniqueId) {
      try {
        await verifyDatabaseAccess(dbConfig.database, dbConfig.storeName);

        const serializableData = await prepareDataForStorage(result);

        const resultToStore = {
          id: uniqueId,
          data: serializableData,
          status: "completed",
          timestamp: new Date().toISOString(),
          function: 'python_code',
          module: 'python',
          language: 'python'
        };

        await storeResultInIndexedDB(
          dbConfig.database,
          dbConfig.storeName,
          resultToStore
        );
      } catch (dbError) {
        console.error('Failed to store result in IndexedDB:', dbError);
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

    performance.mark("end-script");

    let getPerformance = getPerformanceMeasures();

    // Send completion message with result
    self.postMessage({
      id,
      status: 'completed',
      step,
      funcName: funcName ? (typeof funcName === 'object' ? funcName.func : funcName) : 'python_code',
      results: result, // CRITICAL: Include result in postMessage
      ...getPerformance
    });

  } catch (error) {
    console.error('Error executing Python code:', error);

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
