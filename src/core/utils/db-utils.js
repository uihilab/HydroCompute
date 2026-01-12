/**
 * @namespace dbUtils
 * @description Shared database utility functions for IndexedDB operations
 * Used by both JavaScript and Python workers to avoid code duplication
 */

import { openDatabase } from "./db-config.js";

export { openDatabase };

/**
 * Verify database accessibility
 * @private
 * @param {string} databaseName - Name of the database
 * @param {string} storeName - Name of the object store
 * @returns {Promise<boolean>} Promise resolving to true if accessible
 */
export async function verifyDatabaseAccess(databaseName, storeName) {
  try {
    const db = await openDatabase(databaseName);

    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      throw new Error(`Store ${storeName} not found in database ${databaseName}`);
    }

    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve(true);
      };

      transaction.onerror = (event) => {
        console.error(`Database verification failed for ${databaseName}.${storeName}:`, event.target.error);
        db.close();
        reject(event.target.error);
      };

      store.count(); // Just verify access, no need to log count
    });
  } catch (error) {
    console.error(`Error verifying database access:`, error);
    throw error;
  }
}

/**
 * Reassemble chunks for partitioned files
 * @private
 * @param {Object} result - The main record with isPartitioned: true
 * @param {IDBObjectStore} store - The IndexedDB object store
 * @returns {Promise<any>} Promise resolving to the reassembled data
 */
async function reassembleChunksFromStore(result, store) {
  if (!result || !result.isPartitioned || !result.chunks || !Array.isArray(result.chunks) || result.chunks.length === 0) {
    return result.data; // Not partitioned or no chunks, return existing data or undefined
  }

  // console.log(`[db-utils] Reassembling chunks for ${result.id}:`, {
  //   totalChunks: result.chunks.length,
  //   type: result.type,
  //   originalFormat: result.originalFormat
  // });

  const chunkIds = result.chunks || [];
  const allChunks = [];

  // Load all chunks
  for (const chunkRef of chunkIds) {
    const chunkId = chunkRef.id || chunkRef;
    try {
      const chunk = await new Promise((resolve, reject) => {
        const chunkRequest = store.get(chunkId);
        chunkRequest.onsuccess = () => resolve(chunkRequest.result);
        chunkRequest.onerror = () => reject(new Error(`Failed to load chunk ${chunkId}`));
      });

      if (chunk && chunk.data !== undefined && chunk.data !== null) {
        allChunks.push({
          index: chunk.index !== undefined ? chunk.index : (chunkRef.index !== undefined ? chunkRef.index : 0),
          data: chunk.data
        });
      } else {
        console.warn(`[db-utils] Chunk ${chunkId} has null/undefined data:`, chunk);
      }
    } catch (e) {
      console.warn(`[db-utils] Could not load chunk ${chunkId}:`, e);
    }
  }

  if (allChunks.length === 0) {
    console.warn(`[db-utils] No chunks loaded for ${result.id}`);
    // No chunks loaded, return empty data based on type
    if (result.originalFormat === 'CSV' || (result.type && result.type.includes('csv'))) {
      return [];
    } else {
      return new ArrayBuffer(0);
    }
  }

  // Sort chunks by index to ensure correct order
  allChunks.sort((a, b) => a.index - b.index);
  // console.log(`[db-utils] Sorted ${allChunks.length} chunks by index`);

  // Reassemble data based on file type
  if (result.originalFormat === 'CSV' || (result.type && result.type.includes('csv'))) {
    // For CSV: concatenate arrays
    const allData = [];
    for (const chunk of allChunks) {
      if (chunk.data && Array.isArray(chunk.data)) {
        allData.push(...chunk.data);
      }
    }
    // console.log(`[db-utils] Reassembled CSV data: ${allData.length} items`);
    return allData.length > 0 ? allData : [];
  } else {
    // For binary files: combine ArrayBuffers or Uint8Arrays
    const arrays = [];
    let totalBytes = 0;

    for (const chunk of allChunks) {
      let chunkData = chunk.data;

      // CRITICAL: Check if chunk is Base64-encoded gzipped data
      if (chunkData && typeof chunkData === 'object' && chunkData.__base64Gzip === true && typeof chunkData.data === 'string') {
        // console.log(`[db-utils] Chunk ${chunk.index} is Base64-encoded gzip, decoding...`);
        const base64 = chunkData.data;
        const bin = atob(base64.replace(/\s+/g, ''));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          bytes[i] = bin.charCodeAt(i);
        }
        chunkData = bytes.buffer; // Use decoded ArrayBuffer
      }

      if (chunkData instanceof ArrayBuffer) {
        const uint8 = new Uint8Array(chunkData);
        arrays.push(uint8);
        totalBytes += uint8.length;
      } else if (chunkData instanceof Uint8Array) {
        arrays.push(chunkData);
        totalBytes += chunkData.length;
      } else if (Array.isArray(chunkData)) {
        // If chunk data is an array of numbers, convert to Uint8Array
        const uint8 = new Uint8Array(chunkData);
        arrays.push(uint8);
        totalBytes += uint8.length;
      } else {
        console.warn(`[db-utils] Chunk ${chunk.index} has unexpected data type:`, typeof chunkData, chunkData);
      }
    }

    if (arrays.length > 0) {
      // console.log(`[db-utils] Combining ${arrays.length} chunks into ArrayBuffer (total: ${totalBytes} bytes)`);
      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const arr of arrays) {
        combined.set(arr, offset);
        offset += arr.length;
      }

      const resultBuffer = combined.buffer;
      // console.log(`[db-utils] Reassembled ArrayBuffer: ${resultBuffer.byteLength} bytes`);

      return resultBuffer; // Return as ArrayBuffer
    } else {
      console.warn(`[db-utils] No valid arrays to combine`);
      return new ArrayBuffer(0);
    }
  }
}

