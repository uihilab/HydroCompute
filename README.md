# HydroCompute - a web-based client-side computational library for hydrology

## Table of Contents

[**Link to documentation**](https://uihilab.github.io/HydroCompute/)

* [Introduction](https://github.com/uihilab/HydroCompute#Introduction)
* [How to Use](https://github.com/uihilab/HydroCompute#How-to-Use)
* [Expansions and Test Cases](https://github.com/uihilab/HydroCompute#Expansions-and-Test-Cases)
* [Community](https://github.com/uihilab/HydroCompute#Community)
* [Feedback](https://github.com/uihilab/HydroCompute#Feedback)
* [Scalability and To Do's](https://github.com/uihilab/HydroCompute#Scalability-and-To-Dos)
* [License](https://github.com/uihilab/HydroCompute#License)
* [Acknowledgements](https://github.com/uihilab/HydroCompute#Acknowledgements)
* [References](#references)

## Introduction
This work introduces HydroCompute, a computational library for hydrology and environmental sciences that runs on the client side. It employes 4 different engines, 3 main computations and 1 for peer-to-peer connection. The library has been developed using ES6 standards and the most recent available APIs for WebAssembly, WebGPU, WebRTC, and the Web Workers specifications.

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
const compute = new hydrocompute('engineName');
```

When instantiated if no specific engines are passed into the constructor, the library will default to run using the functions within the JavaScript engine. The available engines along with existing code and how to develop more functions for usage in the library can be found in the following links:

* [WebAssembly](https://github.com/uihilab/HydroCompute/tree/master/src/wasm): Available C and AssemblyScript bindings.
* [JavaScript](https://github.com/uihilab/HydroCompute/tree/master/src/javascript): Available as native JavaScript object.
* [WebGPU](https://github.com/uihilab/HydroCompute/tree/master/src/webgpu): GLSL code onloaded as strings in a JavaScript object.

### Running a simulation

By default, the hydrocompute library runs need 3 specific instructions settings: data, steps, and functions. The data submitted to the library is saved using the following instruction:

```javascript
compute.data({ id: 'itemName', data: some2Dor1Darray })
```

If no id is passed, the library will save a random name generated for the data. To revise the available data, then pass the command

```javascript
compute.availableData()
```

Steps are inferred from the configuration for each 

If there is only 1 data souce available inside the available data namespace, then just calling run would suffice.

```javascript
compute.run()
```

To run a batch work, do:

```javascript
compute.run({
    linked: Boolean stating linkeage between steps
    functions: [Array of functions per step],
    dataId: [Array of names of saved data],
    dependencies: [Array of dependencies as numbers, if applicable],
    funcArgs: [Array of additional configurations per function, if applicable]
})
```
The console of the browser will show the number of executions done by the engine once the results are finished. To retrieve the results, prompt the following command.

```javascript
compute.availableResults()
```
The results per simulation will be saved with nametag `Simulation_N`.

A list of case studies and examples can be found [here](https://github.com/uihilab/HydroCompute/tree/master/examples).

A self-guided tutorial can be found in the following [link](https://hydroinformatics.uiowa.edu/tutorials/hydrocompute/).

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
The HydroCompute library is a work in progress that aims in providing a scalable set of tools so that the hydrologic community can benefit from. To this extent, we have the following open developments that will be included in future deployments:

* New engines and functions for the existing engines will be added into the library for easier implementation and usage.
* A webpack implementation of the library that provides an easier interaction directly from a CDN.
* Create a better integration with technologies such as Docker containers to streamline the deployment of new functions using WebAssembly into the library.


## License
This project is licensed under the MIT License - see the [LICENSE](https://github.com/uihilab/HydroCompute/blob/master/LICENSE) file for details.

## Acknowledgements
This project was funded by the National Oceanic & Atmospheric Administration (NOAA) via a cooperative agreement with The University of Alabama (NA22NWS4320003) awarded to the Cooperative Institute for Research to Operations in Hydrology (CIROH).

## References

* Erazo Ramirez, C., Sermet, Y., & Demir, I. (2024). HydroCompute: An open-source web-based computational library for hydrology and environmental sciences. Environmental Modelling & Software, 175, 106005. https://doi.org/10.1016/j.envsoft.2024.106005
