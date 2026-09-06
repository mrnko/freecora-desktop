/**
 * Freecora CRM Desktop — точка входу головного процесу.
 *
 * Застосунок навмисно простий: це вікно, у якому відкривається CRM
 * `app.freecora.com`. Власного інтерфейсу він не малює — сайдбар, шапку й усі
 * розділи віддає сама CRM. Обгортка додає лише те, чого браузер не дає:
 * окремий .exe з іконкою, збережену сесію, збережену геометрію вікна,
 * нативне меню та коректну поведінку із зовнішніми посиланнями.
 */

import { app, BrowserWindow, dialog, ipcMain, nativeTheme, session, shell } from 'electron';
import { join } from 'node:path';

import { APP_URL, APP_USER_MODEL_ID, BACKGROUND_COLOR, isInternalUrl, WINDOW_DEFAULTS } from './config.js';
import { buildMenu } from './menu.js';
import { createWindowState } from './window-state.js';

const ROOT = import.meta.dirname;
const PARTITION = 'persist:freecora';
const IS_DEV = process.argv.includes('--dev');

/** Дозволи, які CRM може запитати; усе інше відхиляємо. */
const ALLOWED_PERMISSIONS = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen']);

/** ERR_ABORTED — звичайний наслідок переходу під час завантаження, не помилка. */
const ERR_ABORTED = -3;

/** @type {BrowserWindow|null} */
let mainWindow = null;

// Другий запуск не створює друге вікно, а фокусує наявне.
if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => focusWindow());

    app.setAppUserModelId(APP_USER_MODEL_ID);

    app.whenReady().then(() => {
        hardenSession();
        registerIpc();
        createWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    });

    app.on('window-all-closed', () => app.quit());
}

/** Створює головне вікно й починає завантаження CRM. */
function createWindow() {
    const windowState = createWindowState();

    mainWindow = new BrowserWindow({
        ...windowState.bounds,
        minWidth: WINDOW_DEFAULTS.minWidth,
        minHeight: WINDOW_DEFAULTS.minHeight,
        title: 'Freecora CRM',
        backgroundColor: nativeTheme.shouldUseDarkColors ? BACKGROUND_COLOR.dark : BACKGROUND_COLOR.light,
        show: false,
        autoHideMenuBar: false,
        // У зібраному застосунку іконку дає ресурс самого .exe; шлях потрібен
        // лише під час розробки, коли Electron запускається з вихідників.
        ...(app.isPackaged ? {} : { icon: join(ROOT, '..', 'build', 'icon.ico') }),
        webPreferences: {
            preload: join(ROOT, 'preload.cjs'),
            partition: PARTITION,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: true,
            webviewTag: false,
        },
    });

    windowState.manage(mainWindow);
    buildMenu(() => mainWindow, loadApp);
    attachNavigationRules(mainWindow);

    mainWindow.once('ready-to-show', () => mainWindow?.show());
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    if (IS_DEV) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Спершу показуємо брендований сплеш, щоб не блимати білим полотном,
    // і одразу починаємо вантажити CRM поверх нього.
    mainWindow.loadFile(join(ROOT, 'renderer', 'loading.html')).then(() => loadApp());
}

/**
 * Завантажує CRM у вікні.
 *
 * @param {string} [path] розділ, наприклад '/dashboard'
 */
function loadApp(path = '') {
    mainWindow?.loadURL(new URL(path, APP_URL).toString());
}

/** Показує брендовану сторінку помилки підключення. */
function loadErrorPage() {
    mainWindow?.loadFile(join(ROOT, 'renderer', 'error.html'));
}

/** Виводить вікно на передній план (другий запуск застосунку). */
function focusWindow() {
    if (!mainWindow) {
        return;
    }

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }

    mainWindow.focus();
}

/**
 * Правила навігації: усе, що не належить Freecora, відкривається в системному
 * браузері, а не всередині застосунку.
 */
function attachNavigationRules(win) {
    const { webContents } = win;

    webContents.setWindowOpenHandler(({ url }) => {
        if (isInternalUrl(url)) {
            win.loadURL(url);
        } else if (url.startsWith('https:') || url.startsWith('http:') || url.startsWith('mailto:')) {
            shell.openExternal(url);
        }

        return { action: 'deny' };
    });

    webContents.on('will-navigate', (event, url) => {
        // file:// — це наші власні loading.html / error.html.
        if (url.startsWith('file:') || isInternalUrl(url)) {
            return;
        }

        event.preventDefault();
        shell.openExternal(url);
    });

    webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame || errorCode === ERR_ABORTED) {
            return;
        }

        console.error(`Не вдалося завантажити ${validatedURL}: ${errorDescription} (${errorCode})`);
        loadErrorPage();
    });

    webContents.on('render-process-gone', (event, { reason }) => {
        if (reason === 'clean-exit') {
            return;
        }

        dialog
            .showMessageBox(win, {
                type: 'error',
                title: 'Freecora CRM',
                message: 'Вікно застосунку несподівано завершило роботу.',
                detail: `Причина: ${reason}`,
                buttons: ['Перезавантажити', 'Закрити'],
                defaultId: 0,
                cancelId: 1,
                noLink: true,
            })
            .then(({ response }) => (response === 0 ? loadApp() : app.quit()));
    });

    // Заголовок вікна лишається сталим — сторінки CRM його не перевизначають.
    win.on('page-title-updated', (event) => event.preventDefault());
}

/** Обмежує дозволи сесії тим мінімумом, який реально потрібен CRM. */
function hardenSession() {
    const crmSession = session.fromPartition(PARTITION);

    crmSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(ALLOWED_PERMISSIONS.has(permission));
    });

    crmSession.setPermissionCheckHandler((webContents, permission) => ALLOWED_PERMISSIONS.has(permission));
}

/** Канали, якими користуються loading.html та error.html. */
function registerIpc() {
    ipcMain.handle('app:info', () => ({
        version: app.getVersion(),
        url: APP_URL,
        host: new URL(APP_URL).host,
    }));

    ipcMain.on('app:retry', () => loadApp());
    ipcMain.on('app:open-in-browser', () => shell.openExternal(APP_URL));
}