/**
 * Detect and decompress gzip-compressed binary payloads.
 * Uses the built-in DecompressionStream when available; otherwise returns the original data.
 * @param {any} data - Data potentially containing gzip-compressed bytes
 * @returns {Promise<any>} Decompressed ArrayBuffer when gzip is detected; otherwise original data
 */
// Load pako for gzip decompression (lazy load)
/**
 * @private
 */
let pakoLib = null;
async function loadPako() {
  if (pakoLib) return pakoLib;
  try {
    // Try dynamic import for ES module workers
    // Note: import() is always available in ES modules, so we can use it directly
    const pakoModule = await import('https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.esm.mjs');
    pakoLib = pakoModule.default || pakoModule;
    // console.log('[db-utils] Loaded pako for gzip decompression');
    return pakoLib;
  } catch (e) {
    console.warn('[db-utils] Failed to load pako via dynamic import:', e);
  }
  // Fallback to global pako if available
  if (typeof pako !== 'undefined') {
    pakoLib = pako;
    return pakoLib;
  }
  return null;
}

async function maybeDecompressGzip(data) {
  try {
    // CRITICAL: Check if data is our Base64 gzip marker object
    if (data && typeof data === 'object' && data.__base64Gzip === true && typeof data.data === 'string') {
      // console.log('[db-utils] Base64 gzip marker object detected, decompressing...');
      const base64 = data.data;

      // Decode Base64
      const bin = atob(base64.replace(/\s+/g, ''));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }

      // Load pako and decompress
      const pako = await loadPako();
      if (!pako) {
        console.warn('[db-utils] Pako not available, cannot decompress Base64 gzip data');
        return data; // Return original if pako unavailable
      }

      const decompressed = pako.ungzip(bytes); // returns Uint8Array
      return decompressed.buffer;
    }

    // CRITICAL: Check if data is a Base64-encoded gzipped string (legacy format)
    if (typeof data === 'string') {
      // Check if it looks like Base64 and might be gzipped
      // Base64 strings for gzipped data will be longer and have specific patterns
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (data.length > 100 && base64Regex.test(data.replace(/\s+/g, ''))) {
        try {
          // Decode Base64
          const bin = atob(data.replace(/\s+/g, ''));
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) {
            bytes[i] = bin.charCodeAt(i);
          }

          // Check if it's gzipped (magic bytes 0x1f 0x8b)
          if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
            // console.log('[db-utils] Base64-encoded gzip data detected, decompressing...');

            // Load pako if not already loaded
            const pako = await loadPako();
            if (!pako) {
              console.warn('[db-utils] Pako not available, cannot decompress Base64 gzip data');
              return data; // Return original string if pako unavailable
            }

            // Decompress with pako
            const decompressed = pako.ungzip(bytes); // returns Uint8Array
            return decompressed.buffer;
          }
        } catch (e) {
          // Not Base64 gzip, continue with normal handling
          // console.log('[db-utils] String is not Base64-encoded gzip, treating as normal string');
        }
      }
      // Not Base64 or not gzipped, return as string
      return data;
    }

    // Handle ArrayBuffer/TypedArray inputs (legacy format)
    const isArrayBuffer = data instanceof ArrayBuffer;
    const isTypedArray = ArrayBuffer.isView(data);
    if (!isArrayBuffer && !isTypedArray) {
      return data;
    }

    const uint8 = isArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    // Gzip magic number: 1f 8b
    const isGzip = uint8.length >= 2 && uint8[0] === 0x1f && uint8[1] === 0x8b;
    if (!isGzip) {
      return data;
    }

    // For ArrayBuffer gzip, try pako first (more reliable)
    const pako = await loadPako();
    if (pako) {
      try {
        // console.log('[db-utils] Gzip ArrayBuffer detected, decompressing with pako...');
        const decompressed = pako.ungzip(uint8);
        return decompressed.buffer;
      } catch (e) {
        console.warn('[db-utils] Pako decompression failed, trying DecompressionStream:', e);
      }
    }

    // Fallback to DecompressionStream if available
    if (typeof DecompressionStream === 'undefined') {
      console.warn('[db-utils] Gzip data detected but neither pako nor DecompressionStream is available; returning raw data');
      return data;
    }

    // console.log('[db-utils] Gzip data detected, decompressing with DecompressionStream');
    const stream = new Blob([uint8]).stream().pipeThrough(new DecompressionStream('gzip'));
    const decompressed = await new Response(stream).arrayBuffer();
    return decompressed;
  } catch (error) {
    console.warn('[db-utils] Failed to decompress gzip payload, returning original data', error);
    return data;
  }
}

