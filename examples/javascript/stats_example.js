import hydroCompute from '../../src/hydrocompute.js';

const output = document.getElementById('output');
output.innerHTML = '';
const log = (msg, type = 'info') => {
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    output.appendChild(div);
};

async function run() {
    try {
        log('Initializing HydroCompute...', 'info');
        const compute = new hydroCompute();

        // 1. Generate Data
        const size = 5000;
        const data = new Float32Array(size);
        for(let i=0; i<size; i++) data[i] = Math.random() * 100;
        log(`Generated random dataset of ${size} numbers.`, 'info');

        // 2. Register Data
        const dataId = 'js_stats_data';
        await compute.data({ data, id: dataId });
        log(`Data registered ID: ${dataId}`, 'info');

        // 3. Set Engine
        await compute.setEngine('javascript');
        
        // 4. Run "HydroLang" function
        log('Executing hydro.analyze.stats.basic...', 'info');
        await compute.run({
            functions: [['hydro.analyze.stats.basic']],
            dependencies: [[[dataId]]],
            dataIds: [[[dataId]]]
        });

        // 5. Poll Results
        let found = false;
        for(let i=0; i<10; i++) {
            await new Promise(r => setTimeout(r, 500));
            const results = compute.engineResults;
            if(Object.keys(results).length > 0) {
                 const res = Object.values(results)[0];
                 log('Result received!', 'success');
                 log('Output: ' + JSON.stringify(res, null, 2), 'success');
                 found = true;
                 break;
            }
        }
        if(!found) log('Timeout waiting for results.', 'error');

    } catch (err) {
        log(err.message, 'error');
        console.error(err);
    }
}

run();
