# HydroCompute - a computational library for hydrology

## Table of Contents

[**Link to documentation**](https://uihilab.github.io/HydroCompute/)

* [Introduction](https://github.com/uihilab/HydroCompute#Introduction)
* [Database Integration](https://github.com/uihilab/HydroCompute#Database-Integration)
* [How to Use](https://github.com/uihilab/HydroCompute#How-to-Use)
* [Expansions and Test Cases](https://github.com/uihilab/HydroCompute#Expansions-and-Test-Cases)
* [Community](https://github.com/uihilab/HydroCompute#Community)
* [Feedback](https://github.com/uihilab/HydroCompute#Feedback)
* [Scalability and To Do's](https://github.com/uihilab/HydroCompute#Scalability-and-To-Dos)
* [License](https://github.com/uihilab/HydroCompute#License)
* [Acknowledgements](https://github.com/uihilab/HydroCompute#Acknowledgements)
* [References](#references)

## Introduction
This work introduces hydroCompute, a computational library for hydrology and environmental sciences that runs on the client side. It employs distributed computing environments including **JavaScript** (Native & HydroLang), **Python** (Pyodide), **R** (WebR), and **WebGPU**, along with **WebRTC** for peer-to-peer connectivity. The library has been developed using ES6 standards and the most recent available APIs for WebAssembly, WebGPU, WebRTC, and the Web Workers specifications.

## Database Integration
HydroCompute now integrates **HydroComputeDB**, a robust wrapper around IndexedDB, to manage data persistence across sessions and workers. This ensures that large datasets and simulation results are stored efficiently in the browser without blocking the main thread. The database manages several stores:
*   `settings`: Stores configuration and code snippets for dynamic execution.
*   `workflowStates`: Manages the state of complex, multi-step workflows.
*   `results`: Stores the output of computations, linked by execution IDs.
*   `wasmModules`: Caches compiled WebAssembly modules for faster loading.

## How to Use
Please download the library and run `index.html`. If a new html file should be created, the library must be onloaded onto the file as a script

```html
<script
 type = "module"
 src= "src/hydrocompute.js"
></script>
```

The library is loaded into an HTML web app by declaring either it as a window object when loading, or as a single instance run as follows:

```javascript
const compute = new hydroCompute('engineName');
```

When instantiated if no specific engines are passed into the constructor, the library will default to run using the functions within the JavaScript engine.

### Running a Simulation

By default, the hydrocompute library runs need 3 specific instructions settings: data, steps, and functions. The data submitted to the library is saved using the following instruction:

```javascript
// Save data to the internal database
await compute.data({ id: 'itemName', data: someNDArray })
```

If no id is passed, the library will save a random name generated for the data. To revise the available data, then pass the command

```javascript
compute.availableData()
```

Steps are inferred from the configuration for each run.

<details>
<summary><b>JavaScript (Native & HydroLang)</b></summary>
<br>

Run native JavaScript functions or harness **HydroLang** capabilities directly.

```javascript
// Native JS execution
compute.run({
  dataIds: [['dataId']],
  functions: [['Math.max']]
});

// Using HydroLang
compute.run({
  engine: 'javascript',
  functions: [['str']], // Module
  funcArgs: [[{ func: 'aridity', args: { /* params */ } }]]
});
```
</details>
<br>

<details>
<summary><b>Python (Pyodide)</b></summary>
<br>

Execute Python code directly in the browser using Pyodide.

```javascript
compute.run({
    type: 'python',
    engine: 'python',
    dataIds: [['my_data_id']],
    functions: [['python_script_id']] // ID of code saved in 'settings' store
});
```
</details>
<br>

<details>
<summary><b>R (WebR)</b></summary>
<br>

Run R scripts and hydrological packages using WebR.

```javascript
compute.run({
    type: 'webr',
    engine: 'webr',
    dataIds: [['my_data_id']],
    functions: [['r_script_id']] // ID of code saved in 'settings' store
});
```
</details>
<br>

<details>
<summary><b>WebAssembly (WASM)</b></summary>
<br>

Execute high-performance compiled modules.

```javascript
// Set engine to WASM
await compute.setEngine('wasm');

compute.run({
    engine: 'wasm',
    functions: [['accumulate_flow']],
    dependencies: [[[ 'dem_data_id' ]]],
    dataIds: [[[ 'dem_data_id' ]]]
});
```
</details>
<br>

<details>
<summary><b>WebGPU</b></summary>
<br>

Leverage GPU acceleration for massive parallel datasets.

```javascript
// Set engine to WebGPU
await compute.setEngine('webgpu');

compute.run({
    engine: 'webgpu',
    functions: [['matrix_multiply']],
    dataIds: [['matrixA_id', 'matrixB_id']]
});
```
</details>
<br>

<details>
<summary><b>Combined Workflow (Multi-Engine)</b></summary>
<br>

Chain multiple engines together in a single workflow. For example, process data in Python, analyze in R, and visualize in JavaScript.

```javascript
compute.run({
    linked: true, // Pass results from step 0 to step 1
    functions: [
        ['python_script_id'],  // Step 0: Python preprocessing
        ['r_stats_script_id'], // Step 1: R statistical analysis
        ['vis_func_id']        // Step 2: JS Visualization preparation
    ],
    engine: ['python', 'webr', 'javascript'], // Define engine per step if supported (or set individually)
    // Note: Actual mixed-engine runs rely on the 'type' param per step or switching engines between runs.
    // A common pattern is to run them sequentially and link via Data IDs.
});
```
</details>

The console of the browser will show the number of executions done by the engine once the results are finished. To retrieve the results, prompt the following command.

```javascript
compute.availableResults()
```
The results per simulation will be saved with nametag `Simulation_N`.

## Expansions and Test Cases
### Expansions
Currently the library works fully with Chromium based browsers. Mozilla implementations will be added in future releases.

New modules for dealing with Web Assembly compiled code will be implemented as well as new working examples for a more comprehensive view of what the library can do.

## Community
It is possible for the library to expand by becoming a community-based framework with collaborations from research institutes or knowledgeable individuals thanks to the flexibility of employing a modular architecture, open-source libraries, and not requiring installation. Interested parties can adapt and expand HydroLang to fit their unique use cases, development environments, project requirements, and data resources. Everyone is encouraged to contribute to the growth of HydroCompute by:
* filing an issue to request certain features, functionality, and data,
* implementing the desired capability on a fork, and submitting a pull request.

## Feedback
Please feel free to send feedback to us on any issues found by filing an issue.

## Scalability and To-Do's
New engines and functions for the existing engines will be added into the library for easier implementation and usage.


## License
This project is licensed under the MIT License - see the [LICENSE](https://github.com/uihilab/HydroCompute/blob/master/LICENSE) file for details.

## Acknowledgements
This work was funded by the University of Iowa's HydroInformatics Lab.

## References

* Erazo Ramirez, C., Sermet, Y., Demir, I. HydroCompute: An Open Source Web-based Client-side Computational Library 
for Hydrology And Environmental Sciences. In revision.
