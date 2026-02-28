(function() {
    'use strict';

    const originalFetch = window.fetch;
    const mergedData = {}; 
    const pendingRequests = {}; 

    window.fetch = function(url, ...args) {
        const urlString = url.toString();
        
        if (urlString.endsWith("SMB1R.pck") || urlString.endsWith("SMB1R.wasm")) {

            if (mergedData[urlString]) {
                return Promise.resolve(new Response(mergedData[urlString]));
            }

            return new Promise((resolve) => {
                if (!pendingRequests[urlString]) pendingRequests[urlString] = [];
                pendingRequests[urlString].push(resolve);
            });
        }
        return originalFetch(url, ...args);
    };

    async function mergeFiles(baseFileName, start, end) {
        const buffers = [];
        console.log(`[Merger] Starting merge for ${baseFileName}...`);

        try {
            for (let i = start; i <= end; i++) {
                const partName = `${baseFileName}.part${i}`;
                const response = await originalFetch(partName);
                
                if (!response.ok) throw new Error(`Part ${i} missing for ${baseFileName}`);
                
                const data = await response.arrayBuffer();
                buffers.push(data);
                console.log(`[Merger] Loaded ${partName}`);
            }

            const mergedBlob = new Blob(buffers, { type: 'application/octet-stream' });
            mergedData[baseFileName] = mergedBlob;

            if (pendingRequests[baseFileName]) {
                pendingRequests[baseFileName].forEach(resolve => {
                    resolve(new Response(mergedBlob));
                });
                delete pendingRequests[baseFileName];
            }

            return mergedBlob;
        } catch (err) {
            console.error(`[Merger] Failed to merge ${baseFileName}:`, err);
        }
    }

    async function init() {
        await Promise.all([
            mergeFiles("SMB1R.pck", 1, 3),
            mergeFiles("SMB1R.wasm", 1, 2)
        ]);

        console.log("[Merger] All files ready. Starting Godot...");
        if (typeof window.godotRunStart === 'function') {
            window.godotRunStart();
        }
    }

    init();
})();