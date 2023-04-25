//Tester script to evaluate if a function will run.
const example = {
    // Cube each element in the input array and return the result
    cube: (input) => {
      const output = input.map((x) => x ** 3);
      return output;
    },
  
    // Take the cube root of each element in the input array and return the result
    cubeRoot: (input) => {
      const output = input.map((x) => x ** (1 / 3));
      return output;
    },
  
    // Compose the cube and cubeRoot functions to process the input array
    main: (input) => {
      const output = example.cubeRoot(example.cube(input));
      return output;
    },
  };

  export default example