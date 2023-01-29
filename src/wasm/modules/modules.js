/*
 * Exposes the available modules to be digested by the wasm engine.
 *
 */
const availableModules = {
  matrixUtils: "matrixUtils",
  timeSeries: "timeSeries",
  //FFT: "FFT"
};

/**
 *
 * @param {String} name - folder and wasm module name to import
 * @returns
 */
const loc = (name) => {
  return `../../src/wasm/modules/${name}/${name}.wasm`;
};

/**
 *
 * @param {*} name
 * @returns
 */
const assemblyModule = async (name) => {
  try {
    const memory = new WebAssembly.Memory({
      initial: 10,
      maximum: 100,
      shared: true,
    });
    const module = await WebAssembly.instantiateStreaming(fetch(loc(name)), {
      js: { mem: memory },
      env: {
        abort: (_msg, _file, line, column) =>
          console.error(`Abort at ${line}: ${column}`),
      },
    });
    return module.instance.exports;
  } catch (e) {
    console.log(e);
  }
};

/**
 * Helper functions for AssemblyScript compiled modules
 * This might be used for other compilations from C, C++, Rust, etc.
 */

class scriptUtils {
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

const loadModule = async (moduleName) => {
  try {
    const myCurrentModule = await new Promise((resolve, reject) => {
      resolve(assemblyModule(moduleName));
    });
    return myCurrentModule;
  } catch (e) {
    throw new NotFound(`Module not found in available scripts.`);
  }
};

const getAllModules = async () => {
  let wasmMods = {};
  for (var mod of Object.keys(availableModules)) {
    let stgMod = await loadModule(mod);
    wasmMods[mod] = stgMod;
  }
  return wasmMods;
};

const avScripts = async () => {
  let wasmMods = await getAllModules();
  console.log(wasmMods);
  let r = Object.keys(wasmMods).map((module) => {
    return module;
  });
  let fun = new Map();
  for (let func of r) {
    let fn = [];
    for (var i = 0; i < Object.keys(func).length; i++) {
      fn.push(Object.keys(wasmMods[func])[i]);
    }

    fn = fn.filter((ele) =>
      ele === undefined ||
      ele === "memory" ||
      ele === "__collect" ||
      ele === "__new" ||
      ele === "__pin" ||
      ele === "__rtti_base" ||
      ele === "__unpin" ||
      ele === "__setArgumentsLength"
        ? null
        : ele
    );
    fun.set(func, fn);
  }
  return fun;
};

export {
  getAllModules,
  loadModule,
  scriptUtils,
  assemblyModule,
  availableModules,
  avScripts,
};
