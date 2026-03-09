import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

let win: BrowserWindow | null = null;

const isDev = !app.isPackaged;

function createWindow(): void {
    win = new BrowserWindow({
        width: 1920,
        height: 1080,
        minWidth: 1280,
        minHeight: 720,
        backgroundColor: '#000000',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Lock aspect ratio to 16:9
    win.setAspectRatio(16 / 9);

    if (isDev) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools({ mode: 'detach' });
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    win.once('ready-to-show', () => {
        win?.show();
    });

    win.on('closed', () => {
        win = null;
    });
}

// ─── IPC Handlers ───

ipcMain.handle('set-fullscreen', (_event: Electron.IpcMainInvokeEvent, val: boolean) => {
    win?.setFullScreen(val);
});

ipcMain.handle('is-fullscreen', () => {
    return win?.isFullScreen() ?? false;
});

// ─── App Lifecycle ───

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
