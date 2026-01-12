# Flow Accumulation (WASM)

## Overview
This example demonstrates how to use the **WASM Engine** to perform high-performance grid processing for flow accumulation.

## Hydrology Context
Flow accumulation calculates the accumulated weight of all cells flowing into each downslope cell in the output raster. It is a computationally intensive, recursive operation ideal for compiled languages (C++/Rust) running via WebAssembly.

## Implementation
*Note: This example simulates the WASM call pattern as the compiled binary is not included.*

### Steps:
1.  **Data Generation**: Creates a synthetic 100x100 Digital Elevation Model (DEM).
2.  **Aggregation**: Registers the grid data.
3.  **Analysis**:
    - Invokes a WASM function `calculate_flow_accumulation`.
    - Function computes flow direction and accumulation count.
4.  **Result**: Returns the accumulation grid (highlighting streams).
