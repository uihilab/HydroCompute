## JS Engine
This engine is tailored towards any JavaScript-based functions that are to be used whether from the scripts folder within this engine, or outside scripts given as relative paths to the HydroCompute library.

### Script Structure
Scripts have been developed using object-like structure that follow this convention:
```javascript
const scriptName = {
nameOfFunction1: (data, additionalArgs) => {...},
nameOfFunction2: (data, additionalArgs) => {...},
main: (nameOfFunction, data) => {...}
}
```

If the ```main``` function exists within the script, it is used as the point of interaction between the JavaScript worker and the script. If it doesn't, the user should must pass the name of the function to be used.
The user must specify the implemen

### How to use
To use the engine, the user needs to submit the following information:
* `funcName`: name of the function to run
* `scriptName`: name of the script where the function is located, if any.
* `data`: data
