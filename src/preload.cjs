/**
 * Preload-скрипт.
 *
 * Виконується в ізольованому контексті (contextIsolation + sandbox) і віддає
 * сторінкам застосунку рівно те, що потрібно `loading.html` та `error.html`:
 * дані про підключення, повторну спробу й відкриття CRM у браузері. Сторінки
 * самої CRM цим API не користуються.
 *
 * Файл навмисно у форматі CommonJS (.cjs): preload у режимі sandbox не
 * підтримує ESM-імпорти.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('freecora', {
    /** Версії рантайму — доступні синхронно. */
    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
    },

    /** Версія застосунку та адреса CRM, до якої він підключається. */
    info: () => ipcRenderer.invoke('app:info'),

    /** Повторна спроба завантажити CRM. */
    retry: () => ipcRenderer.send('app:retry'),

    /** Відкрити CRM у системному браузері. */
    openInBrowser: () => ipcRenderer.send('app:open-in-browser'),
});
