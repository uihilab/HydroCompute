let subCase1 = [256, 6561, 10000, 38416, 65536, 194481, 390625, 531441, 1048576]
let subCase2_A= [256, 6561, 10000, 38416, 65536, 194481]
let subCase2_B = [390625, 531441, 1048576, 5764801, 11390625]
let subCase3 = [1048576, 2313441, 5308416, 7890481, 10556001, 13845841, 15752961, 16777216, 18974736, 20151121, 24010000, 28398241, 31640625]

//Define the hydrocompute instance

const compute = new hydroCompute();

//Put the name of the subcase to save in the compute local space

for (let matrix of subcase) {
    compute.data({
        id: JSON.stringify(matrix), 
        data: compute.utils.genRandomData(matrix, 1000, 2)
    });
}

//Subcase 1: Running small and large matrices on all the engines

//For each engine, the name of the function changes. You need to switch engine and change the name on the variable. Engine change: "javascript", "wasm", "webgpu" 

compute.setEngine("javascript");
//JavaScript: 'matrixMultiply_js', WASM-C: '_matrixMultiply_c', WebGPU: 'matrixMultiply_gpu' 

let functions: ['matrixMultiply_js'],

compute.run({
    functions: ['matrixMultiply_js'],
    dataIds: subCase1
});
//Subcase 2: A-2000, 4000, 8000, 16000 on subCase2_A; B- 100, 200, 400 on subCase2_B

//Define the same structure with the same name repeated N number of threads 

let functions = new Array(2000).fill('matrixMultiply_js')
compute.run({
    functions,
    dataIds: subCase2_A //or subCase2_B
});
//Subcase3: Running very large matrices on a single CPU thread using WebGPU

compute.setEngine("webgpu");
let functions= ['matrixMultiply_gpu'],
compute.run({
    functions,
    dataIds: subCase3
}); 
