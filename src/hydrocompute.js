import * as engines from "./core.js"

class hydrocompute {
    constructor(...args){
        //this guy needs to be changed into something else afterwards
        this.enginesCalled = {}
        this.engine;
        this.currentEngineName = null
        this.engineFactory;
        this.kernels = {};
        this.results = [];
        Object.entries(engines).forEach((engine) => {
            let propName = engine[0];
            let propModule = engine[1];
            Object.assign(this.kernels, {
                [propName]: propModule
            })
        })
        args.length !== 0 ? this.setEngine(args[0]) : null
    }

    isEngineSet(){
        (typeof this.engine === "undefined")
        ?
        (() => {
        console.error("Please set the required engine first before initializing!")
    }):
    null
    }

    //Initialize a specific engine
    #init(...args){
        this.engine.initialize(args)
        
    }

    //Available kernels, keeps track of available instances
    setEngine(kernel) {
        this.currentEngineName = kernel
        this.engine = this.kernels[kernel];
        if(Object.keys(this.enginesCalled).includes(kernel)){
            this.enginesCalled[kernel] = this.enginesCalled[kernel] + 1
        } else{
            this.enginesCalled[kernel] = 1
        }
        this.enginesCalled[kernel] = 1
        this.#init();
    }
    
    #getEngineFactory(engine){
        isEngineSet()
        //implementation of all the specific requirements of each kernel
    }

    async transferData(...args){
        (typeof this.engine === "undefined")
        ?
        console.error("Please set the required engine first before initializing!")
        :
        this.results.push(await this.engine.digestData(args))
    }

    currentEgine(){
        return this.currentEngineName
    }

    retrieveResults(){
        if (typeof this.engine === "undefined") console.error("Please set the required engine first before initializing!");
        return this.results
    }

    availableEngines(){
        return Object.keys(this.kernels)
    }

    // setDevice(){
    //     return this.engine.setDevice()
    // }

}

(typeof window !== "undefined") ? window.hydrocompute = hydrocompute : null
export default hydrocompute