# R Scripting Module

This module enables the execution of R scripts mainly using [WebR](https://docs.r-wasm.org/webr/latest/) that runs entirely in the browser using WebAssembly.

## Features

- **Full R Environment**: Execute standard R code with support for variables, functions, and data structures.
- **Data Integration**: Seamlessly pass data from JavaScript/HydroCompute to R strings/vectors.
  - Input data is available as `data_input` (list or vector).
- **Library Support**: Dynamically load R packages from CRAN (WebR-compatible).
- **Persistent Storage**: Results and scripts are stored in IndexedDB for offline access.

## Usage

### 1. Writing R Scripts

R scripts should be written as standard R code. The input data passed from HydroCompute is available in the global variable `data_input`.

**Important**: The script must return the final result as the last expression.

```r
# Example: Calculate summary statistics for a data frame
# data_input[[1]] is a DataFrame-like list with columns 'value' and 'id'

# Access the 'value' column
values <- as.numeric(data_input[[1]]$value)

# Perform calculations
avg <- mean(values)
total <- sum(values)

# Return a list as the result
list(
  average = avg,
  sum = total,
  message = "Calculation complete"
)
```

### 2. Configuration

When setting up an R task, provides the following:

- **Script ID**: A unique identifier for the script.
- **Code**: The R source code.
- **Libraries**: Array of package names to load (e.g., `['dplyr', 'ggplot2']`).

### 3. Data Handling

- **Input (`data_input`)**:
  - `data_input` is always a **list** containing the dependencies.
  - `data_input[[1]]` accesses the first dependency results.
  - **IMPORTANT**: For tabular data (Data Frames), the input JavaScript data **MUST** be an **Array of Objects** (e.g., `[{ col1: 1, col2: 'a' }, { col1: 2, col2: 'b' }]`).
    - The worker automatically converts this "row-oriented" format into a columnar Named List for R (`list(col1=c(1,2), col2=c('a','b'))`), allowing access via `$`.
    - Example: `val <- data_input[[1]]$col1`
  - Simple arrays (e.g., `[1, 2, 3]`) are passed as atomic vectors.

- **Output**:
  - The return value of the script is automatically converted back to JavaScript objects.
  - R Lists -> JS Objects
  - R Vectors -> JS Arrays/TypedArrays

## Dependencies & Worker

The R execution happens in a dedicated Web Worker (`R/webr.worker.js`) to prevent blocking the main thread. It communicates via the standard HydroCompute message passing interface.

**File Structure:**
- `webr.worker.js`: Main worker entry point.
- `rScripts.js`: Utility for managing script persistence.
