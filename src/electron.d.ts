/** Type declarations for the Electron preload bridge. */

interface ElectronAPI {
    setFullscreen(val: boolean): Promise<void>;
    isFullscreen(): Promise<boolean>;
}

interface Window {
    electronAPI?: ElectronAPI;
}
