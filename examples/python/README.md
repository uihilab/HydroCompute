# Hydrograph Smoothing (Python)

## Overview
This example demonstrates how to process noisy hydrograph data (streamflow vs. time) using Python's numerical capabilities via Pyodide.

## Hydrology Context
Raw streamflow data from sensors often contains noise (due to turbulence, sensor error, or debris). Smoothing is a critical pre-processing step before analyzing peaks or total discharge volume.

## Implementation
This example uses the **Python Engine** (Pyodide) to apply a Moving Average filter to smooth the hydrograph.

### Steps:
1.  **Data Generation**: Simulates a synthetic storm hydrograph with added Gaussian noise.
2.  **Aggregation**: Registers the noisy data with the compute engine.
3.  **Analysis**: Executes a custom Python script that:
    - Calculates a 5-point moving average.
    - Identifies the peak flow (before and after smoothing).
4.  **Result**: Returns the smoothed data and peak flow comparison.
