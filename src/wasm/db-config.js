/**
 * Database Configuration Module
 * Needed to put into the hydrocompute database
 * 
 * This module serves as the single source of truth for database configuration
 * across the entire application. All database connections should reference
 * this module to ensure consistency.
 */

const DB_CONFIG = {
    NAME: 'SetterDB',
    VERSION: 3,
    STORES: {
      'settings': {
        keyPath: 'id',
        indexes: [
          { name: 'id', keyPath: 'id', options: { unique: true } },
          { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
        ]
      },
      'workflowStates': {
        keyPath: 'id',
        indexes: [
          { name: 'id', keyPath: 'id', options: { unique: true } },
          { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
        ]
      },
      'results': {
        keyPath: 'id',
        indexes: [
          { name: 'id', keyPath: 'id', options: { unique: true } },
          { name: 'status', keyPath: 'status', options: { unique: false } },
          { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
        ]
      },
      'wasmModules': {
        keyPath: 'id',
        indexes: [
          { name: 'name', keyPath: 'name', options: { unique: false } },
          { name: 'type', keyPath: 'type', options: { unique: false } },
          { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
        ]
      }
    }
  };
  
  /**
   * Get database configuration
   * @returns {Object} The database configuration object
   */
  export function getDatabaseConfig() {
    return DB_CONFIG;
  }
  
  /**
   * Get database name
   * @returns {string} The database name
   */
  export function getDatabaseName() {
    return DB_CONFIG.NAME;
  }
  
  /**
   * Get database version
   * @returns {number} The database version
   */
  export function getDatabaseVersion() {
    return DB_CONFIG.VERSION;
  }
  
  /**
   * Get store configuration
   * @param {string} storeName - Name of the store to get configuration for
   * @returns {Object|null} The store configuration or null if not found
   */
  export function getStoreConfig(storeName) {
    return DB_CONFIG.STORES[storeName] || null;
  }
  
  /**
   * Check if store exists in schema
   * @param {string} storeName - Name of store to check
   * @returns {boolean} True if store exists in schema
   */
  export function storeExistsInSchema(storeName) {
    return Boolean(DB_CONFIG.STORES[storeName]);
  }
  
  /**
   * Creates a new database connection
   * @param {string} [dbName=DB_CONFIG.NAME] - Database name
   * @param {number} [version=DB_CONFIG.VERSION] - Database version
   * @returns {Promise<IDBDatabase>} Promise resolving to database connection
   */
  export function openDatabase(dbName = DB_CONFIG.NAME, version = DB_CONFIG.VERSION) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, version);
      
      request.onerror = (event) => {
        console.error('Error opening database:', event.target.error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Apply schema for all stores
        for (const [storeName, storeConfig] of Object.entries(DB_CONFIG.STORES)) {
          // Create store if it doesn't exist
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: storeConfig.keyPath });
            
            // Create all indexes
            for (const indexConfig of storeConfig.indexes) {
              store.createIndex(
                indexConfig.name,
                indexConfig.keyPath,
                indexConfig.options
              );
            }
            
            console.log(`Created store: ${storeName}`);
          }
        }
      };
    });
  }
  
  // export {
  //   getDatabaseConfig,
  //   getDatabaseName,
  //   getDatabaseVersion,
  //   getStoreConfig,
  //   storeExistsInSchema,
  //   openDatabase
  // }; 