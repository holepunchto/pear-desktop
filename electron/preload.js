const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('bridge', {
  applyUpdate: () => ipcRenderer.invoke('runtime:applyUpdate'),
  getVersion: () => ipcRenderer.invoke('runtime:getVersion'),
  onRuntimeEvent: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, eventName) => callback(eventName)
    ipcRenderer.on('runtime:event', listener)
    return () => ipcRenderer.removeListener('runtime:event', listener)
  },

  startWorker: () => ipcRenderer.invoke('runtime:startWorker'),
  onWorkerData: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('worker:data', listener)
    return () => ipcRenderer.removeListener('worker:data', listener)
  }
})
