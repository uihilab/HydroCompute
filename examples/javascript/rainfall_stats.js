import hydroCompute from '../../src/hydrocompute.js';

// UI Helper
const output = document.getElementById('output');
output.innerHTML = '';
const log = (msg, type = 'info') => {
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
};

// Simulate realistic rainfall data (mm)
// Zero-inflated (many dry days) with some storm events
function generateRainfallData(years = 10) {
    const days = years * 365;
    const data = new Float32Array(days);

    for (let i = 0; i < days; i++) {
        // Simple seasonality: Wetter in the middle of "year"
        const dayOfYear = i % 365;
        const seasonFactor = 1 + 0.5 * Math.sin((dayOfYear / 365) * 2 * Math.PI);

        // Probability of rain today (0.3 base)
        if (Math.random() < 0.3 * seasonFactor) {
            // Gamma-like distribution for amount
            // Most rains are light (<10mm), rare storms (>50mm)
            data[i] = -Math.log(Math.random()) * 10 * seasonFactor;
        } else {
            data[i] = 0;
        }
    }
    return data;
}

async function runSimulation() {
    try {
        log('Initializing HydroCompute core...', 'info');
        const compute = new hydroCompute();

        // 1. Generate Data
        log('Generating 10-year synthetic rainfall record...', 'info');
        const rainfallData = generateRainfallData(10);
        log(`Created time series with ${rainfallData.length} daily records.`, 'info');

        // Show a few samples
        const sample = Array.from(rainfallData.slice(0, 5)).map(v => v.toFixed(1));
        log(`First 5 days (mm): [${sample.join(', ')} ...]`, 'info');

        // 2. Register Data
        const dataId = 'precip_10yr';
        await compute.data({
            data: rainfallData,
            id: dataId
        });
        log(`Data registered ID: ${dataId}`, 'info');

        // 3. Set Engine (JavaScript / HydroLang)
        await compute.setEngine('javascript');
        log('Engine set to: JavaScript (HydroLang Native)', 'info');

        // 4. Run Analysis
        log('Dispatching statistical analysis to worker...', 'info');

        // We use the 'hydro.analyze.stats.basic' function available in the library
        await compute.run({
            functions: [['hydro.analyze.stats.basic']],
            dependencies: [[[dataId]]],
            dataIds: [[[dataId]]]
        });

        // 5. Poll for Results
        log('Waiting for computation...', 'info');
        let resultFound = false;

        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 500));
            const results = compute.engineResults;

            // Check if any results derived from our dataId exist or just grab the recent one
            if (Object.keys(results).length > 0) {
                const res = Object.values(results)[0];
                if (res) {
                    resultFound = true;
                    log('Analysis Complete!', 'success');

                    // Format output
                    const stats = res; // The function returns the stats object directly

                    // Note: Depending on implementation, it might be in res.data or res directly
                    // Let's inspect
                    console.log('Results:', stats);

                    const prettyStats = JSON.stringify(stats, (key, val) => {
                        return (typeof val === 'number' && !Number.isInteger(val)) ? parseFloat(val.toFixed(2)) : val;
                    }, 2);

                    log('Statistical Summary (mm/day):', 'success');

                    const displayDiv = document.createElement('pre');
                    displayDiv.style.color = '#27ae60';
                    displayDiv.textContent = prettyStats;
                    output.appendChild(displayDiv);
                    break;
                }
            }
        }

        if (!resultFound) {
            log('Timeout: No results received from worker.', 'error');
        }

    } catch (err) {
        log(`Simulation Failed: ${err.message}`, 'error');
        console.error(err);
    }
}

runSimulation();
