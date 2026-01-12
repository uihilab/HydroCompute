//CHANGE!!!!!
// eventBus import removed

/**
 * @description Main class for managing threads. Results and execution time are saved here
 * @property engine - name of the engine
 * @property workerLocation - location of the worker running the engine
 * @property workerThreads - holder for all the worker threads
 * @property maxWorkerCount - maximum workers on the browser Leave it at least 1 less than all the available.
 * @property results - holder of the results once finished
 * @class threadManager
 * @param {string} name - The name of the thread manager.
 * @param {string} location - The location of the worker script file.
 */
export default class threadManager {
  constructor(name, location, externLib, eventBus = null) {
    if (!window.Worker) {
      console.error("Web workers API not supported!");
    }
    this.engine = name;
    this.workerLocation = location;
    this.externLib = externLib;

    // Internal events
    this._events = {};

    // External event bus
    this.eventBus = eventBus;

    // CRITICAL: Track all active worker instances for termination
    this.activeWorkers = new Map(); // Map<workerInstance, {index, args, resolve, reject}>
    this.isStopped = false; // Flag to prevent new executions after stop
    this.resetWorkers();
  }

  //CHANGE!!
  on(event, callback) {
    this._events[event] = this._events[event] || [];
    this._events[event].push(callback);
  }

  emit(event, data) {
    // Internal listeners
    if (this._events[event]) {
      this._events[event].forEach(callback => callback(data));
    }

    // Propagate to external event bus
    if (this.eventBus) {
      this.eventBus.emit(event, data);
    }
  }

  /**
   * @memberof threadManager
   * @description Holder for the workers created by the class. It creates an object that contains the workers defined
   * by the execution context holding the execution time of each thread and the worker itself.
   * @param {Number} number - number of thread to run
   */
  createWorkerThread(number) {
    this.workerThreads[number] = {
      worker: undefined,
      functionTime: 0,
      workerTime: 0,
    };
  }

