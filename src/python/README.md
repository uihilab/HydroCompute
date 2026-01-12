## Python Engine
### Introduction
This engine enables execution of Python code blocks using Pyodide, which compiles CPython to WebAssembly. This allows Python code to run directly in the browser without requiring server-side infrastructure.

### Set Up
Upon initialization of the HydroCompute instance, the Python engine is automatically registered and available. To use it, set the engine type to 'python' when creating a code block item in the Analysis section.

### Architecture
The Python engine follows the same modular pattern as other engines:
- **python.worker.js**: Main worker script that loads Pyodide and executes Python code
- **db-config.js**: Database configuration for storing settings and results
- Integration with hydrocompute pipeline through threadEngine.js

### Usage
1. Drag a "Code Block" item from the Analysis section to the canvas
2. Double-click the Code Block to open the code editor
3. Select "Python" as the language
4. Write your Python code in the editor
5. Select data sources (dependencies) from other workflow items
6. Save and execute the workflow

### Python Code Execution
Python code is executed in a web worker using Pyodide. The execution flow:
1. Worker receives execution context with uniqueId
2. Worker retrieves Python code from IndexedDB settings
3. Worker initializes Pyodide (lazy-loaded, cached per worker instance)
4. Worker retrieves dependency data from IndexedDB
5. Worker converts JavaScript data to Python format using `toPy()`
6. Worker executes Python code using `pyodide.runPython()`
7. Worker converts Python result back to JavaScript using `toJs()`
8. Worker stores result in IndexedDB
9. Worker posts completion status to main thread

### Data Conversion
- JavaScript objects/arrays → Python dicts/lists via `pyodide.toPy()`
- Python results → JavaScript objects via `pyodide.toJs()`
- NumPy arrays are automatically handled by Pyodide
- Data is passed to Python code as the global `data` variable

### Package Management
Pyodide includes many pre-bundled scientific packages:
- NumPy
- Pandas
- Matplotlib
- SciPy
- And more...

To install additional packages, you can use micropip in your Python code:
```python
import micropip
await micropip.install('package-name')
```

### Performance Considerations
- Initial Pyodide load: ~7-10MB download, 2-5 seconds initialization
- Pyodide instance is cached per worker (persists for worker lifetime)
- Execution is ~1.5-3x slower than native Python
- Memory usage is higher than JavaScript execution

### Error Handling
Python exceptions are caught and converted to JavaScript errors, then posted back to the main thread with status updates.

### Integration
The Python engine integrates seamlessly with the existing hydrocompute pipeline:
- Same execution context format
- Same IndexedDB storage pattern
- Same dependency resolution
- Same status reporting via event bus





