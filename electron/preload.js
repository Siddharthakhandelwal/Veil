const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  platform: process.platform,
});
