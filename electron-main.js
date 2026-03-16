import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    title: "Midnight Fighter | Neon Survival",
    icon: path.join(__dirname, 'public', 'icon.png'),
    backgroundColor: '#050510',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the local index.html
  win.loadFile(path.join(__dirname, 'public', 'index.html'));
  
  // win.webContents.openDevTools();
  win.setMenu(null); // Hide default menu for immersive feel
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
