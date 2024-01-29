# Case Study 1: Matrix Multiplication

This codebase contains a matrix multiplication case study, showcasing the capabilities of the HydroCompute framework.

## Features

- **Matrix Size Representation**: Matrix sizes per subcase are denoted as the power of 2 for each value.
- **SubCase 1**: Matrices of sizes [256, 6561, 10000, 38416, 65536, 194481, 390625, 531441, 1048576]
- **SubCase 2_A**: Matrices of sizes [256, 6561, 10000, 38416, 65536, 194481]
- **SubCase 2_B**: Matrices of sizes [390625, 531441, 1048576, 5764801, 11390625]
- **SubCase 3**: Matrices of sizes [1048576, 2313441, 5308416, 7890481, 10556001, 13845841, 15752961, 16777216, 18974736, 20151121, 24010000, 28398241, 31640625]
- **HydroCompute Instance**: The framework is initialized using the HydroCompute class.

## Getting Started
To run this web application locally:

* Clone this repository to your local machine.
Open the index.html file in a web browser.
* Open the Developer Tools to see outputs from the HydroCompute.
* Copy-paste each execution code below in the console of the browser.

## Execution

1. **Data Generation**:

For each matrix in the subcase, random data is generated and stored in the HydroCompute local space.
```js
// Define the hydrocompute instance
const compute = new hydroCompute();

// Put the name of the subcase to save in the compute local space
for (let matrix of subcase) {
    compute.data({
        id: JSON.stringify(matrix), 
        data: compute.utils.genRandomData(matrix, 1000, 2)
    });
}
```

2. **Subcase 1**:

Running small and large matrices on all engines (JS, WASM-C, WebGPU).
```js
// Subcase 1: Running small and large matrices on all engines
// For each engine, the name of the function changes. You need to switch engine and change the name on the variable. Engine change: "javascript", "wasm", "webgpu" 
compute.setEngine("javascript");
// JavaScript: 'matrixMultiply_js', WASM-C: '_matrixMultiply_c', WebGPU: 'matrixMultiply_gpu' 

let functions = ['matrixMultiply_js'];
compute.run({
    functions: ['matrixMultiply_js'],
    dataIds: subCase1
});
```
3. **Subcase 2**:

Running matrices on SubCase2_A and SubCase2_B.
```js
// Subcase 2: A-2000, 4000, 8000, 16000 on subCase2_A; B- 100, 200, 400 on subCase2_B

// Define the same structure with the same name repeated N number of threads 
let functions = new Array(2000).fill('matrixMultiply_js')
compute.run({
    functions,
    dataIds: subCase2_A // or subCase2_B
});
```

4. **Subcase 3**:

Running very large matrices on a single Web Worker using WebGPU

```js
compute.setEngine("webgpu");
let functions = ['matrixMultiply_gpu'];
compute.run({
    functions,
    dataIds: subCase3
});
```

*Note: The code is found in the file called matrixMul.js.*

## License
This project is licensed under the MIT License.




