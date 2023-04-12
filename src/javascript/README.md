## JavaScript Engine
### Introduction
This engine is tailored towards any JavaScript-based functions that are to be used, whether from the `scripts` folder within this engine or outside scripts given as relative paths to the HydroCompute library. The engine calls the functions directly using the web workers API to run the specific commands that the user provides when running a computation. It is the main engine set up through the HydroCompute library for initialization.

### Set Up
Scripts have been developed using object-like structure that follow this convention:
```javascript
const scriptName = {
nameOfFunction1: (data, additionalArgs) => {JS Code...},
nameOfFunction2: (data, additionalArgs) => {JS Code...},
main: (nameOfFunction, data) => {...}
}
```

If the `main` function exists within the script, it is used as the point of interaction between the worker and the script. If it doesn't exist, the function name will be used as the entry point directly. If the user is running scripts outside of the library's available scripts, then it should be specified in the arguments of the `run` function.

### Usage
After defining the data that wil be used within the compute, with a specific nametag or the generated one by the library, the engine can be used calling the ```run``` method as follows:
```javascript
compute.run({ 
functions: [collection of functions in array format], 
dataIds: [nametag of data saved in the library in array format]
})
```
Please see examples and homepage for more arguments that can be passed to the run function. After the simulation has run, the result will be saved in the ```compute.availableResults``` object.

### Best Practices
To get the best out of the engine, please consider the following:

* JavaScript code is not optimized for running large datasets. If there is a function in other engines that will perform the same required task (WASM, WebGPU), please consider switching the engine.
* When developing code for the engine, please maintain the `main` function as the point of entry.

### Contribution and Support
Contributing to the JavaScript engine can be done in the following ways:
* Create an issue submitting a feature request or update.
* Create your own JavaScript code following the structure described above and share it through forks and submitting a pull request. Before submitting, please make sure the changes pass unit tests and adhere to the project's code style guidelines.
If encountering any issues while using the engine, please submit an issue on the project's GitHub page. The team will do the best to resolve it as soon as possible.
