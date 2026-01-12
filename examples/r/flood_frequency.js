import hydroCompute from '../../src/hydrocompute.js';
import { openDatabase } from '../../src/core/utils/db-utils.js';

const output = document.getElementById('output');
const resultsArea = document.getElementById('results-area');

// Logger
const log = (msg) => {
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
};

// Generate Synthetic Annual Peak Flows (Gumbel-ish distribution)
function generatePeakFlows(years = 50) {
    const data = [];
    const loc = 1000; // Location param (roughly median flood)
    const scale = 300; // Scale param (variability)

    for (let yr = 1974; yr < 1974 + years; yr++) {
        // Gumbel simulation: x = loc - scale * log(-log(u))
        const u = Math.random();
        const flow = loc - scale * Math.log(-Math.log(u));

        // CRITICAL: R worker expects Array of Objects for DataFrames
        data.push({
            year: yr,
            flow: parseFloat(flow.toFixed(1))
        });
    }
    return data;
}

async function runSimulation() {
    try {
        log('Initializing HydroCompute...');
        const compute = new hydroCompute();

        // 1. Generate Data
        log('Simulating 50 years of annual peak flow data...');
        const annualPeaks = generatePeakFlows(50);
        log(`Generated ${annualPeaks.length} records.`);
        log(`Sample: ${JSON.stringify(annualPeaks.slice(0, 2))}`);

        // 2. Register Data
        const dataId = 'peak_flows';
        await compute.data({
            data: annualPeaks,
            id: dataId
        });

        // 3. Define R Script
        // Fits a Gumbel distribution (Moments Method) and predicts return periods
        const rScript = `
# Input: data_input[[1]] is a DataFrame with 'year' and 'flow' columns

df <- data_input[[1]]
flows <- as.numeric(df$flow)

# Basic stats
n <- length(flows)
avg <- mean(flows)
std <- sd(flows)

# Gumbel Parameters (Method of Moments)
# Euler-Mascheroni constant
euler <- 0.57721

# Scale parameter (alpha)
alpha <- (std * sqrt(6)) / 3.14159

# Location parameter (u)
u <- avg - (euler * alpha)

# Predict for Return Periods (T)
T_values <- c(2, 5, 10, 25, 50, 100)

predictions <- list()

for (T in T_values) {
  # Gumbel reduced variate
  yT <- -log(-log(1 - (1/T)))
  
  # Quantile (Magnitude)
  QT <- u + (alpha * yT)
  
  predictions[[paste0("T", T)]] <- QT
}

# Return structured result
list(
  method = "Gumbel (Method of Moments)",
  parameters = list(u = u, alpha = alpha),
  estimates = predictions,
  summary = list(mean = avg, std = std, n = n),
  message = "Flood Frequency Analysis Complete"
)
        `;

        const scriptId = 'ffa_script';

        log('Saving R script to database...');
        const db = await openDatabase('hydrocomputeDB');
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put({
            id: scriptId,
            code: rScript,
            language: 'r',
            timestamp: new Date().toISOString()
        });
        await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });

        // 4. Configure & Run
        await compute.setEngine('webr');
        log('Engine set to: R (WebR)');
        log('Running Analysis (this may take a few seconds to load R)...');

        await compute.run({
            functions: [[scriptId]],
            dependencies: [[[dataId]]],
            dataIds: [[[dataId]]]
        });

        // 5. Poll Results
        let found = false;
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const results = compute.engineResults;

            // Look for result
            const resWrapper = Object.values(results).find(r => r.data && r.data.message === "Flood Frequency Analysis Complete");

            if (resWrapper) {
                found = true;
                const res = resWrapper.data;
                log('Analysis Successful!');
                console.log(res);

                // Render Table
                let html = '<table><tr><th>Return Period (Years)</th><th>Estimated Flow (cfs)</th></tr>';

                // Helper to extract cleanly
                const getEst = (key) => res.estimates[key].toFixed(0);

                html += `<tr><td>2-Year</td><td>${getEst('T2')}</td></tr>`;
                html += `<tr><td>5-Year</td><td>${getEst('T5')}</td></tr>`;
                html += `<tr><td>10-Year</td><td>${getEst('T10')}</td></tr>`;
                html += `<tr><td>25-Year</td><td>${getEst('T25')}</td></tr>`;
                html += `<tr><td>50-Year</td><td>${getEst('T50')}</td></tr>`;
                html += `<tr><td>100-Year</td><td>${getEst('T100')}</td></tr>`;
                html += '</table>';

                html += `<p><strong>Parameters:</strong> Location (u) = ${res.parameters.u.toFixed(2)}, Scale (α) = ${res.parameters.alpha.toFixed(2)}</p>`;

                resultsArea.innerHTML = html;
                break;
            }
        }

        if (!found) log('Error: Timeout waiting for results.');

    } catch (err) {
        log(`Error: ${err.message}`);
        console.error(err);
    }
}

runSimulation();
