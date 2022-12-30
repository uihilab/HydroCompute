export const matrixUtils = {
  //Multiplication of 2 matrices
  matrixMul: () => {
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
  matrixAdd: () => {
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
            result = result + mat1.numbers[a] + mat2.numbers[b];
          };
  
          let index = resultCell.y + resultCell.x + u32(mat2.size.y);
          resultMatrix.numbers[index] = result;
        };
      `;
  },
};
