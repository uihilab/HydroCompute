/**
 * @description Collection of R analysis functions and script templates.
 * Returns a Map where keys are function names/IDs and values are R script strings or descriptions.
 * The 'main' key provides a description, while other keys (e.g., 'generic_analysis') contain
 * actual R code templates ready for execution.
 * 
 * @memberof Scripts
 * @module RScripts
 * @function rScripts
 * @returns {Map<string, string>} A map containing R script templates and metadata.
 */
export const rScripts = () => {
    return new Map([
        ['main', 'Main R execution entry point'],
        ['generic_analysis',
            `# Generic R Analysis Template
# 'data_input' contains the list of dependencies passed from HydroCompute
# Example: data1 <- data_input[[1]]

# Perform Analysis
if (length(data_input) > 0) {
  data <- data_input[[1]]
  # Simple summary stats example
  if (is.numeric(data)) {
    result <- list(
      mean = mean(data),
      sd = sd(data),
      summary = summary(data)
    )
  } else {
    result <- head(data)
  }
} else {
  result <- "No data provided"
}

# The last evaluated expression is returned as the result
result
`]
    ]);
};