  async executeWithDag(dag) {
    // CRITICAL: Reset stop flag at start of execution to allow rerunning after stop
    this.isStopped = false;

    const executing = new Set();
    const completed = new Set();
    const executionPromises = new Map(); // Track promises for executing functions

    // Helper function to check and start all available functions
    const checkAndStartAvailable = async () => {
      // CRITICAL: Check if execution was stopped
      if (this.isStopped) {
        return [];
      }

      const promises = [];

      // Check all functions to see which ones can run
      for (let i = 0; i < dag.totalCount; i++) {
        // Skip if already executing or completed
        if (executing.has(i) || completed.has(i)) {
          continue;
        }

        // CRITICAL: Check if execution was stopped before starting new workers
        if (this.isStopped) {
          break;
        }

        // Check if this function can execute
        const executeStatus = await dag.canExecute(i);
        const canRun = executeStatus.canRun || false;

        // Prevent duplicate execution of the same uniqueId (same item) at the same time
        // This can happen if multiple triggers fire for the same code block
        if (canRun) {
          const context = dag.getExecutionContext(i);
          const uid =
            context.uniqueId ||
            (context.funcName && context.funcName.id) ||
            (context.funcName && context.funcName.uniqueId) ||
            null;
          if (uid) {
            if (executing.has(uid)) {
              // Already executing this item; skip to avoid duplicate worker
              console.warn(`Skipping duplicate execution for item ${uid}`);
              continue;
            }
          }
        }

        if (canRun) {
          // Respect maxWorkerCount limit
          if (executing.size >= this.maxWorkerCount) {
            break; // Wait for some to complete before starting more
          }

          // Track execution by index and by uniqueId (if present)
          executing.add(i);
          const context = dag.getExecutionContext(i);
          const uid =
            context.uniqueId ||
            (context.funcName && context.funcName.id) ||
            (context.funcName && context.funcName.uniqueId) ||
            null;
          if (uid) {
            executing.add(uid);
          }

          // Get execution context and run in worker
          // (context already retrieved above)

          // Create a promise that handles completion
          const executionPromise = this.workerThreads[i].worker(context)
            .then((result) => {
              executing.delete(i);
              if (uid) {
                executing.delete(uid);
              }
              completed.add(i);
              executionPromises.delete(i);

              return result;
            })
            .catch((error) => {
              executing.delete(i);
              if (uid) {
                executing.delete(uid);
              }
              executionPromises.delete(i);
              console.error(`Error in worker ${i}:`, error);
              throw error;
            });

          executionPromises.set(i, executionPromise);
          promises.push(executionPromise);
        }
      }

      return promises;
    };

    // Main execution loop with deadlock detection
    // CRITICAL: Detect deadlock when no items can run AND dependencies are definitively blocked
    let lastCompletedCount = completed.size;
    let noProgressIterations = 0;
    const maxNoProgressIterations = 5; // Allow a few iterations with no progress (in case items are still running)
    const MAX_ITERATIONS = 10000; // Prevent infinite loops
    const TIMEOUT_MS = 600000; // 10 minutes total timeout
    let iterationCount = 0;
    const startTime = Date.now();

    while (completed.size < dag.totalCount && !this.isStopped) {
      iterationCount++;

      // CRITICAL: Prevent infinite loops
      if (iterationCount > MAX_ITERATIONS) {
        console.error(`[threadEngine] Maximum iterations (${MAX_ITERATIONS}) reached - terminating to prevent memory overflow`);
        // Terminate all remaining items
        for (let i = 0; i < dag.totalCount; i++) {
          if (!completed.has(i)) {
            try {
              const context = dag.getExecutionContext(i);
              if (context && context.uniqueId) {
                this.emit('itemStatus', {
                  itemId: context.uniqueId,
                  status: 'error',
                  error: 'Execution timeout: Maximum iterations reached'
                });
              }
            } catch (e) {
              // Ignore errors when terminating
            }
            completed.add(i);
          }
        }
        break;
      }

      // CRITICAL: Check timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.error(`[threadEngine] Execution timeout (${TIMEOUT_MS}ms) - terminating to prevent memory overflow`);
        // Terminate all remaining items
        for (let i = 0; i < dag.totalCount; i++) {
          if (!completed.has(i)) {
            try {
              const context = dag.getExecutionContext(i);
              if (context && context.uniqueId) {
                this.emit('itemStatus', {
                  itemId: context.uniqueId,
                  status: 'error',
                  error: 'Execution timeout: Time limit exceeded'
                });
              }
            } catch (e) {
              // Ignore errors when terminating
            }
            completed.add(i);
          }
        }
        break;
      }
      // Start all available functions
      await checkAndStartAvailable();

      // If stopped, break out of loop
      if (this.isStopped) {
        this.killAllWorkers();
        break;
      }

      // If we have functions executing, wait for at least one to complete
      if (executionPromises.size > 0) {
        await Promise.race(Array.from(executionPromises.values()));
        lastCompletedCount = completed.size;
        noProgressIterations = 0; // Reset counter on progress
        // After a function completes, immediately check for new available functions
        continue;
      }

      // If no functions are executing, check for deadlock
      if (executionPromises.size === 0 && completed.size < dag.totalCount) {
        // Check all remaining items to see why they can't run
        const blockedItems = [];
        const waitingItems = [];

        for (let i = 0; i < dag.totalCount; i++) {
          if (completed.has(i) || executing.has(i)) {
            continue;
          }

          const executeStatus = await dag.canExecute(i);

          if (executeStatus.blockedDeps && executeStatus.blockedDeps.length > 0) {
            // Item is definitively blocked - dependency has failed/terminated
            blockedItems.push({ index: i, blockedDeps: executeStatus.blockedDeps });
          } else {
            // Item is waiting (dependency not ready yet, but might resolve)
            waitingItems.push(i);
          }
        }

        // If we have blocked items, terminate them immediately
        if (blockedItems.length > 0) {
          console.error(`[threadEngine] Deadlock detected: ${blockedItems.length} items blocked by failed dependencies. Terminating.`);
          for (const { index, blockedDeps } of blockedItems) {
            try {
              const context = dag.getExecutionContext(index);
              const itemId = context.uniqueId;
              const depReasons = blockedDeps.map(d => `${d.depId} (${d.reason})`).join(', ');

              if (itemId) {
                this.emit('itemStatus', {
                  itemId: itemId,
                  status: 'error',
                  error: `Dependency(ies) failed or terminated: ${depReasons}`
                });
              }
              completed.add(index); // Mark as completed (terminated)
            } catch (e) {
              console.error(`Error getting context for blocked item ${index}:`, e);
              completed.add(index); // Still mark as completed to avoid infinite loop
            }
          }
          // Continue loop to check remaining items
          continue;
        }

        // Check for circular dependencies among waiting items
        if (waitingItems.length > 0 && waitingItems.length === dag.totalCount - completed.size) {
          // All remaining items are waiting - check for circular dependency
          const waitingContexts = await Promise.all(
            waitingItems.map(async (i) => {
              try {
                const context = dag.getExecutionContext(i);
                return { index: i, uniqueId: context.uniqueId, dependencies: context.dependencies || [] };
              } catch (e) {
                return { index: i, uniqueId: null, dependencies: [] };
              }
            })
          );

          // Build dependency graph and detect cycles
          const waitingItemIds = new Set(waitingContexts.map(c => c.uniqueId).filter(id => id));
          const hasCircularDependency = waitingContexts.some(({ uniqueId, dependencies }) => {
            if (!uniqueId) return false;
            // Check if any of this item's dependencies depends back on this item or another waiting item
            return dependencies.some(depId => {
              if (!waitingItemIds.has(depId)) return false;
              // Check if depId's dependencies include uniqueId (direct cycle)
              const depContext = waitingContexts.find(c => c.uniqueId === depId);
              return depContext && depContext.dependencies.includes(uniqueId);
            });
          });

          if (hasCircularDependency) {
            console.error(`[threadEngine] Circular dependency detected among ${waitingItems.length} waiting items. Terminating cycle.`);
            for (const { index, uniqueId } of waitingContexts) {
              if (uniqueId) {
                this.emit('itemStatus', {
                  itemId: uniqueId,
                  status: 'error',
                  error: 'Circular dependency detected - dependencies form a cycle'
                });
              }
              completed.add(index); // Mark as completed (terminated)
            }
            // Continue loop - all circular items are now terminated
            continue;
          }
        }

        // No progress for several iterations - but items might still be running externally
        if (completed.size === lastCompletedCount) {
          noProgressIterations++;
          // Only wait if we have items that are still potentially waiting (not blocked)
          if (noProgressIterations >= maxNoProgressIterations && waitingItems.length === 0) {
            // No items executing, no items waiting, but not all completed
            // This shouldn't happen, but break to avoid infinite loop
            console.error(`[threadEngine] Execution stalled: ${completed.size}/${dag.totalCount} completed, but no items are executable or waiting. Terminating remaining items.`);
            // Terminate all remaining items
            for (let i = 0; i < dag.totalCount; i++) {
              if (!completed.has(i)) {
                try {
                  const context = dag.getExecutionContext(i);
                  if (context && context.uniqueId) {
                    this.emit('itemStatus', {
                      itemId: context.uniqueId,
                      status: 'error',
                      error: 'Execution stalled: No progress detected'
                    });
                  }
                } catch (e) {
                  // Ignore errors when terminating
                }
                completed.add(i);
              }
            }
            break;
          }
        } else {
          lastCompletedCount = completed.size;
          noProgressIterations = 0;
        }

        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Wait for all remaining executions to complete (unless stopped)
    if (executionPromises.size > 0 && !this.isStopped) {
      await Promise.all(Array.from(executionPromises.values()));
    } else if (this.isStopped) {
      // If stopped, kill all workers and reject remaining promises
      this.killAllWorkers();
      throw new Error('Execution stopped by user');
    }
  }

  /**
   * @memberof threadManager
   * @description Method initializer of the threads found in the workerThread object. It attaches each of the properties into the object.
   * @param {Number} index - number of the thread.
   */
  initializeWorkerThread(index) {
    // CRITICAL: Don't reinitialize if worker function already exists
    // This prevents creating multiple workers for the same thread index
    if (this.workerThreads[index].worker && typeof this.workerThreads[index].worker === 'function') {

      return;
    }

    // CRITICAL: Create worker instance ONCE when thread is initialized, not on each call
    // Store worker instance in the thread object for reuse
    let workerInstance = null;
    let workerEngineType = null;

    this.workerThreads[index].worker = (args) => {
      return new Promise(async (resolve, reject) => {
        // CRITICAL: Check if execution was stopped before using worker
        if (this.isStopped) {
          reject(new Error('Execution stopped'));
          return;
        }

        // Determine engine type for this execution
        const engineType = args.type === 'hydrolang' ? 'javascript' :
          args.type === 'python' ? 'python' :
            args.type === 'javascript' ? 'javascript' :
              args.engine === 'python' ? 'python' :
                args.engine === 'javascript' ? 'javascript' :
                  args.type === 'wasm' ? 'wasm' :
                    this.engine || 'javascript';

        // CRITICAL: Reuse existing worker if engine type matches, otherwise create new one
        // If engine type changed, terminate old worker and create new one
        if (workerInstance && workerEngineType !== engineType) {
          try {
            workerInstance.terminate();
            this.activeWorkers.delete(workerInstance);
          } catch (e) {
            console.warn('Error terminating old worker:', e);
          }
          workerInstance = null;
        }

        // Create worker only if it doesn't exist or was terminated
        if (!workerInstance) {
          let w;
          //CRITICAL INFO: WORKER NOT EXECUTE IF THE PATH IS "TOO RELATIVE", KEEP LONG SOURCE
          // if (typeof importScripts === "function") {
          //   importScripts(this.workerLocation);
          //   w = self;
          // } else {
          if (engineType === "webgpu") {
            w = new Worker(new URL("../../src/webgpu/wgpu.worker.js", import.meta.url), {
              type: "module",
            });
          } else if (engineType === "wasm") {
            w = new Worker(new URL("../../src/wasm/wasm.worker.js", import.meta.url), {
              type: "module",
            });
          } else if (engineType === "python") {
            w = new Worker(new URL("../../src/python/python.worker.js", import.meta.url), {
              type: "module",
            });
          } else if (engineType === "webr") {
            w = new Worker(new URL("../../src/R/webr.worker.js", import.meta.url), {
              type: "module",
            });
          } else {
            w = new Worker(new URL("../../src/javascript/js.worker.js", import.meta.url), {
              type: "module",
            });
          }


          // Store worker instance and engine type for reuse
          workerInstance = w;
          workerEngineType = engineType;

          // Set up message handlers ONCE when worker is created
          // These handlers will be reused for all executions on this worker
          w.onmessage = ({ data }) => {
            let { status, results, funcExec, workerExec } = data;

            // CRITICAL: Use itemId from message first (worker sends it directly)
            // Fallback to execution context if not in message (for backwards compatibility)
            let itemUniqueId = data.itemId || null;

            // If itemId not in message, try to get from execution context
            if (!itemUniqueId) {
              const execContext = this.activeWorkers.get(w);
              if (execContext) {
                const { args: currentArgs } = execContext;
                itemUniqueId = currentArgs.uniqueId ||
                  (currentArgs.funcName && currentArgs.funcName.id) ||
                  (currentArgs.funcName && currentArgs.funcName.uniqueId) ||
                  null;
              }
            }

            if (!itemUniqueId) {
              // For status messages, we must have itemId - log warning but don't return
              // For completion messages, we need context to resolve the promise
              if (data.type === 'status') {
                console.warn('Status message received but no itemId found:', data);
                return; // Can't emit status without itemId
              }
            }

            // Handle status messages - worker sends itemId directly in message
            if (data.type === 'status' && itemUniqueId) {
              this.emit('itemStatus', {
                itemId: itemUniqueId,
                status: data.status,
                error: data.error || null
              });
              return; // Status messages don't need to resolve promises
            }

            // Also emit for completed status (even if not type='status')
            // Need execution context to resolve promise
            const execContext = this.activeWorkers.get(w);
            if (!execContext) {
              // Silently ignore - this is likely a message from a completed execution
              return;
            }

            const { args: currentArgs, resolve: currentResolve, reject: currentReject } = execContext;

            // For completion messages, ensure we have uniqueId
            if (!itemUniqueId) {
              itemUniqueId = currentArgs.uniqueId ||
                (currentArgs.funcName && currentArgs.funcName.id) ||
                (currentArgs.funcName && currentArgs.funcName.uniqueId) ||
                null;
            }

            if (data.status === 'completed') {
              // Emit status update if we have uniqueId
              if (itemUniqueId) {
                this.emit('itemStatus', {
                  itemId: itemUniqueId,
                  status: 'completed',
                  error: null
                });
              }

              // Update timing and resolve promise
              (this.workerThreads[index].functionTime += funcExec),
                (this.workerThreads[index].workerTime += workerExec);
              // CRITICAL: Don't terminate worker - reuse it for next execution
              // Only remove from active tracking, don't terminate
              this.activeWorkers.delete(w);
              currentResolve(data);
              // NOTE: Worker is NOT terminated here - it's reused for subsequent calls
            }
          };

          w.onerror = (error) => {
            // Get the current execution context
            const execContext = this.activeWorkers.get(w);
            if (execContext) {
              const { args: currentArgs, reject: currentReject } = execContext;

              // CRITICAL: Ensure uniqueId is properly extracted
              let itemUniqueId = currentArgs.uniqueId ||
                (currentArgs.funcName && currentArgs.funcName.id) ||
                (currentArgs.funcName && currentArgs.funcName.uniqueId) ||
                null;

              // CRITICAL: Remove from active workers tracking
              this.activeWorkers.delete(w);

              this.emit('itemComplete', {
                itemId: itemUniqueId,
                status: 'error',
                error: error.message
              });

              // Also emit itemStatus for consistency
              if (itemUniqueId) {
                this.emit('itemStatus', {
                  itemId: itemUniqueId,
                  status: 'error',
                  error: error.message
                });
              }

              console.error(`There was an error executing thread: ${index}`, error);
              // Don't terminate worker on error - let it be reused
              currentReject(error);
            } else {
              console.error(`Error in worker ${index} but no execution context found`, error);
            }
          };
        }

        // Use the existing or newly created worker instance
        const w = workerInstance;

        // CRITICAL: Track this worker for termination (update tracking for this execution)
        // Store resolve/reject in a way that the message handler can access them
        // Since handlers are set up once, we need to use a closure or store them per execution
        const executionId = `${index}_${Date.now()}_${Math.random()}`;
        const executionContext = { index, args, resolve, reject, executionId };
        this.activeWorkers.set(w, executionContext);

        try {
          // buffer.byteLength === 0
          //   ? w.postMessage(args)
          //   : w.postMessage(args, [buffer]);
          w.postMessage(args)
        } catch (error) {
          // CRITICAL: Remove from active workers tracking
          this.activeWorkers.delete(w);

          // CRITICAL: Ensure uniqueId is properly extracted from args
          let itemUniqueId = args.uniqueId ||
            (args.funcName && args.funcName.id) ||
            (args.funcName && args.funcName.uniqueId) ||
            null;

          if (itemUniqueId) {
            this.emit('itemStatus', {
              itemId: itemUniqueId,
              status: 'error',
              error: error.message
            });
          }

          console.error(
            `There was an error with the execution of function: ${funcName}, step: ${step}.`
          );
          reject(error);
          w.terminate();
        }
      });
    };
  }

  /**
   * @memberof threadManager
   * @description Kill all active workers and stop execution
   */
  killAllWorkers() {

    this.isStopped = true;

    // Terminate all active workers
    for (const [worker, { index, args, resolve, reject }] of this.activeWorkers.entries()) {
      try {
        // Send stop message if worker supports it
        try {
          worker.postMessage({ type: 'stop' });
        } catch (e) {
          // Worker may not support stop message, continue to terminate
        }

        // Terminate the worker
        worker.terminate();

        // Reject the promise
        reject(new Error('Worker terminated by user'));

        // Emit error event
        this.emit('itemStatus', {
          itemId: args.uniqueId,
          status: 'error',
          error: 'Worker terminated by user'
        });


      } catch (error) {
        console.error(`Error terminating worker ${index}:`, error);
      }
    }

    // Clear all active workers
    this.activeWorkers.clear();


  }

  /**
   * @memberof threadManager
   * @description Stop all execution and kill workers
   */
  stop() {
    this.isStopped = true;
    this.killAllWorkers();
    // CRITICAL: Don't reset isStopped here - it will be reset when executeWithDag is called again
  }

  /**
   * @memberof threadManager
   * @description Resets all the workers set to work in the compute engine.
   */
  resetWorkers() {
    // CRITICAL: Kill any remaining active workers before reset
    if (this.activeWorkers.size > 0) {

      this.killAllWorkers();
    }

    this.maxWorkerCount = navigator.hardwareConcurrency - 1;
    this.workerThreads = {};
    this.results = [];
    this.functionOrder = [];
    // CRITICAL: Always reset stop flag when resetting workers
    // This ensures workers can be restarted after being stopped
    this.isStopped = false;

  }

  /**
   * @memberof threadManager
   * @description Retrives all the execution times of a worker thread. It is triggered within the engine class.
   */
  get execTimes() {
    let funcTime = 0,
      workerTime = 0;
    for (let i = 0; i < Object.keys(this.workerThreads).length; i++) {
      funcTime += this.workerThreads[i].functionTime;
      workerTime += this.workerThreads[i].workerTime;
    }
    return [funcTime, workerTime];
  }
}
