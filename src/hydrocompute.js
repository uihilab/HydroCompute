import * as engines from "./core/core.js";

class hydrocompute {
  constructor(...args) {
    //this guy needs to be changed into something else afterwards
    this.enginesCalled = {};
    this.engine;
    this.currentEngineName = null;
    this.engineFactory;
    this.kernels = {};
    this.results = [];
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
    this.callbacks = args.callbacks | false
    this.functions = args.functions
    var data = (()=>{
        if (this.availableData.length === 1) {
            if (this.availableData[0].id != args.dataId) {
                return console.error(`There is no data with id:${args.dataId} stored.`)
            } else {
                return this.availableData[0].data
            }
        }
        for (var i =0; i < this.availableData.length; i++){
            if (this.availableData[i].id == args.dataId){
            return this.availableData[i].data
        }
    }
    })()
    if (this.callbacks) {
        this.engine.run({ data: data, splits: this.splits, callbacks: this.callbacks, functions: this.functions, dependencies: args.dependencies })
    } else {
    this.engine.run({ data: this.availableData, splits: this.splits, callbacks: this.callbacks, functions: this.functions });
}
  }

  currentEgine() {
    return this.currentEngineName;
  }

  data(args) {
    var container = {id: typeof args.id == "undefined" ? 0 : args.id, data: args.data}
    this.splits = args.splits | 0;
    if (this.splits === 0) {
        this.availableData.push(container)
    }
    else {
        //correct this
      if (args.data[0].length % this.splits != 0) {
        return console.error(
          "Please select a correct number of splits for your data."
        );
      }
      args.data.forEach((arr) => {
        var r = [];
        for (let i = args.splits; i > 0; i--) {
          r.push(arr.splice(0, Math.ceil(arr.length / i)));
        }
        container.data = r;
      });
      this.availableData.push(container)
      return console.log(`Data partitioned into ${this.splits} parts.`);
    }
  }

  results() {
    if (typeof this.engine === "undefined")
      console.error(
        "Please set the required engine first before initializing!"
      );
    return this.engine.results;
  }

  availableEngines() {
    return Object.keys(this.kernels);
  }

  config(...args) {
    this.engine.initialize(args);
  }
}

typeof window !== "undefined" ? (window.hydrocompute = hydrocompute) : null;
export default hydrocompute;
