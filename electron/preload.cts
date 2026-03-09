import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    setFullscreen: (val: boolean): Promise<void> => ipcRenderer.invoke('set-fullscreen', val),
    isFullscreen: (): Promise<boolean> => ipcRenderer.invoke('is-fullscreen'),
});
