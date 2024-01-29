/**
 * @file monte_carlo_simulation.c
 * @brief Implementation of a Monte Carlo simulation for peak flow estimation.
 *
 * This program performs a Monte Carlo simulation to estimate the peak flow using a given dataset.
 * It generates random variates based on the provided data's mean and standard deviation and
 * calculates the peak flow for each simulation.
 *
 */
#include <emscripten.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <math.h>

#define DAYS_IN_YEAR 365
#define NUM_OF_SIMULATIONS 10000


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
 * @brief Calculates the mean of a given array of floats.
 *
 * @param data The input array of floats.
 * @param n The size of the array.
 * @return The mean of the array.
 */
float calculate_mean(float data[], int n) {
    float sum = 0.0;
    for (int i = 0; i < n; i++) {
        sum += data[i];
    }
    return sum / n;
}

/**
 * @brief Calculates the standard deviation of a given array of floats.
 *
 * @param data The input array of floats.
 * @param n The size of the array.
 * @param mean The mean of the array.
 * @return The standard deviation of the array.
 */
float calculate_std_dev(float data[], int n, float mean) {
    float sum = 0.0;
    for (int i = 0; i < n; i++) {
        sum += pow(data[i] - mean, 2);
    }
    return sqrt(sum / n);
}

/**
 * @brief Generates random variates based on mean and standard deviation.
 *
 * @param mean The mean for random variate generation.
 * @param std_dev The standard deviation for random variate generation.
 * @param n The number of random variates to generate.
 * @param variates An array to store the generated random variates.
 */
void generate_random_variates(float mean, float std_dev, int n, float variates[]) {
    for (int i = 0; i < n; i++) {
        float u = (float)rand() / (float)RAND_MAX;
        float z = sqrt(-2.0 * log(u)) * cos(2.0 * M_PI * u);
        float x = mean + std_dev * z;
        variates[i] = x;
    }
}

/**
 * @brief Calculates the peak flow from an array of variates.
 *
 * @param variates The array of random variates.
 * @param n The size of the array.
 * @return The calculated peak flow.
 */
float calculate_peak_flow(float variates[], int n) {
    float max_flow = 0.0;
    for (int i = 0; i < n; i++) {
        if (variates[i] > max_flow) {
            max_flow = variates[i];
        }
    }
    return max_flow;
}

/**
 * @brief Runs the Monte Carlo simulation for peak flow estimation.
 *
 * @param data The input data array.
 * @param n The size of the data array.
 * @param num_simulations The number of Monte Carlo simulations to perform.
 * @param result An array to store the results of the simulations.
 */
void run_monte_carlo_simulation(float data[], int n, int num_simulations, float result[]) {
    float mean = calculate_mean(data, n);
    float std_dev = calculate_std_dev(data, n, mean);
    float variates[DAYS_IN_YEAR];
    float peak_flow;

    for (int i = 0; i < num_simulations; i++) {
        generate_random_variates(mean, std_dev, DAYS_IN_YEAR, variates);
        peak_flow = calculate_peak_flow(variates, DAYS_IN_YEAR);
        result[i] = peak_flow;
    }
}

/**
 * @brief Entry point for the Monte Carlo simulation.
 *
 * @param data The input data array.
 * @param result An array to store the results of the simulations.
 * @param n The size of the data array.
 */
EMSCRIPTEN_KEEPALIVE
void monteCarlo_c(float *data, float *result, int n) {
    // convert data from float to double
    float result_float[NUM_OF_SIMULATIONS];
    for (int i = 0; i < NUM_OF_SIMULATIONS; i++) {
        result_float[i] = 0.0;
    }

    // run the simulation
    run_monte_carlo_simulation(data, n, NUM_OF_SIMULATIONS, result_float);

    // write the result to the result array
    for (int i = 0; i < NUM_OF_SIMULATIONS; i++) {
        result[i] = result_float[i];
    }
}
