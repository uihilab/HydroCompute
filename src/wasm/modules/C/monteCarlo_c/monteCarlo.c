#include <emscripten.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <math.h>

#define DAYS_IN_YEAR 365
#define NUM_OF_SIMULATIONS 10000

EMSCRIPTEN_KEEPALIVE
uint8_t* createMem(int size) {
	return malloc(size);
}

EMSCRIPTEN_KEEPALIVE
void destroy(uint8_t* p){
	free(p);
}

float calculate_mean(float data[], int n) {
    float sum = 0.0;
    for (int i = 0; i < n; i++) {
        sum += data[i];
    }
    return sum / n;
}

float calculate_std_dev(float data[], int n, float mean) {
    float sum = 0.0;
    for (int i = 0; i < n; i++) {
        sum += pow(data[i] - mean, 2);
    }
    return sqrt(sum / n);
}

void generate_random_variates(float mean, float std_dev, int n, float variates[]) {
    for (int i = 0; i < n; i++) {
        float u = (float)rand() / (float)RAND_MAX;
        float z = sqrt(-2.0 * log(u)) * cos(2.0 * M_PI * u);
        float x = mean + std_dev * z;
        variates[i] = x;
    }
}

float calculate_peak_flow(float variates[], int n) {
    float max_flow = 0.0;
    for (int i = 0; i < n; i++) {
        if (variates[i] > max_flow) {
            max_flow = variates[i];
        }
    }
    return max_flow;
}

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
