import { app, ipcMain, dialog } from 'electron';
import serve from 'electron-serve';
import { createWindow } from './helpers';
import Store from 'electron-store';
import { Worker } from 'worker_threads';
import type { State } from '../renderer/pages/index';

const isProd: boolean = process.env.NODE_ENV === 'production';

app.setName('binance-simulate-bot');

if (isProd) {
  serve({ directory: 'app' });
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`);
}

(async () => {
  await app.whenReady();
  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    autoHideMenuBar: isProd,
    webPreferences: {
      nodeIntegrationInWorker: true,
    },
  });

  const dataStore = new Store({ name: 'data-store' });

  const pathStore = new Store({ name: 'path' });

  ipcMain.on('data', (_e, data: State) => {
    try {
      const worker = new Worker(`${__dirname}/..${isProd ? '/../app.asar.unpacked' : ''}/helper/worker.js`, {
        workerData: {
          path: `./loader.${isProd ? 'js' : 'ts'}`,
          data: {
            ...data,
            userData: (pathStore.get('path') as string) || app.getPath('userData'),
          },
        },
      });
      ipcMain.on('cancel', () => {
        worker.terminate();
      });
      worker.on('message', (d) => {
        if (typeof d === 'string' && d === 'cancelReady') {
          return worker.terminate();
        }
        const { event, ...rest } = d;
        if (event === 'error') {
          return mainWindow.webContents.send(event, rest.text);
        }
        return mainWindow.webContents.send(event, rest);
      });
    } catch (e) {
      console.log(e);
    }
  });

  ipcMain.on('store-data', (_e, data: State) => dataStore.set('data', data));

  ipcMain.on('get-store-data', (e) => {
    e.returnValue = dataStore.get('data');
  });
  ipcMain.on('dirDialog', async (e) => {
    const result = await dialog
      .showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        defaultPath: (pathStore.get('path') as string) || app.getPath('userData'),
        buttonLabel: 'OK',
      })
      .then((res) => res.filePaths[0]);
    if (result) {
      pathStore.set('path', result);
    }
  });

  if (isProd) {
    await mainWindow.loadURL('app://./index.html');
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}`);
    //mainWindow.webContents.openDevTools()
  }
})();

app.on('window-all-closed', () => {
  app.quit();
});
