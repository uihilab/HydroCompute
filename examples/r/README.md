# Flood Frequency Analysis (R)

## Overview
This example demonstrates how to use the **R Engine** (WebR) to perform a Flood Frequency Analysis, a standard hydrological method to estimate return periods (e.g., "100-year flood").

## Hydrology Context
Hydrologists analyze annual peak streamflow data to estimate the probability of extreme events. This usually involves fitting a statistical distribution (like Gumbel or Log-Pearson Type III).

## Implementation
R is the gold standard for statistical hydrology. This example:
1.  **Data Generation**: Simulates 50 years of annual maximum flow data.
2.  **Transformation**: Converts the JavaScript data into an **Array of Objects**, which the R worker automatically converts to a DataFrame.
3.  **Analysis**:
    - Calculates the Gumbel variate for each return period (2, 5, 10, 50, 100 years).
    - Estimates flow magnitudes for these return periods.
4.  **Result**: Returns a table of estimated flood magnitudes.
