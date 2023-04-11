## WebGPU engine
### Introduction
The WebGPU engine is has been tailored to run WebGPU Shader Language (WGSL) code to run efficient computation on different types of functions, specially for matrix computations using a GPU-accelerated environment. It can be used to perform large-scale computations efficiently.

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
Once changed, all the methods and scripts found in the scripts folder will be ready for use.

### Usage
After defining the 

### Best Practices
To harness the power of the GPU, the following should be considered:
* Avoid calling the engine on small datasets. The GPU architecture allows for very large data to be fully distributed in parallel execution throughout the chips. This means that it costs the same to run small or large chunks of data.
* If contributing new WGSL code, try to create code as simple as possible to maximize performance.

### Contribution and Support
Contributing to the WebGPU engine can be done in the following ways:
* Create an issue submitting a feature request or update.
* Create your own WGSL code following the structure described above and share it through forks and submitting a pull request. Before submitting, please make sure the changes pass unit tests and adhere to the project's code style guidelines
If encountering any issues while using the engine, please submit an issue on the project's GitHub page. The team will do the best to resolve it as soon as possible.
