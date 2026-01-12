# Rainfall Statistics Analysis (JavaScript)

## Overview
This example demonstrates a common hydrological task: calculating summary statistics for a precipitation time series.

## Hydrology Context
In hydrology, analyzing rainfall data is fundamental for:
- Understanding catchment behavior.
- Designing stormwater infrastructure.
- Detecting trends or anomalies (e.g., drought vs. heavy rain periods).

## Implementation
This example uses the **JavaScript Engine** to offload the statistical calculations to a background worker. It leverages the built-in `hydro.analyze.stats` module of HydroLang.

### Steps:
1.  **Data Generation**: Simulates a 10-year daily rainfall dataset (approx. 3650 points), including seasonal variations.
2.  **Aggregation**: Registers this data with the compute engine.
3.  **Analysis**: Calls `hydro.analyze.stats.basic` to compute Mean, Median, Min, Max, and Standard Deviation.
4.  **Result**: Displays the statistical summary.
