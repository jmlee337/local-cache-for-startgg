import { app, clipboard, ipcMain, IpcMainInvokeEvent } from 'electron';
import Store from 'electron-store';

export default function setupIPCs() {
  const store = new Store();

  let apiKey = store.has('apiKey') ? (store.get('apiKey') as string) : '';
  ipcMain.removeHandler('getApiKey');
  ipcMain.handle('getApiKey', () => apiKey);

  ipcMain.removeHandler('setApiKey');
  ipcMain.handle(
    'setApiKey',
    (event: IpcMainInvokeEvent, newApiKey: string) => {
      store.set('apiKey', newApiKey);
      apiKey = newApiKey;
    },
  );

  ipcMain.removeHandler('getAppVersion');
  ipcMain.handle('getAppVersion', () => app.getVersion());

  ipcMain.removeHandler('copy');
  ipcMain.handle('copy', (event: IpcMainInvokeEvent, text: string) => {
    clipboard.writeText(text);
  });
}
