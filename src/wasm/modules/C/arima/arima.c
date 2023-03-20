#include <emscripten.h>
#include <math.h>
#include <stdlib.h>
#include <stdint.h>

EMSCRIPTEN_KEEPALIVE
uint8_t* createMem(int size) {
	return malloc(size);
}

EMSCRIPTEN_KEEPALIVE
void destroy(uint8_t* p){
	free(p);
}

EMSCRIPTEN_KEEPALIVE
// autoupdate parameter ARMA model
void arima(float *data, float *prediction, int n) {
	int MAX_ITERATIONS = 1000;
	float TOLERANCE = 1e-6;
    // Initial guesses for model parameters
    float phi = 0.5; // AR coefficient
    float theta = 0.2; // MA coefficient
    float mu = 0.0; // Mean

    // Maximum likelihood estimation to update model parameters
    for (int iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        float prev_phi = phi;
        float prev_theta = theta;
        float prev_mu = mu;
        float sum_error = 0.0;
        float sum_error_sq = 0.0;
        float sum_error_cub = 0.0;
        float sum_error_quad = 0.0;
        float sum_x = 0.0;
        float sum_xy = 0.0;
        float sum_x_sq = 0.0;
        float sum_y = 0.0;
        float sum_y_sq = 0.0;

        // Compute errors and accumulate statistics
        for (int i = 1; i < n; i++) {
            float error = data[i] - mu - phi * data[i-1] - theta * (data[i-1] - mu);
            sum_error += error;
            sum_error_sq += error * error;
            sum_error_cub += error * error * error;
            sum_error_quad += error * error * error * error;
            sum_x += data[i-1];
            sum_xy += data[i-1] * error;
            sum_x_sq += data[i-1] * data[i-1];
            sum_y += error;
            sum_y_sq += error * error;
        }

        // Update model parameters
        mu = sum_error / (n - 1);
        phi = sum_xy / (sum_x_sq + sum_error_sq);
        theta = (sum_error - phi * sum_xy) / (n - 1 - sum_y_sq / sum_error_sq);

        // Check for convergence
        float diff_phi = phi - prev_phi;
        float diff_theta = theta - prev_theta;
        float diff_mu = mu - prev_mu;
        float diff_norm = sqrt(diff_phi * diff_phi + diff_theta * diff_theta + diff_mu * diff_mu);
        if (diff_norm < TOLERANCE) {
            break;
        }
    }

    // Make predictions
    for (int i = 1; i < n; i++) {
        float error = data[i] - mu - phi * data[i-1] - theta * (data[i-1] - mu);
        prediction[i] = mu + phi * data[i-1] + theta * error;
    }
}


EMSCRIPTEN_KEEPALIVE
// total autocorrelation function
void acf(float *data, float *result, int n) {
    int i, j;
    float mean = 0, var = 0;

    // Compute mean and variance of the data
    for (i = 0; i < n; i++) {
        mean += data[i];
    }
    mean /= n;
    for (i = 0; i < n; i++) {
        var += (data[i] - mean) * (data[i] - mean);
    }
    var /= n;

    // Compute autocorrelation function
    for (i = 0; i < n; i++) {
        float ac = 0;
        for (j = i; j < n; j++) {
            ac += (data[j] - mean) * (data[j - i] - mean);
        }
        result[i] = ac / ((n - i) * var);
    }
    
    // Adjust the first element of the result array
    result[0] /= 2;
}

EMSCRIPTEN_KEEPALIVE
// partial autocorrelation function with max lag of 75
void pacf(float* data, float* pacf_values, int n) {
	int max_lag = 75;
    float phi[max_lag + 1];
    float psi[max_lag + 1];
    float gamma[max_lag + 1];
    
    // Initialize phi and psi arrays
    for (int i = 0; i <= max_lag; i++) {
        phi[i] = 0;
        psi[i] = 0;
        gamma[i] = 0;
    }
    
    // Compute autocorrelation function
    for (int k = 1; k <= max_lag; k++) {
        for (int i = k; i < n; i++) {
            phi[k] += data[i] * data[i-k];
            psi[k] += data[i-k] * data[i-k];
        }
        phi[k] /= (n - k);
        psi[k] /= (n - k);
    }
    
    // Durbin-Levinson algorithm
    pacf_values[0] = 1.0;
    for (int k = 1; k <= max_lag; k++) {
        gamma[k] = phi[k];
        for (int j = 1; j < k; j++) {
            gamma[k] -= phi[j] * pacf_values[k-j];
        }
        pacf_values[k] = gamma[k] / sqrt(psi[k]);
    }
}

EMSCRIPTEN_KEEPALIVE
void boxcox_transform(float* data, float* result, int n) {
	float lambda = 0.5;
    // Iterate over each data point
    for (int i = 0; i < n; i++) {
        if (lambda == 0) {
            // Handle case where lambda is zero (log transform)
            result[i] = log(data[i]);
        } else {
            // Compute Box-Cox transformation
            result[i] = (pow(data[i], lambda) - 1) / lambda;
        }
    }
}






