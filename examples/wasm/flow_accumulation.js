import hydroCompute from '../../src/hydrocompute.js';

const output = document.getElementById('output');
const demCanvas = document.getElementById('demCanvas');
const flowCanvas = document.getElementById('flowCanvas');

const log = (msg) => {
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
};

// Visualize Grid on Canvas
function drawGrid(canvas, data, width, height, colorScale) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);

    // Normalize properties
    let min = Infinity, max = -Infinity;
    for (let v of data) {
        if (v < min) min = v;
        if (v > max) max = v;
    }
    const range = max - min || 1;

    // Nearest neighbor scaling (200px canvas / 100px grid = 2x scale)
    // Actually we'll just draw 1:1 on 200x200 canvas (lots of space) or scale it.
    // Let's manually draw scaled rects for visibility.
    const scale = canvas.width / width;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const val = data[y * width + x];
            const norm = (val - min) / range;

            let r, g, b;
            if (colorScale === 'terrain') {
                // Simple terrain ramp (green -> brown -> white)
                r = Math.floor(norm * 255);
                g = Math.floor((1 - norm) * 255);
                b = Math.floor(norm * 50);
            } else {
                // Blue ramp for flow
                // Log scale for flow usually better
                const flowNorm = Math.min(1, Math.log(val + 1) / Math.log(max + 1));
                r = 0;
                g = Math.floor(flowNorm * 100);
                b = Math.floor(flowNorm * 255);
            }

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x * scale, y * scale, scale, scale);
        }
    }
}

// Generate centered hill (cone) DEM
function generateDEM(size = 100) {
    const data = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Cone shape centered at 50,50
            const dx = x - 50;
            const dy = y - 50;
            const dist = Math.sqrt(dx * dx + dy * dy);
            data[y * size + x] = 100 - dist;
        }
    }
    return data;
}

async function runSimulation() {
    try {
        log('Initializing HydroCompute...');
        const compute = new hydroCompute();

        const gridSize = 100;
        log(`Generating ${gridSize}x${gridSize} Digital Elevation Model...`);
        const demData = generateDEM(gridSize);

        drawGrid(demCanvas, demData, gridSize, gridSize, 'terrain');

        // 2. Register Data
        const dataId = 'dem_grid';
        await compute.data({
            data: demData,
            id: dataId
        });

        // 3. Configure WASM Engine
        await compute.setEngine('wasm');
        log('Engine set to: WASM');

        // 4. Run Analysis
        // NOTE: Since we don't not have a compiled 'flow_accumulation.wasm' file, 
        // the attempt to run 'accumulate_flow' will eventually fail or return nothing in this demo environment.
        // HOWEVER, to demonstrate the successful *workflow pattern* for the user, 
        // we will *mock* the successful return if the actual call fails (which it likely will without the binary).

        log('Dispatching grid to WASM worker...');

        try {
            await compute.run({
                functions: [['accumulate_flow']],
                dependencies: [[[dataId]]],
                dataIds: [[[dataId]]]
            });
        } catch (e) {
            log('Notice: Mocking result (WASM binary missing in demo).');
        }

        // --- MOCKING THE RESULT FOR DEMONSTRATION ---
        // A real flow acc on a cone flows from center (high) to edges (low).
        // Actually, flow accumulation goes DOWNSLOPE.
        // On a cone (peak in center), flow goes OUTWARD.
        // So center cells have flow=1 (rain), edges have high flow.

        // Let's generate a "fake" result to visualize 
        // mimicking what the WASM would return.
        await new Promise(r => setTimeout(r, 1000)); // Fake processing time

        const mockFlow = new Float32Array(gridSize * gridSize);
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                // Outward flow simulation: Area ~ Radius^2 ??
                const dx = x - 50;
                const dy = y - 50;
                const dist = Math.sqrt(dx * dx + dy * dy);
                // Fake accumulation increasing with distance from center
                mockFlow[y * gridSize + x] = 1 + (dist * 2);
            }
        }

        log('Analysis Complete (Simulated)!');
        drawGrid(flowCanvas, mockFlow, gridSize, gridSize, 'water');

        log(`Max Flow Accumulation: ${Math.max(...mockFlow).toFixed(0)} cells`);

    } catch (err) {
        log(`Error: ${err.message}`);
        console.error(err);
    }
}

runSimulation();
