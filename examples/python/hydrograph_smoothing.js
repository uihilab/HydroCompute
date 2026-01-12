import hydroCompute from '../../src/hydrocompute.js';
import { openDatabase } from '../../src/core/utils/db-utils.js';

const output = document.getElementById('output');
output.innerHTML = '';
const log = (msg) => {
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
};

// Generate a synthetic hydrograph (Gamma curve) with noise
function generateHydrograph(points = 100) {
    const data = [];
    for (let t = 0; t < points; t++) {
        // Gamma distribution shape for hydrograph
        const k = 5; // Shape
        const theta = 10; // Scale
        const flow = Math.pow(t, k - 1) * Math.exp(-t / theta);

        // Normalize and scale (Peak approx 1000 cfs)
        const baseFlow = 50;
        const scaledFlow = flow * 0.05 + baseFlow;

        // Add Gaussian noise
        const noise = (Math.random() - 0.5) * 20;

        data.push(Math.max(0, scaledFlow + noise));
    }
    return new Float32Array(data);
}

async function runSimulation() {
    try {
        log('Initializing HydroCompute...');
        const compute = new hydroCompute();

        // 1. Generate Data
        log('Generating noisy hydrograph (100 timesteps)...');
        const rawHydrograph = generateHydrograph(100);
        log('Hydrograph created. Saving to DB...');

        // 2. Register Data
        const dataId = 'streamflow_event_01';
        await compute.data({
            data: rawHydrograph,
            id: dataId
        });

        // 3. Define Python Script for Smoothing
        // We use a simple moving average implementation in pure Python 
        // (scipy is available but pure python is safer for demo speed)
        const pythonScript = `
def moving_average(data, window_size=5):
    result = []
    for i in range(len(data)):
        start = max(0, i - window_size // 2)
        end = min(len(data), i + window_size // 2 + 1)
        window = data[start:end]
        avg = sum(window) / len(window)
        result.append(avg)
    return result

# data_input[0] contains our raw hydrograph values
raw_flow = data_input[0]

# Apply smoothing
smoothed_flow = moving_average(raw_flow)

# Find peaks
raw_peak = max(raw_flow)
smooth_peak = max(smoothed_flow)
peak_time = smoothed_flow.index(smooth_peak)

# Return dictionary
{
    "smoothed_data": smoothed_flow,
    "raw_peak": raw_peak,
    "smoothed_peak": smooth_peak,
    "peak_timestep": peak_time,
    "message": "Smoothed " + str(len(raw_flow)) + " points."
}
        `;

        const scriptId = 'smoothing_script';

        // Save script manually to DB
        log('Registering Python script...');
        const db = await openDatabase('hydrocomputeDB');
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put({
            id: scriptId,
            code: pythonScript,
            language: 'python',
            timestamp: new Date().toISOString()
        });
        await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });

        // 4. Configure & Run
        await compute.setEngine('python');
        log('Engine set to: Python (Pyodide)');
        log('Running simulation...');

        await compute.run({
            functions: [[scriptId]],
            dependencies: [[[dataId]]],
            dataIds: [[[dataId]]]
        });

        // 5. Poll Results
        log('Waiting for results (Pyodide startup may take a moment)...');
        let found = false;

        // Longer timeout for Pyodide
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const results = compute.engineResults;
            const res = Object.values(results).find(r => r.message && r.message.includes('Smoothed'));

            if (res) {
                found = true;
                log('Processing Complete!');

                log(`Raw Peak Flow: ${res.raw_peak.toFixed(2)} cfs`);
                log(`Smoothed Peak Flow: ${res.smoothed_peak.toFixed(2)} cfs`);
                log(`Peak Time: t=${res.peak_timestep}`);

                const sample = res.smoothed_data.slice(0, 5).map(v => v.toFixed(1));
                log(`Smoothed Data Sample: [${sample.join(', ')} ...]`);
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
