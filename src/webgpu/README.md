## WebGPU engine
### Introduction
The WebGPU engine is has been tailored to run WebGPU Shader Language (WGSL) code to run efficient computation on different types of functions, specially for matrix calculations or highly-scalable big data, using a GPU-accelerated environment.

It has been written in JavaScript with functions that use the WebGPU API consisting of:
* `Bind groups`: functions for binding buffers and creating layout and group entries.
* `Shader modules`: computing pieplines, dispatchers for calculations and ingestion of shader modules.
* `Buffers`: functions for matrix manipulation and results.

### Set Up
Upon initialization of the HydroCompute instance, call the engine as:
```javascript
const compute = new hydrocompute("webgpu");
``` 
Or if the instance already has a different engine, change it as:
```javascript
compute.setEngine("webgpu");
```
Once changed, all the methods and scripts found in the scripts folder will be ready for use. The code that runs in WGSL is written using JavaScript object-like notation:
```javascript
const scriptName = {
nameOfFunction1: (data, additionalArgs) => {return `WGSL code...`},
nameOfFunction2: (data, additionalArgs) => {return `WGSL code...`},
main: (nameOfFunction, data) => {...}
}
```

If the ```main``` function exists within the script, it is used as the point of interaction between the worker and the script. If it doesn't, the function name will be used as entry point directly.


### Usage
After defining the data that wil be used within the compute, with a specific nametag or the generated one by the library, the engine can be used calling the ````run``` method as follows:
```javascript
compute.run({ 
functions: [collection of functions in array format], 
dataIds: [nametag of data saved in the library in array format]
})
```
Please see examples and homepage for more arguments that can be passed to the run function. After the simulation has run, the result will be saved in the ```compute.availableResults``` object.

### Best Practices
To harness the power of the GPU, the following should be considered:
* Avoid calling the engine on small datasets. The GPU architecture allows for very large data to be fully distributed in parallel execution throughout the chips. This means that it costs the same to run small or large chunks of data.
* If contributing new WGSL code scripta, try to create code as simple as possible to maximize performance.

### Contribution and Support
Contributing to the WebGPU engine can be done in the following ways:
* Create an issue submitting a feature request or update.
* Create your own WGSL code following the structure described above and share it through forks and submitting a pull request. Before submitting, please make sure the changes pass unit tests and adhere to the project's code style guidelines.
If encountering any issues while using the engine, please submit an issue on the project's GitHub page. The team will do the best to resolve it as soon as possible.
