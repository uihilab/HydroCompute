# HydroCompute - a computational library for hydrology

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
This work introduces hydrocompute, a computational library for hydrology and environmental sciences that runs on the client side. It employes 4 different engines, 3 main computations and 1 for peer-to-peer connection. The library has been developed using ES6 standards and the most recent available APIs for WebAssembly, WebGPU, WebRTC, and the Web Workers specifications.


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

When instantiated if no specific engines are passed into the constructor, the library will default to run using the functions within the JavaScript engine. You can see all the available functions in for each of the functions in the following pages:

### Running a simulation

By default, the hydrocompute library runs need 3 specific instructions settings: data, steps, and functions. The data submitted to the library is saved using the following instruction:

```javascript
compute.data({ id: 'itemName', data: some2Dor1Darray })
```

If no id is passed, the library will save a random name generated for the data.


## Expansions and Test Cases

### Core library usage
The usage of the library through its core structure can be found within the following files or within each module folder:
* `test-analysis.html`
* `test-data.html`
* `test-maps.html`
* `test-visualization.html`

### Expansions
The current expansions of the framework are the following:
* [BMI specification](https://github.com/uihilab/HydroLang/tree/master/hydrolang/bmi-implementation): CSDMS basic modeling interface through steering files.
* [HL-ML](https://github.com/uihilab/HydroLang-ML): HTML driven web components for hydrology and environmental sciences.

## Community
It is possible for the library to expand by becoming a community-based framework with collaborations from research institutes or knowledgeable individuals thanks to the flexibility of employing a modular architecture, open-source libraries, and not requiring installation. Interested parties can adapt and expand HydroLang to fit their unique use cases, development environments, project requirements, and data resources. Everyone is encouraged to contribute to the growth of HydroLang by:
* filing an issue to request certain features, functionality, and data,
* implementing the desired capability on a fork, and submitting a pull request.

## Feedback
Please feel free to send feedback to us on any issues found by filing an [issue](https://github.com/uihilab/HydroLang/blob/master/.github/ISSUE_TEMPLATE/feature_request.md).

## Scalability and To-Do's
The framework is not limited to the functions and modules implemented, but rather provides a boilerplate for new features to be added. Nonetheless, the following should be considered:

* The hydro component contains only lumped models.
* The map module is fully available only on Leaflet engine.

## License
This project is licensed under the MIT License - see the [LICENSE](https://github.com/uihilab/HydroLang/blob/master/LICENSE) file for details.

## Acknowledgements
This project is developed by the University of Iowa Hydroinformatics Lab (UIHI Lab):

https://hydroinformatics.uiowa.edu/.

And with the support of the Cosortium of Universities for the Advancement of Hydrological Science [CUAHSI](https://www.cuahsi.org/) through the [Hydroinformatics Innovation Fellowship](https://www.cuahsi.org/grant-opportunities/hydroinformatics-innovation-fellowship).

## References

* Erazo Ramirez, C., Sermet, Y., Molkenthin, F., & Demir, I. (2022). HydroLang: An open-source web-based programming framework for hydrological sciences. Environmental Modelling & Software, 157, 105525. [doi:10.1016/j.envsoft.2022.105525](https://www.sciencedirect.com/science/article/pii/S1364815222002250)
