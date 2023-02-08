import { CUtils } from "./C/mods.js";
import { ASUtils } from "./assemblyScript/mods.js";

/**
 * Anything else that has to be imported into the library's
 * usage has to be added here
 */
const availableScripts = {
  C: "../../src/wasm/modules/C",
  //assemblyScrpt utils
  AS: "../../src/wasm/modules/assemblyScript",
};

/**
 *
 * @param {String} name - folder and wasm module name to import
 * @returns
 */
const _location = (scName, utilName) => {
  let n = (ob, name) => {
    if (ob.hasOwnProperty(name)) {
      return ob[name];
    } else {
      return console.error("No utils found with that name in the given module");
    }
  };
  if (scName === "C") {
    let stgMod = n(CUtils, utilName);
    return `${availableScripts.C}/${utilName}/${stgMod}`;
  } else if (scName === "AS") {
    let stgMod = n(ASUtils, utilName);
    return `${availableScripts.AS}/${utilName}/${stgMod}`;
  } else {
    return console.error("No script or module with the given parameters");
  }
};

/**
 *
 * @param {*} name
 * @returns
 */
const ASModule = async (name) => {
  try {
    const memory = new WebAssembly.Memory({
      initial: 1,
      //maximum: 100,
      //shared: true,
    });
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
  } catch (e) {
    console.log(e);
  }
};

/**
 *
 * @param {String} modName - module available on the C/C++ modules.
 * @returns
 */
const CModule = async (modName) => {
  try {
    let { default: Module } = await import(_location("C", modName));
    return Module();
  } catch (error) {
    console.log(`There was an error pulling the following module: ${modName}`);
  }
};

/**
 * Helper functions for AssemblyScript compiled modules
 */

class AScriptUtils {
  constructor() {
    this.dataview = undefined;
    this.memory = undefined;
    this.refCounts = new Map();
  }

  liftTypedArray(constructor, pointer, module) {
    if (!pointer) return null;
    return new constructor(
      module.memory.buffer,
      this.getU32(pointer + 4, module),
      this.dataview.getUint32(pointer + 8, true) / constructor.BYTES_PER_ELEMENT
    ).slice();
  }

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

  retainP(pointer, module) {
    if (pointer) {
      const refcount = this.refCounts.get(pointer);
      if (refcount) this.refCounts.set(pointer, refcount + 1);
      else this.refCounts.set(module.__pin(pointer), 1);
    }
    return pointer;
  }

  releaseP(pointer, module) {
    if (pointer) {
      const refcount = this.refCounts.get(pointer);
      if (refcount === 1)
        module.__unpin(pointer), this.refCounts.delete(pointer);
      else if (refcount) this.refCounts.set(pointer, refcount - 1);
      else
        throw Error(
          `no refcounter "${refcount}" for the reference "${pointer}"`
        );
    }
  }

  setU32(pointer, value, module) {
    try {
      this.dataview.setUint32(pointer, value, true);
    } catch {
      this.dataview = new DataView(module.memory.buffer);
      this.dataview.setInt32(pointer, value, true);
    }
  }

  getU32(pointer, module) {
    try {
      return this.dataview.getUint32(pointer, true);
    } catch {
      this.dataview = new DataView(module.memory.buffer);
      return this.dataview.getUint32(pointer, true);
    }
  }
}

class CScriptsUtils {
  constructor() {}
}

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
    throw new NotFound(`Module not found in available scripts.`);
  }
};

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
      wasmMods[sc][mod] = stgMod;
    }
  }
  return wasmMods;
};

/**
 *
 * @returns
 */
const avScripts = async () => {
  let wasmMods = await getAllModules();
  let main = new Map();

  Object.keys(wasmMods).forEach((scr) => {
    let modules = new Map();
    main.set(scr, modules);
    Object.keys(wasmMods[scr]).map((fn) => {
      let fun = Object.keys(wasmMods[scr][fn]);
      fun = fun.filter((ele) =>
        ele === undefined ||
        ele === "memory" ||
        ele === "__collect" ||
        ele === "__new" ||
        ele === "__pin" ||
        ele === "__rtti_base" ||
        ele === "__unpin" ||
        ele === "__setArgumentsLength" ||
        ele.includes("HEAP") ||
        ele === "ready" ||
        ele === "calledRun" ||
        ele === "ready" ||
        ele === "asm"
          ? null
          : ele
      );
      modules.set(fn, fun);
    });
  });
  return main;
};

export {
  getAllModules,
  loadModule,
  AScriptUtils,
  ASModule,
  availableScripts,
  avScripts,
};
