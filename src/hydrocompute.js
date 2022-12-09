import * as engines from "./core/core.js";
import { splits } from "./core/utils/splits.js";
import * as scripts from "./workers/scripts/scripts.js";

class hydrocompute {
  constructor(...args) {
    //this guy needs to be changed into something else afterwards
    this.enginesCalled = {};
    this.engine;
    this.currentEngineName = null;
    this.engineFactory;
    this.kernels = {};
    this.availableData = [];
    Object.entries(engines).forEach((engine) => {
      let propName = engine[0];
      let propModule = engine[1];
      Object.assign(this.kernels, {
        [propName]: propModule,
      });
    });
    //Initiate the module with the workers api. If required, the user can change to another
    //backend product.
    args.length !== 0
      ? this.setEngine(args[0])
      : (() => {
          this.steps = 1;
          this.callbacks = false;
          console.log("Web workers engine has been set as default.");
          this.setEngine("workers");
        })();
  }

  isEngineSet() {
    typeof this.engine === "undefined"
      ? () => {
          console.error(
            "Please set the required engine first before initializing!"
          );
        }
      : null;
  }

  //Initialize a specific engine
  #init(...args) {
    this.engine.initialize(args);
  }

  //Available kernels, keeps track of available instances
  setEngine(kernel) {
    this.currentEngineName = kernel;
    this.engine = this.kernels[kernel];
    if (Object.keys(this.enginesCalled).includes(kernel)) {
      this.enginesCalled[kernel] = this.enginesCalled[kernel] + 1;
    } else {
      this.enginesCalled[kernel] = 1;
    }
    this.enginesCalled[kernel] = 1;
    this.#init();
  }

  #getEngineFactory(engine) {
    isEngineSet();
    //implementation of all the specific requirements of each kernel
  }

  async run(args = {}) {
    //Single data passed into the function.
    //It is better if the split function does the legwork of data allocation per function instead.
    var data = (() => {
      for (var item in this.availableData) {
        if (this.availableData[item].id === args.dataId)
          return this.availableData[item].data;
      }
      return console.error(
        `Data with nametag: "${args.dataId}" not found in the storage.`
      );
    })();
    if (args.callbacks && this.data.length > 0) {
      //Data passed in raw without splitting
      this.engine.run({
        data: data,
        functions: args.functions,
        dependencies: args.dependencies,
        steps: this.steps,
        callbacks: args.callbacks
      });
    } else {
      console.error("There was an error pulling the data.");
      return;
    }
  }

  currentEgine() {
    return this.currentEngineName;
  }

  #dataCloner(data) {
    //Deep copy of array data using recursion
    const arrayCloner = (arr) => {
      var temp = [];
      arr.forEach((ob) => {
        if (Array.isArray(ob)) {
          temp.push(arrayCloner(ob));
        } else {
          if (typeof ob === "object") {
            temp.push(objectCloner(ob));
          } else {
            temp.push(ob);
          }
        }
      });
      return temp;
    };

    const objectCloner = (inObject) => {
      var tempOb = {};

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

    if (Array.isArray(data)) {
      return arrayCloner(data);
    } else {
      return objectCloner(data);
    }
  }

  data(args) {
    var container = {
      id:
        typeof args.id === "undefined"
          ? `${this.currentEngineName}.${
              this.enginesCalled[this.currentEngineName]
            }.${5 * Math.random().toPrecision(4)}`
          : args.id,
    };
    if (typeof args.splits === "undefined") {
      container.data = this.#dataCloner(args.data);
      this.availableData.push(container);
    } else {
      var partition = splits.main(args.splits.function, {
        ...args.splits,
        data: this.#dataCloner(args.data),
      });
      container.data = partition;
      this.availableData.push(container);
    }
  }

  results() {
    if (typeof this.engine === "undefined")
      console.error(
        "Please set the required engine first before initializing!"
      );
    return this.engine.showResults();
  }

  availableEngines() {
    return Object.keys(this.kernels);
  }

  config(args) {
    this.steps = args.steps ? args.steps : 0;
    this.linked = args.linked ? args.linked : false;
  }

  availableScripts() {
    if (this.currentEngineName === "workers") {
      var r = Object.keys(scripts).map((script) => {
        return script;
      });
      var fun = [];
      for (var func in r) {
        for (var i = 0; i < Object.keys(r[func]).length; i++)
          fun.push(Object.keys(scripts[r[func]])[i]);
      }
      fun = fun.filter((ele) =>
        ele === undefined || ele === "main" ? null : ele
      );
      return fun;
    }
  }
}

typeof window !== "undefined" ? (window.hydrocompute = hydrocompute) : null;
export default hydrocompute;
