const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Placeholder for future IPC if needed
});