/**
 * Get data from IndexedDB
 * @private
 * @param {string} datab - Database name
 * @param {string} storeName - Object store name
 * @param {string} id - Record ID
 * @returns {Promise<any>} Promise resolving to the data
 */
export async function getDataFromIndexedDB(datab, storeName, id) {
  try {
    const db = await openDatabase(datab);

    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      throw new Error(`Object store ${storeName} does not exist in database ${datab}`);
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const getRequest = store.get(id);

        getRequest.onsuccess = async () => {
          const result = getRequest.result;
          if (!result) {
            db.close();
            reject(new Error(`Data with ID ${id} not found in ${storeName}`));
            return;
          }

          // CRITICAL: Check if this is a partitioned file and reassemble chunks
          if (result.isPartitioned && result.chunks && Array.isArray(result.chunks) && result.chunks.length > 0) {
            // Close the current transaction and open a new one for chunk loading
            db.close();

            try {
              // Open a new database connection for loading chunks
              const chunkDb = await openDatabase(datab);
              const chunkTransaction = chunkDb.transaction([storeName], 'readonly');
              const chunkStore = chunkTransaction.objectStore(storeName);

              const reassembledData = await reassembleChunksFromStore(result, chunkStore);
              const decompressed = await maybeDecompressGzip(reassembledData);

              // CRITICAL: Parse XML strings to JSON when retrieving from database
              // This is where XML parsing should happen, not during storage
              const parsed = processDataForXML(decompressed);

              chunkDb.close();
              resolve(parsed);
              return;
            } catch (chunkError) {
              console.error(`[db-utils] Error reassembling chunks for ${id}:`, chunkError);
              reject(new Error(`Failed to reassemble chunks for ${id}: ${chunkError.message}`));
              return;
            }
          }

          // CRITICAL: Check if data exists and is not null (for non-partitioned files)
          if (result.data === undefined || result.data === null) {
            db.close();
            const errorMsg = `Data with ID ${id} exists in ${storeName} but has null/undefined data. Status: ${result.status || 'unknown'}`;
            console.error(errorMsg, result);
            reject(new Error(errorMsg));
            return;
          }

          // Decompress gzip payloads when needed
          const decompressed = await maybeDecompressGzip(result.data);

          // CRITICAL: Parse XML strings to JSON when retrieving from database
          // This is where XML parsing should happen, not during storage
          const parsed = processDataForXML(decompressed);

          db.close();
          resolve(parsed);
        };

        getRequest.onerror = (event) => {
          console.error('Error getting data:', event.target.error);
          db.close();
          reject(event.target.error || new Error('Failed to get data'));
        };

        transaction.onerror = (event) => {
          console.error('Transaction error:', event.target.error);
          db.close();
          reject(event.target.error || new Error('Transaction failed'));
        };
      } catch (error) {
        db.close();
        console.error('Error in database operation:', error);
        reject(error);
      }
    });
  } catch (error) {
    console.error('Unexpected error in getDataFromIndexedDB:', error);
    throw error;
  }
}

