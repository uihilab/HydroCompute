# Integrated Catchment Workflow

## Overview
This "Big Example" demonstrates the power of HydroCompute by chaining multiple engines into a single, cohesive hydrological workflow.

## The Workflow
1.  **Input**: Raw rainfall time series and digital elevation model (DEM).
2.  **Step 1 (JavaScript)**: Calculate precipitation statistics (Mean/Max) to characterize the storm event.
3.  **Step 2 (Python)**: Smooth the resulting hydrograph to remove sensor noise and identify peak flow timing.
4.  **Step 3 (R)**: Perform Flood Frequency Analysis to determine the return period of this specific event (e.g., "Is this a 50-year flood?").
5.  **Step 4 (WASM)**: Map the flow accumulation paths to visualize where the water goes.

## Implementation
This example uses a `main.js` that orchestrates calls to different engines sequentially, passing data between steps (simulated or real). It serves as a dashboard for a complete hydrological analysis.
