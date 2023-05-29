import { CUtils } from "./C/mods.js";
import { ASUtils } from "./assemblyScript/mods.js";

/**
 * @namespace WASMUtils
 */


/**
 * @memberof WASMUtils
 * @description object container of relative paths for the Web Assembly modules
 */
const availableScripts = {
  C: "../../wasm/modules/C",
  //assemblyScrpt utils
  AS: "../../wasm/modules/assemblyScript",
};

/**
 * @description Returns the location of a specified utility in a given script or module.
 * @memberof WASMUtils
 * @param {string} scName - The name of the script or module.
 * @param {string} utilName - The name of the utility.
 * @returns {string} - The location of the specified utility in the given script or module.
 */
const _location = (scriptName, utilName) => {
  const getModule = (utils, name) => {
    if (utils.hasOwnProperty(name)) {
      return utils[name];
    }
    throw new Error(
      `No utils found with the name '${name}' in the given module`
    );
  };

  switch (scriptName) {
    case "C":
      const cUtils = getModule(CUtils, utilName);
      return new URL(
        `${availableScripts.C}/${utilName}/${cUtils}`,
        import.meta.url
      );
    case "AS":
      const asUtils = getModule(ASUtils, utilName);
      return new URL(
        `${availableScripts.AS}/${utilName}/${asUtils}`,
        import.meta.url
      );
    default:
      throw new Error(`No script or module with the name '${scriptName}'`);
  }
};

/**
 * @description Load and instantiate a WebAssembly module from the ASUtils script directory.
 * @memberof WASMUtils
 * @async
 * @param {string} name - The name of the module to load.
 * @returns {Promise} - An object representing the exports of the instantiated module.
 * @throws {Error} - If the module cannot be loaded or instantiated.
 */
const ASModule = async (name) => {
  const memory = new WebAssembly.Memory({
    initial: 1,
    //maximum: 100,
    //shared: true,
  });
  try {
    const module = await WebAssembly.instantiateStreaming(
      fetch(_location("AS", name)),
      {
        js: { mem: memory },
        env: {
          abort: (_msg, _file, line, column) =>
            console.error(`Abort at ${line}: ${column}`),
          memory: memory,
        },
      }
    );
    return module.instance.exports;
  } catch (error) {
    throw new Error(`Failed to load AS module '${name}'.`, error);
  }
};

/**
 * @description Asynchronously loads and creates a module from a C script.
 * @memberof WASMUtils
 * @param {string} moduleName - The name of the module to load.
 * @returns {Promise} A promise that resolves to the module.
 * @throws Will throw an error if there was an error loading the module.
 */
const CModule = async (modName) => {
  try {
    let { default: Module } = await import(_location("C", modName));
    return Module();
  } catch (error) {
    console.error(
      `There was an error pulling the following module: ${modName}`,
      error
    );
  }
};

/**
 * @description Utility class for dealing with AS compiled WASM.
 * @member AScriptUtils
 * @memberof WASMUtils
 * @property lifTypedArray
 */
class AScriptUtils {
  constructor() {
    this.dataview = undefined;
    this.memory = undefined;
    this.refCounts = new Map();
  }

  /**
   * Lifts a TypedArray from the module's memory.
   * @param {TypedArrayConstructor} constructor - The constructor of the TypedArray.
   * @param {number} pointer - The memory pointer to the TypedArray.
   * @param {object} module - The AScript module.
   * @returns {TypedArray|null} - The lifted TypedArray.
   */
  liftTypedArray(constructor, pointer, module) {
    if (!pointer) return null;
    return new constructor(
      module.memory.buffer,
      this.getU32(pointer + 4, module),
      this.dataview.getUint32(pointer + 8, true) / constructor.BYTES_PER_ELEMENT
    ).slice();
  }

  /**
   * Lowers a TypedArray to the module's memory.
   * @param {TypedArrayConstructor} constructor - The constructor of the TypedArray.
   * @param {number} id - The identifier of the TypedArray.
   * @param {number} align - The alignment of the TypedArray.
   * @param {TypedArray} values - The TypedArray to lower.
   * @param {object} module - The AScript module.
   * @returns {number} - The memory pointer to the lowered TypedArray.
   */
  lowerTypedArray(constructor, id, align, values, module) {
    if (values == null) return 0;

    const length = values.length,
      buffer = module.__pin(module.__new(length << align, 1)) >>> 0,
      header = module.__new(12, id) >>> 0;

    this.setU32(header + 0, buffer, module);
    this.dataview.setUint32(header + 4, buffer, true);
    this.dataview.setUint32(header + 8, length << align, true);
    new constructor(module.memory.buffer, buffer, length).set(values);
    module.__unpin(buffer);
    return header;
  }