/**
 * Parse XML string to JSON object
 * @private
 * @param {string} xmlString - XML string to parse
 * @returns {Object|null} Parsed JSON object or null if parsing fails
 */
function parseXMLToJSON(xmlString) {
  if (typeof xmlString !== 'string' || !xmlString.trim()) {
    return null;
  }

  // Check if it looks like XML (starts with <?xml or <)
  const trimmed = xmlString.trim();
  if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
    return null;
  }

  try {
    // Use DOMParser to parse XML
    // CRITICAL: DOMParser is not available in web workers, use alternative
    let parser;
    if (typeof DOMParser !== 'undefined') {
      parser = new DOMParser();
    } else if (typeof self !== 'undefined' && self.DOMParser) {
      parser = new self.DOMParser();
    } else {
      // Fallback: Use simple XML parser for web worker contexts
      console.warn('[db-utils] DOMParser not available in web worker context, using fallback XML parsing');
      return parseXMLSimple(xmlString);
    }
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.warn('[db-utils] XML parsing error:', parseError.textContent);
      return null;
    }

    // Convert XML to JSON recursively
    const xmlToJson = (node) => {
      const result = {};

      // Handle attributes
      if (node.attributes && node.attributes.length > 0) {
        for (let i = 0; i < node.attributes.length; i++) {
          const attr = node.attributes[i];
          result[`@${attr.name}`] = attr.value;
        }
      }

      // Handle child nodes
      if (node.childNodes && node.childNodes.length > 0) {
        const textNodes = [];
        const elementNodes = {};

        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i];

          if (child.nodeType === 3) { // TEXT_NODE
            const text = child.textContent?.trim();
            if (text) {
              textNodes.push(text);
            }
          } else if (child.nodeType === 1) { // ELEMENT_NODE
            const childName = child.nodeName;
            const childData = xmlToJson(child);

            if (elementNodes[childName]) {
              // Multiple elements with same name - convert to array
              if (!Array.isArray(elementNodes[childName])) {
                elementNodes[childName] = [elementNodes[childName]];
              }
              elementNodes[childName].push(childData);
            } else {
              elementNodes[childName] = childData;
            }
          }
        }

        // Combine text and element nodes
        if (textNodes.length > 0) {
          result._text = textNodes.join(' ').trim();
        }

        Object.assign(result, elementNodes);
      }

      // If only text content and no attributes/elements, return just the text
      if (Object.keys(result).length === 1 && result._text !== undefined) {
        return result._text;
      }

      // If no content at all, return empty object
      if (Object.keys(result).length === 0) {
        return {};
      }

      return result;
    };

    const jsonResult = xmlToJson(xmlDoc.documentElement);
    // console.log('[db-utils] Successfully parsed XML to JSON');
    return jsonResult;
  } catch (error) {
    console.warn('[db-utils] Error parsing XML:', error);
    return null;
  }
}

