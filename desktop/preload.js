const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('__desktopApp', { platform: process.platform, version: process.versions.electron });
