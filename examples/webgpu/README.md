# Spatial Precipitation Modeling (WebGPU)

## Overview
This example demonstrates how to use the **WebGPU Engine** for massively parallel spatial simulations.

## Hydrology Context
Modelling precipitation over a large catchment (e.g., thousands of grid cells) requires high computational throughput. WebGPU allows simulating rainfall fields, infiltration, and runoff generation in parallel for every cell.

## Implementation
*Note: This example simulates the WebGPU call pattern as custom WGSL shaders aren't loaded in this demo.*

### Steps:
1.  **Data Generation**: Creates a large spatial field (e.g., 256x256 grid) representing soil saturation.
2.  **Aggregation**: Registers the grid data.
3.  **Analysis**:
    - Invokes a WebGPU kernel `calculate_runoff`.
    - Function would apply the Green-Ampt infiltration model in parallel for every cell.
4.  **Result**: Returns the runoff grid.
