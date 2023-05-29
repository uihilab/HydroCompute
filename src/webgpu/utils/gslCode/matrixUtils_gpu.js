/**
 * @description Utility functions for matrix operations using GPU shaders.
 * @member matrixUtils_gpu
 * @memberof gpuScripts
*/
export const matrixUtils = {
  /** 
   * Performs matrix multiplication using a GPU shader.
   * @returns {string} - GLSL code for matrix multiplication shader.
   * 
  */
  matrixMultiply_gpu: () => {
    return `
        struct Matrix {
          size: vec2<f32>,
          numbers: array<f32>,
        };
  
        @group(0) @binding(0) var<storage, read> mat1: Matrix;
        @group(0) @binding(1) var<storage, read> mat2: Matrix;
        @group(0) @binding(2) var<storage, read_write> resultMatrix: Matrix;
        
        @compute @workgroup_size(8,8)
        fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
          //Guarding against out of bounds group sizes
          if (global_id.x >= u32(mat1.size.x) || global_id.y >= u32(mat2.size.y)){
            return;
          };
  
          resultMatrix.size = vec2(mat1.size.x, mat2.size.y);
  
          let resultCell = vec2(global_id.x, global_id.y);
          var result = 0.0;
          for (var i=0u; i < u32(mat1.size.y); i = i + 1u) {
            let a = i + resultCell.x * u32(mat1.size.y);
            let b = resultCell.y + i * u32(mat2.size.y);
            result = result + mat1.numbers[a] * mat2.numbers[b];
          };
  
          let index = resultCell.y + resultCell.x * u32(mat2.size.y);
          resultMatrix.numbers[index] = result;
        };
      `;
  },

    /** 
   * Performs matrix multiplication using a GPU shader.
   * @returns {string} - GLSL code for matrix Addition shader.
   * 
  */
  matrixAdd_gpu: () => {
    return `
    struct Matrix {
      size: vec2<f32>,
      numbers: array<f32>,
    };
    
    @group(0) @binding(0) var<storage, read> mat1: Matrix;
    @group(0) @binding(1) var<storage, read> mat2: Matrix;
    @group(0) @binding(2) var<storage, read_write> resultMatrix: Matrix;
    
    @compute @workgroup_size(8,8)
    fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
      // Guarding against out of bounds group sizes
      if (global_id.x >= u32(mat1.size.x) || global_id.y >= u32(mat1.size.y)) {
        return;
      }
    
      resultMatrix.size = mat1.size;
    
      let index = global_id.y + global_id.x * u32(mat1.size.y);
      resultMatrix.numbers[index] = mat1.numbers[index] + mat2.numbers[index];
    };  
    
      `;
  },

  /**
   * @description powers up the elements in a matrix to the given number
   * @param {Number} num - number to exponentiate all elements in the matrix
   * @returns {string} GLSL code for matrix exponentiation shader.
   */
  matrixExpo_gpu: (num = 2.0) => {
    return `
    struct Matrix {
      size: vec2<f32>,
      numbers: array<f32>,
    };
    
    @group(0) @binding(0) var<storage, read> mat1: Matrix;
    @group(0) @binding(1) var<storage, read_write> resultMatrix: Matrix;
    
    @compute @workgroup_size(8,8)
    fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
      if (global_id.x >= u32(mat1.size.x) || global_id.y >= u32(mat1.size.y)){
        return;
      };
    
      resultMatrix.size = mat1.size;
    
      let index = global_id.x + global_id.y * u32(mat1.size.x);
      let exponent = f32(${num});  // you can change the exponent value to any float number
      resultMatrix.numbers[index] = pow(mat1.numbers[index], exponent);
    }    
    `;
  },

  /**
   * @description decomposition of a matrix to its LeftUpper form
   * @returns {string} string for running LUDecomposition
   */
  LUDecomposition_gpu: () => {
    return `
    struct Matrix {
      size: vec2<f32>,
      numbers: array<f32>,
    };
    
    @group(0) @binding(0) var<storage, read> mat: Matrix;
    @group(0) @binding(1) var<storage, read_write> L: Matrix;
    @group(0) @binding(2) var<storage, read_write> U: Matrix;
    
    @compute @workgroup_size(8,8)
    fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
        if (global_id.x >= u32(mat.size.x) || global_id.y >= u32(mat.size.y)){
        return;
      };
      
      L.size = mat.size;
      U.size = mat.size;
    
      for(var i = 0; i < mat.size.x; i++) {
        for(var j = 0; j < mat.size.y; j++) {
            if(i <= j) {
              let index = i + j * u32(mat.size.x);
              U.numbers[index] = mat.numbers[index];
              for(var k = 0; k < i; k++) {
                U.numbers[index] = U.numbers[index] - L.numbers[i + k * u32(mat.size.x)] * U.numbers[k + j * u32(mat.size.x)];
              }
            }
            if(i > j) {
              let index = i + j * u32(mat.size.x);
              L.numbers[index] = mat.numbers[index];
              for(var k = 0; k < j; k++) {
                L.numbers[index] = L.numbers[index] - L.numbers[i + k * u32(mat.size.x)] * U.numbers[k + j * u32(mat.size.x)];
              }
              L.numbers[index] = L.numbers[index] / U.numbers[j + j * u32(mat.size.x)];
            }
        }
      }
    }    
    `;
  },
  // main: (name) => {
  //   if ()
  // }
};
