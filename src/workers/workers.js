import { DAG, promisify } from "../core/utils/globalUtils.js";

/**
 * @class
 * @name workers
 * The data structures supported for the workers scripts are limited to: JSON objects, JS objects, strings, numbers, and arrays
 */
export default class workers {
  constructor(props = {}) {
    //defaults
    this.workerCount = 0;
  }

  static initialize(args) {
    this.instanceCounter = 0;
    this.maxWorkerCount = navigator.hardwareConcurrency;
    this.results = [];
    this.workers = {};
    window.Worker
      ? (() => {
          console.log("Web workers engine set.");
        })()
      : console.error("Web workers API not supported!");
  }

  static run(args) {
    var instaceRun = {};
    instaceRun.id = `Run ${this.instanceCounter}`;
    instaceRun.values = [];
    this.functions = args.functions;
    this.dependencies =
      typeof args.dependencies === "undefined" ? [] : args.dependencies;
    //need to change this
    this.workerCount = this.functions.length;

    for (var i = 0; i < this.workerCount; i++) {
      this.workerSpanner(i);
    }

    if (args.steps >= 1) {
      var stepCounter = 0;

      while (stepCounter <= args.steps) {
        //Counter for the simulation run
        var someR = {};
        someR.step = stepCounter;
        someR.result = [];
        instaceRun.values.push(someR);

        //Sequential analysis
        if (this.dependencies.length > 0) {
          this.sequentialRun(args, stepCounter);
        } else {
          //Parallel analysis
          this.parallelRun(args, stepCounter);
        }
        this.results.push(instaceRun);
        stepCounter++;
      }
    }
    //TODO: terminate all workers
    // Object.keys(this.workers).forEach(worker =>{
    //   this.workers[`${worker}`].worker.terminate()
    // })

    this.instanceCounter++;
  }

  static sequentialRun(args, step) {
    const resolver = async (_args,j) => {
      var args_data = [];
      await this.dependencies[j].forEach((i) => {
        if (this.workers[i].finished === true) {
          args_data.push(this.results[j-1].values[step].result);
        }
        _args.data = args_data;
        this.workerInit(j);
        this.workerRun(j, _args);
      });
    };
    //this.executioner = [];
    var r = this.dependencies.map((val) => val.length);
    //var stopped = false;
    //var remaining = this.workerCount
    for (var j = 0; j < this.workerCount; j++) {
      var _args = {
        data: args.data,
        id: j,
        function: this.functions[j],
        step: step,
      };

      //this.executioner.push(() => {
      //return new Promise((resolve) => {
      if (r[j] === 0) {
        this.workerInit(j);
        this.workerRun(j, _args);
      } else {
        resolver(_args,j);
        // if (this.workers[j - 1].finished === true) {
        //   for (var i = 0; i < this.results.length; i++) {
        //     if (this.workers[j - 1].id === this.results[i].id) {
        //       _args.data = this.results[j - 1].;
        //     }
        //   }
        //   this.workerInit(j);
        //   this.workerRun(j, _args);
        // }
      }
      //});
      //});
    }
  }

  static parallelRun(args, step) {
    //This is in case the number of workers available are bigger than the required simulations.
    if (this.workerCount < this.maxWorkerCount) {
      for (var i = 0; i < this.workerCount; i++) {
        var _args = {
          data: args.data,
          id: i,
          function: this.functions[i],
          step: step,
        };
        this.workerInit(i);
        this.workerRun(i, _args);
      }
    } else {
      var counter = new Array(this.workerCount - this.maxWorkerCount)
        .fill()
        .map((d, i) => this.maxWorkerCount + i);
      //first batch
      for (var i = 0; i < this.maxWorkerCount; i++) {
        var _args = {
          data: args.data,
          id: i,
          function: this.functions[i],
          step: step,
        };
        this.workerInit(i);
        this.workerRun(i, _args);
      }
      //THIS NEEDS CHANGE!
      var remainingBatch = counter.length;
      for (var j = this.maxWorkerCount + 1; j < this.workerCount; j++) {
        //Object.keys(this.workers).forEach(id =>{
        //if (this.workers[id].finished === true){
        var _args = {
          data: args.data,
          id: counter[j],
          function: this.functions[counter[j]],
          step: step,
        };
        this.workerInit(counter[j]);
        this.workerRun(counter[j], _args);
        // }
        //})
      }
    }
  }

  static workerSpanner(i) {
    this.workers[i] = {};
    this.workers[i].finished = false;
    this.workers[i].worker = undefined;
    //this.workers[i].result = undefined;
  }

  static workerInit(i) {
    typeof this.workers[i].worker === "undefined"
      ? (() => {
          this.workers[i].worker = new Worker("./src/workers/worker.js", {
            type: "module",
          });
          this.workers[i].worker.onmessage = (e) => {
            //console.log(this.results[this.instanceCounter])
            //this.workers[e.data.id].result = e.data.results;
            this.results[this.instanceCounter].values[e.data.step].result.push(
              e.data.results
            );
            this.workers[e.data.id].finished = true;
            if (this.workers[e.data.id].finished) {
              console.log(`Results from worker ${e.data.id} available.`);
              //Always terminate the worker so another task can be run if required.
              //this.workers[e.data.id].worker.terminate();
            }
          };
          this.workers[i].worker.onerror = (e) => {
            return e.error;
          };
        })()
      : null;
  }

  static workerRun(i, args) {
    this.workers[i].worker.postMessage(args);
  }

  static showResults() {

  }
}
