## Streamflow Forecasting Web Application
This web application is designed for streamflow forecasting analysis within different counties of Iowa. It allows users to retrieve, analyze, and visualize on-the-fly streamflow data from various data sources using a user-friendly interface.

## Features
* Data Retrieval: Users can select different data sources, counties, and stations to retrieve streamflow data using HydroLang.
* Data Analysis: The application performs various analyses including simple moving average, exponential moving average, time series autocorrelation, linear detrending, ARMA parameter calculation, etc., on the retrieved data using HydroCompute.
* Visualization: The analysis results are visualized using Google Charts through HydroLang, providing graphical representations of the forecasted streamflow data.

## Getting Started
To run this web application locally:

* Clone this repository to your local machine.
Open the index.html file in a web browser.

Note: open the Developer Tools to see outputs from the HydroCompute.
Live preview [here](https://hydroinformatics.uiowa.edu/lab/hydrosuite/hydrocompute/cs2).

## Usage
* Select Data Source: Choose from available data sources such as 'MOPEX', 'NOAA GHCN', 'Global Rivers', and 'USGS Daily Values'. Note: USGS fully functional.
* Choose County and Stations: Select a county from the dropdown menu and choose specific stations for data retrieval.
* Retrieve Data: Click on "Retrieve Stations" to initiate the data retrieval process.
View Analysis and Results: The retrieved data is analyzed and displayed under the "Analysis and Results" section.
* Visualize Results: Use the dropdowns to select specific stations and date ranges to visualize the computed results using Google Charts.

## Dependencies
* Bootstrap: CSS framework for styling the web page.
* Font Awesome: Icon toolkit for icons used in the application.
* Google Charts: Library used for data visualization.

## Contributing
Contributions to enhance features, fix bugs, or improve the user interface are welcome. Please follow the guidelines outlined in the CONTRIBUTING.md file.

## License
This project is licensed under the MIT License.