  /**
   * Retains a memory pointer and increments its reference count.
   * @param {number} pointer - The memory pointer to retain.
   * @param {object} module - The AScript module.
   * @returns {number} - The retained memory pointer.
   */
  retainP(pointer, module) {
    if (pointer) {
      const refcount = this.refCounts.get(pointer);
      if (refcount) this.refCounts.set(pointer, refcount + 1);
      else this.refCounts.set(module.__pin(pointer), 1);
    }
    return pointer;
  }

  /**
   * Releases a memory pointer and decrements its reference count.
   * @param {number} pointer - The memory pointer to release.
   * @param {object} module - The AScript module.
   */
  releaseP(pointer, module) {
    if (pointer) {
      const refcount = this.refCounts.get(pointer);
      if (refcount === 1)
        module.__unpin(pointer), this.refCounts.delete(pointer);
      else if (refcount) this.refCounts.set(pointer, refcount - 1);
      else
        throw Error(
          `No refcounter "${refcount}" for the reference "${pointer}".`
        );
    }
  }

/**
 * Sets a 32-bit unsigned integer value at the specified memory pointer.
 * @param {number} pointer - The memory pointer.
 * @param {number} value - The value to set.
 * @param {object} module - The AScript module.
 */
  setU32(pointer, value, module) {
    try {
      this.dataview.setUint32(pointer, value, true);
    } catch {
      this.dataview = new DataView(module.memory.buffer);
      this.dataview.setInt32(pointer, value, true);
    }
  }

/**
 * Gets a 32-bit unsigned integer value from the specified memory pointer.
 * @param {number} pointer - The memory pointer.
 * @param {object} module - The AScript module.
 * @returns {number} - The 32-bit unsigned integer value.
 */
  getU32(pointer, module) {
    try {
      return this.dataview.getUint32(pointer, true);
    } catch {
      this.dataview = new DataView(module.memory.buffer);
      return this.dataview.getUint32(pointer, true);
    }
  }
}

/**
 * @description Loads a module based on the script name and module name.
 * @memberof WASMUtils
 * @param {string} scriptName - The script name.
 * @param {string} moduleName - The module name.
 * @returns {Promise<object>} - A promise that resolves to the loaded module.
 * @throws {NotFound} - If the module is not found in the available scripts.
 */
const loadModule = async (scriptName, moduleName) => {
  try {
    const myCurrentModule = await new Promise((resolve, reject) => {
      //Removes extension for each module
      resolve(
        scriptName === "AS"
          ? ASModule(moduleName.substring(0, moduleName.length - 5))
          : CModule(moduleName.substring(0, moduleName.length - 3))
      );
    });
    return myCurrentModule;
  } catch (e) {
    console.error(e);
    throw new NotFound(`Module not found in available scripts.`);
  }
};

/**
 * @description Retrieves all available modules.
 * @memberof WASMUtils
 * @returns {Promise<object>} - A promise that resolves to an object containing all the available modules.
 */
const getAllModules = async () => {
  let wasmMods = {};
  let availableMods;
  for (var sc of Object.keys(availableScripts)) {
    if (sc === "C") {
      availableMods = Object.values(CUtils).map((val) => val);
    } else if (sc === "AS") {
      availableMods = Object.values(ASUtils).map((val) => val);
    }
    wasmMods[sc] = {};
    for (var mod of availableMods) {
      let stgMod = await loadModule(sc, mod);
      wasmMods[sc][
        sc === "AS"
          ? mod.substring(0, mod.length - 5)
          : mod.substring(0, mod.length - 3)
      ] = stgMod;
    }
  }
  return wasmMods;
};

/**
 * @description Retrieves all available scripts and their modules.
 * @memberof WASMUtils
 * @returns {Promise<object>} - A promise that resolves to an object containing all the available scripts and their modules.
 */
const avScripts = async () => {
  const wasmMods = await getAllModules();
  const main = {};

  for (const scr of Object.keys(wasmMods)) {
    const modules = new Map();
    main[scr] = modules;
    for (const fn of Object.keys(wasmMods[scr])) {
      const fun = Array.from(filterFunctionKeys(wasmMods[scr][fn]));
      modules.set(fn, fun);
    }
  }

  return main;
};

/**
 * @description Filters the function keys of an object, excluding specific keys.
 * @memberof WASMUtils
 * @param {object} obj - The object to filter.
 * @returns {string[]} - An array of filtered function keys.
 */
function filterFunctionKeys(obj) {
  const excludeKeys = new Set([
    undefined,
    "memory",
    "__collect",
    "__new",
    "__pin",
    "__rtti_base",
    "__unpin",
    "__setArgumentsLength",
    "ready",
    "calledRun",
    "asm",
    "_createMem",
    "_destroy",
    "HEAP8",
    "HEAP16",
    "HEAP32",
    "HEAPU8",
    "HEAPU16",
    "HEAPU32",
    "HEAPF32",
    "HEAPF64",
  ]);
  return Object.keys(obj).filter((key) => !excludeKeys.has(key));
}

export {
  getAllModules,
  loadModule,
  AScriptUtils,
  ASModule,
  availableScripts,
  avScripts,
};