/**
 * Simple XML parser fallback for web worker contexts where DOMParser is not available
 * This is a limited parser that extracts basic structure
 * @private
 * @param {string} xmlString - XML string to parse
 * @returns {Object|null} Parsed object or null
 */
function parseXMLSimple(xmlString) {
  try {
    // Very basic XML parsing using regex (limited functionality)
    // This is a fallback when DOMParser is not available
    const result = {};
    const tagRegex = /<(\w+)([^>]*)>([^<]*)<\/\1>/g;
    let match;

    while ((match = tagRegex.exec(xmlString)) !== null) {
      const tagName = match[1];
      const content = match[3].trim();

      if (result[tagName]) {
        if (!Array.isArray(result[tagName])) {
          result[tagName] = [result[tagName]];
        }
        result[tagName].push(content);
      } else {
        result[tagName] = content;
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.warn('[db-utils] Error in simple XML parsing:', error);
    return null;
  }
}

/**
 * Recursively process data to parse XML strings
 * @private
 * @param {any} data - Data to process
 * @returns {any} Processed data with XML strings converted to JSON
 */
function processDataForXML(data) {
  if (data === null || data === undefined) {
    return data;
  }

  // CRITICAL: Preserve binary data types BEFORE checking for generic objects
  // ArrayBuffer is technically an object, but we need to preserve it as-is
  if (data instanceof ArrayBuffer) {
    return data; // Return ArrayBuffer as-is - don't try to parse as XML
  }

  if (ArrayBuffer.isView(data)) {
    // TypedArray - convert to ArrayBuffer for consistency
    if (data.buffer) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    return data; // Fallback: return as-is
  }

  if (data instanceof Blob) {
    return data; // Return Blob as-is - don't try to parse as XML
  }

  // If it's a string, check if it's XML
  if (typeof data === 'string') {
    const parsed = parseXMLToJSON(data);
    if (parsed !== null) {
      return parsed;
    }
    return data; // Not XML, return as-is
  }

  // If it's an array, process each element
  if (Array.isArray(data)) {
    return data.map(item => processDataForXML(item));
  }

  // If it's an object, process each property
  if (typeof data === 'object') {
    const processed = {};
    for (const [key, value] of Object.entries(data)) {
      processed[key] = processDataForXML(value);
    }
    return processed;
  }

  // Primitive types - return as-is
  return data;
}

/**
 * Store result in IndexedDB
 * @private
 * @param {string} databaseName - Database name
 * @param {string} storeName - Object store name
 * @param {Object} data - Data object to store (must have 'id' field)
 * @returns {Promise<void>} Promise resolving when data is stored
 */
export async function storeResultInIndexedDB(databaseName, storeName, data) {
  // console.log(`Attempting to store result in ${databaseName}.${storeName} for ID ${data.id}`);

  try {
    if (!data || !data.id) {
      throw new Error('Invalid data object: missing id field');
    }

    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }

    if (!data.status) {
      data.status = 'completed';
    }

    // CRITICAL: DO NOT parse XML here - worker should save raw data
    // XML parsing will happen when data is retrieved from database (in getDataFromIndexedDB)

    const db = await openDatabase(databaseName);

    if (!db.objectStoreNames.contains(storeName)) {
      db.close();
      throw new Error(`Object store ${storeName} does not exist in database ${databaseName}. Available stores: ${Array.from(db.objectStoreNames).join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        const putRequest = store.put(data);

        putRequest.onsuccess = () => {
          resolve();
        };

        putRequest.onerror = (event) => {
          console.error('Error storing data:', event.target.error);
          reject(event.target.error || new Error('Failed to store data'));
        };

        transaction.oncomplete = () => {
          db.close();
        };

        transaction.onerror = (event) => {
          console.error('Transaction error:', event.target.error);
          reject(event.target.error || new Error('Transaction failed'));
        };
      } catch (error) {
        db.close();
        console.error('Error in database operation:', error);
        reject(error);
      }
    });
  } catch (error) {
    console.error('Unexpected error in storeResultInIndexedDB:', error);
    throw error;
  }
}

/**
 * Prepare data for storage by ensuring it's serializable
 * @param {any} data - Data to prepare
 * @returns {any} Serializable data
 */
/**
 * Check if ArrayBuffer/TypedArray is gzipped (starts with 0x1f 0x8b)
 * @private
 */
function isGzipped(buffer) {
  if (buffer instanceof ArrayBuffer) {
    const view = new Uint8Array(buffer);
    return view.length >= 2 && view[0] === 0x1f && view[1] === 0x8b;
  }
  if (ArrayBuffer.isView(buffer)) {
    return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  }
  return false;
}

/**
 * Convert gzipped ArrayBuffer to Base64 string for storage
 * @private
 */
function gzipToBase64(gzipBuffer) {
  const uint8 = gzipBuffer instanceof ArrayBuffer
    ? new Uint8Array(gzipBuffer)
    : new Uint8Array(gzipBuffer.buffer, gzipBuffer.byteOffset, gzipBuffer.byteLength);

  // Convert to Base64
  const b64 = btoa(String.fromCharCode(...uint8));
  return b64;
}

export async function prepareDataForStorage(data) {
  // CRITICAL: Handle Promises first - they cannot be cloned
  if (data && typeof data.then === 'function') {
    console.warn('Promise detected in data, awaiting resolution...');
    data = await data;
  }

  // CRITICAL: DO NOT parse XML here - worker should save raw data
  // XML parsing will happen when data is retrieved from database (in getDataFromIndexedDB)

  // CRITICAL: IndexedDB can store ArrayBuffers, Blobs, and TypedArrays directly!
  // Only convert to JSON-serializable format if absolutely necessary
  // For binary data, preserve the original type unless it's gzipped (then use Base64)

  // Check if data is already an IndexedDB-compatible type
  if (data instanceof ArrayBuffer) {
    // CRITICAL: Check if it's gzipped - serialize as Base64 if so (for compression)
    if (isGzipped(data)) {
      // console.log('[db-utils] Gzipped ArrayBuffer detected, converting to Base64 for storage');
      const base64 = gzipToBase64(data);
      // Mark it as Base64 gzip by adding a prefix (we'll detect this on retrieval)
      return { __base64Gzip: true, data: base64 };
    }
    // CRITICAL: Not gzipped - preserve as ArrayBuffer (IndexedDB supports this!)
    // console.log('[db-utils] Preserving ArrayBuffer for IndexedDB storage:', data.byteLength, 'bytes');
    return data; // Return ArrayBuffer as-is
  } else if (ArrayBuffer.isView(data)) {
    // CRITICAL: Check if TypedArray is gzipped - serialize as Base64 if so
    if (isGzipped(data)) {
      // console.log('[db-utils] Gzipped TypedArray detected, converting to Base64 for storage');
      const base64 = gzipToBase64(data);
      return { __base64Gzip: true, data: base64 };
    }
    // CRITICAL: Not gzipped - preserve as TypedArray or convert to ArrayBuffer
    // IndexedDB can store TypedArrays, but ArrayBuffer is more universal
    // console.log('[db-utils] Preserving TypedArray for IndexedDB storage:', data.byteLength, 'bytes');
    // Convert to ArrayBuffer for consistency
    if (data.buffer) {
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    return data; // Fallback: return as-is
  } else if (data instanceof Blob) {
    // CRITICAL: IndexedDB can store Blobs directly
    // console.log('[db-utils] Preserving Blob for IndexedDB storage:', data.size, 'bytes');
    return data; // Return Blob as-is
  }

  try {
    // Check if data is already serializable
    JSON.stringify(data);
    return data;
  } catch (error) {
    console.warn('Data is not directly serializable, attempting to convert:', error);

    // Handle common non-serializable types (only for non-binary data)
    if (data instanceof Float32Array) {
      // Float32Array is a TypedArray, but if we got here it means JSON.stringify failed
      // This might be a large array - preserve as ArrayBuffer
      // console.log('[db-utils] Float32Array detected, converting to ArrayBuffer for storage');
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    } else if (Array.isArray(data)) {
      // CRITICAL: Handle arrays - check each element for Promises
      const serializableArray = [];
      for (let i = 0; i < data.length; i++) {
        const element = data[i];
        try {
          // Check if element is a Promise
          if (element && typeof element.then === 'function') {
            console.warn(`Promise detected in array at index ${i}, awaiting resolution...`);
            const resolvedElement = await element;
            serializableArray.push(await prepareDataForStorage(resolvedElement));
          } else {
            serializableArray.push(await prepareDataForStorage(element));
          }
        } catch (err) {
          console.warn(`Could not serialize array element at index ${i}:`, err);
          serializableArray.push(String(element)); // Convert to string as fallback
        }
      }
      return serializableArray;
    } else if (data && typeof data === 'object') {
      // Try to convert object properties - recursively handle Promises
      const serializable = {};
      for (const [key, value] of Object.entries(data)) {
        try {
          // Check if value is a Promise
          if (value && typeof value.then === 'function') {
            console.warn(`Promise detected in property ${key}, awaiting resolution...`);
            const resolvedValue = await value;
            serializable[key] = await prepareDataForStorage(resolvedValue);
          } else if (value instanceof ArrayBuffer) {
            // CRITICAL: Check if it's gzipped - serialize as Base64 if so
            if (isGzipped(value)) {
              console.log(`[db-utils] Gzipped ArrayBuffer detected in property ${key}, converting to Base64 for storage`);
              const base64 = gzipToBase64(value);
              serializable[key] = { __base64Gzip: true, data: base64 };
            } else {
              // CRITICAL: Preserve ArrayBuffer - IndexedDB supports this!
              console.log(`[db-utils] Preserving ArrayBuffer in property ${key} for IndexedDB storage:`, value.byteLength, 'bytes');
              serializable[key] = value; // Keep as ArrayBuffer
            }
          } else if (ArrayBuffer.isView(value)) {
            // CRITICAL: Check if TypedArray is gzipped - serialize as Base64 if so
            if (isGzipped(value)) {
              console.log(`[db-utils] Gzipped TypedArray detected in property ${key}, converting to Base64 for storage`);
              const base64 = gzipToBase64(value);
              serializable[key] = { __base64Gzip: true, data: base64 };
            } else {
              // CRITICAL: Preserve TypedArray as ArrayBuffer - IndexedDB supports this!
              console.log(`[db-utils] Preserving TypedArray in property ${key} as ArrayBuffer for IndexedDB storage:`, value.byteLength, 'bytes');
              if (value.buffer) {
                serializable[key] = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
              } else {
                serializable[key] = value; // Fallback: keep as-is
              }
            }
          } else if (value instanceof Blob) {
            // CRITICAL: IndexedDB can store Blobs directly
            console.log(`[db-utils] Preserving Blob in property ${key} for IndexedDB storage:`, value.size, 'bytes');
            serializable[key] = value; // Keep as Blob
          } else if (value instanceof Float32Array) {
            // Convert Float32Array to ArrayBuffer for consistency
            console.log(`[db-utils] Converting Float32Array in property ${key} to ArrayBuffer for storage`);
            if (value.buffer) {
              serializable[key] = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
            } else {
              serializable[key] = Array.from(value); // Fallback
            }
          } else if (Array.isArray(value)) {
            // Recursively process arrays (they might contain Promises)
            serializable[key] = await prepareDataForStorage(value);
          } else if (value && typeof value === 'object' && !(value instanceof Date)) {
            // Recursively process nested objects
            serializable[key] = await prepareDataForStorage(value);
          } else {
            serializable[key] = value;
          }
        } catch (err) {
          console.warn(`Could not serialize property ${key}:`, err);
          serializable[key] = String(value); // Convert to string as fallback
        }
      }
      return serializable;
    }

    // Fallback: convert to string
    return String(data);
  }
}

