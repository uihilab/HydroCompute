import hydroCompute from '../../src/hydrocompute.js';

const output = document.getElementById('output');
const soilCanvas = document.getElementById('soilCanvas');
const runoffCanvas = document.getElementById('runoffCanvas');

const log = (msg) => {
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
};

function drawGrid(canvas, data, width, height, scheme) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(width, height);

    // Auto-range
    let min = Infinity, max = -Infinity;
    for (let v of data) {
        if (v < min) min = v;
        if (v > max) max = v;
    }
    const range = max - min || 1;

    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        const norm = (val - min) / range;

        let r, g, b;
        if (scheme === 'soil') {
            // Brown scale (dry -> wet)
            // Dry (low sat) = light tan, Wet (high sat) = dark brown
            const light = [245, 222, 179];
            const dark = [101, 67, 33];
            r = light[0] + norm * (dark[0] - light[0]);
            g = light[1] + norm * (dark[1] - light[1]);
            b = light[2] + norm * (dark[2] - light[2]);
        } else {
            // Blue scale for runoff
            r = 0;
            g = 0;
            b = Math.floor(norm * 255);
            // make 0 transparent/white
            if (val === 0) { r = 255; g = 255; b = 255; }
        }

        imgData.data[i * 4 + 0] = r;
        imgData.data[i * 4 + 1] = g;
        imgData.data[i * 4 + 2] = b;
        imgData.data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
}

// Generate fractal-like noise for soil saturation
function generateSoilMap(size = 256) {
    const data = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Simple Perlin-ish noise approximation
            const nx = x / 30;
            const ny = y / 30;
            const val = Math.sin(nx) * Math.cos(ny) + Math.sin(nx * 2 + ny * 3) * 0.5;
            // Normalize to 0-1 (Saturation)
            data[y * size + x] = Math.max(0, Math.min(1, (val + 1.5) / 3));
        }
    }
    return data;
}

async function runSimulation() {
    try {
        if (!navigator.gpu) {
            log('Notice: WebGPU not supported in this browser. Mocking behavior.');
        }

        log('Initializing HydroCompute...');
        const compute = new hydroCompute();

        const gridSize = 256;
        log(`Generating ${gridSize}x${gridSize} Soil Saturation Map...`);
        const soilData = generateSoilMap(gridSize);

        drawGrid(soilCanvas, soilData, gridSize, gridSize, 'soil');

        // 2. Register Data
        const dataId = 'soil_grid';
        await compute.data({
            data: soilData,
            id: dataId
        });

        // 3. Configure WebGPU Engine
        await compute.setEngine('webgpu');
        log('Engine set to: WebGPU');

        // 4. Run Analysis
        log('Dispatching parallel runoff calculation...');

        try {
            await compute.run({
                functions: [['calculate_runoff']],
                dependencies: [[[dataId]]],
                dataIds: [[[dataId]]]
            });
        } catch (e) {
            log('Notice: Mocking result (Custom shader missing).');
        }

        // --- MOCKING THE RESULT ---
        // Runoff occurs where saturation > 0.8 (simple model)
        await new Promise(r => setTimeout(r, 800)); // Processing time

        const mockRunoff = new Float32Array(gridSize * gridSize);
        let totalRunoff = 0;

        for (let i = 0; i < mockRunoff.length; i++) {
            const sat = soilData[i];
            const rain = 0.5; // Uniform rain

            // Green-Ampt simplified: if sat high, less infiltration -> more runoff
            const infiltration = (1 - sat) * 0.8;
            const runoff = Math.max(0, rain - infiltration);

            mockRunoff[i] = runoff;
            if (runoff > 0) totalRunoff += runoff;
        }

        log('Analysis Complete (Simulated)!');
        drawGrid(runoffCanvas, mockRunoff, gridSize, gridSize, 'water');

        log(`Total Runoff Volume: ${totalRunoff.toFixed(1)} units`);

    } catch (err) {
        log(`Error: ${err.message}`);
        console.error(err);
    }
}

runSimulation();
