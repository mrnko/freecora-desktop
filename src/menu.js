/**
 * Нативне меню застосунку (українською, як і сам продукт).
 */

import { app, dialog, Menu, shell } from 'electron';

import { APP_URL, ISSUES_URL, SITE_URL, SUPPORT_EMAIL } from './config.js';

/**
 * Будує й застосовує головне меню.
 *
 * @param {() => import('electron').BrowserWindow|null} getWindow повертає активне вікно
 * @param {(path?: string) => void} loadApp завантажує CRM (опційно — конкретний розділ)
 */
export function buildMenu(getWindow, loadApp) {
    const template = [
        {
            label: 'Файл',
            submenu: [
                {
                    label: 'Перезавантажити',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => getWindow()?.webContents.reload(),
                },
                {
                    label: 'На головну',
                    accelerator: 'CmdOrCtrl+Home',
                    click: () => loadApp('/dashboard'),
                },
                { type: 'separator' },
                {
                    label: 'Відкрити у браузері',
                    click: () => shell.openExternal(getWindow()?.webContents.getURL() || APP_URL),
                },
                { type: 'separator' },
                { role: 'quit', label: 'Вийти', accelerator: 'CmdOrCtrl+Q' },
            ],
        },
        {
            label: 'Редагування',
            submenu: [
                { role: 'undo', label: 'Скасувати' },
                { role: 'redo', label: 'Повторити' },
                { type: 'separator' },
                { role: 'cut', label: 'Вирізати' },
                { role: 'copy', label: 'Копіювати' },
                { role: 'paste', label: 'Вставити' },
                { role: 'delete', label: 'Видалити' },
                { type: 'separator' },
                { role: 'selectAll', label: 'Виділити все' },
            ],
        },
        {
            label: 'Вигляд',
            submenu: [
                { role: 'resetZoom', label: 'Звичайний масштаб' },
                { role: 'zoomIn', label: 'Збільшити' },
                { role: 'zoomOut', label: 'Зменшити' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'На весь екран' },
                { type: 'separator' },
                { role: 'toggleDevTools', label: 'Інструменти розробника' },
            ],
        },
        {
            label: 'Довідка',
            submenu: [
                {
                    label: 'Сайт Freecora',
                    click: () => shell.openExternal(SITE_URL),
                },
                {
                    label: 'Повідомити про проблему',
                    click: () => shell.openExternal(ISSUES_URL),
                },
                {
                    label: 'Написати в підтримку',
                    click: () => shell.openExternal(`mailto:${SUPPORT_EMAIL}`),
                },
                { type: 'separator' },
                {
                    label: 'Про застосунок',
                    click: () => showAbout(getWindow()),
                },
            ],
        },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** Вікно «Про застосунок» із версіями рантайму. */
function showAbout(win) {
    const detail = [
        `Версія застосунку: ${app.getVersion()}`,
        `Electron: ${process.versions.electron}`,
        `Chromium: ${process.versions.chrome}`,
        `Node.js: ${process.versions.node}`,
        '',
        `Підключення: ${APP_URL}`,
    ].join('\n');

    dialog.showMessageBox(win ?? undefined, {
        type: 'info',
        title: 'Про застосунок',
        message: 'Freecora CRM',
        detail,
        buttons: ['Закрити'],
        noLink: true,
    });
}
