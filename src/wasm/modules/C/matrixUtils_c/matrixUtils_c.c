/**
 * @brief Implementation of basic matrix operations for web assembly.
 *
 * This program provides basic matrix operations such as addition, multiplication,
 * and block matrix multiplication. It includes memory management functions for creating
 * and destroying memory.
 *
 */

#include <emscripten.h>
#include <sanitizer/lsan_interface.h>
#include <math.h>
#include <stdlib.h>
#include <stdint.h>

/**
 * @brief Allocates memory of a specified size.
 *
 * @param size The size of the memory to allocate.
 * @return A pointer to the allocated memory.
 */
EMSCRIPTEN_KEEPALIVE
uint8_t* createMem(int size) {
	return malloc(size);
}

/**
 * @brief Deallocates the memory pointed to by the given pointer.
 *
 * @param p A pointer to the memory to be deallocated.
 */
EMSCRIPTEN_KEEPALIVE
void destroy(uint8_t* p){
	free(p);
}

/**
 * @brief Performs matrix addition.
 *
 * @param matrix1 The first input matrix.
 * @param matrix2 The second input matrix.
 * @param result The matrix to store the addition result.
 * @param size The size of the matrices.
 */
EMSCRIPTEN_KEEPALIVE
void matrixAddition_c(float *matrix1, float *matrix2, float* result, int size) {
  for (int i = 0; i < size; i++) {
    result[i] = matrix1[i] + matrix2[i];
  }
}

/**
 * @brief Performs matrix multiplication.
 *
 * @param matrix1 The first input matrix.
 * @param matrix2 The second input matrix.
 * @param result The matrix to store the multiplication result.
 * @param size The size of the matrices.
 */
EMSCRIPTEN_KEEPALIVE
void matrixMultiply_c(float* matrix1, float* matrix2, float* result, int size) {
    for (int i = 0; i < size; i++) {
        for (int j = 0; j < size; j++) {
            result[i * size + j] = 0.0;
            for (int k = 0; k < size; k++) {
                result[i * size + j] += matrix1[i * size + k] * matrix2[k * size + j];
            }
        }
    }
}

/**
 * @brief Performs block matrix multiplication.
 *
 * @param matrixA The first input matrix.
 * @param matrixB The second input matrix.
 * @param matrixC The matrix to store the multiplication result.
 * @param length The size of the matrices.
 * @param blockSize The size of each block in the block matrix multiplication.
 */
EMSCRIPTEN_KEEPALIVE
void bmm(float* matrixA, float* matrixB, float* matrixC, int length, int blockSize) {
  int block = blockSize * (length/blockSize);
  double sum;
  for (int kk = 0; kk < block; kk += blockSize) {
    for (int jj = 0; jj < block; jj += blockSize) {
      for (int i = 0; i < length; i++) {
        for (int j = jj; j < jj + blockSize; j++) {
		  sum = 0.0;
          matrixC[i * length + j] = 0.0;
          for (int k = kk; k < kk + blockSize; k++) {
            sum += matrixA[i * length + k] * matrixB[k * length + j];
          }
          matrixC[i * length + j] += sum;
        }
      }
    }
  }
}
