/**
 * Збереження геометрії вікна між запусками.
 *
 * Стан лежить у `window-state.json` всередині каталогу користувача
 * (`%APPDATA%/Freecora CRM`), тож не потрапляє в репозиторій і не заважає
 * портативній версії.
 */

import { app, screen } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { WINDOW_DEFAULTS } from './config.js';

const FILE_NAME = 'window-state.json';
const SAVE_DELAY = 400;

/**
 * Створює менеджер стану вікна.
 *
 * @returns {{ bounds: object, manage: (win: import('electron').BrowserWindow) => void }}
 */
export function createWindowState() {
    const file = join(app.getPath('userData'), FILE_NAME);
    const saved = read(file);
    const bounds = normalize(saved);

    let timer = null;

    /** Прив'язує збереження до подій вікна. */
    function manage(win) {
        if (saved?.maximized) {
            win.maximize();
        }

        const schedule = () => {
            clearTimeout(timer);
            timer = setTimeout(() => persist(file, win), SAVE_DELAY);
        };

        win.on('resize', schedule);
        win.on('move', schedule);
        win.on('close', () => {
            clearTimeout(timer);
            persist(file, win);
        });
    }

    return { bounds, manage };
}

/** Читає збережений стан; будь-яка помилка означає «стану немає». */
function read(file) {
    try {
        const state = JSON.parse(readFileSync(file, 'utf8'));

        return typeof state === 'object' && state !== null ? state : null;
    } catch {
        return null;
    }
}

/** Записує поточну геометрію; помилки запису ігноруємо — це не критично. */
function persist(file, win) {
    if (win.isDestroyed()) {
        return;
    }

    // getNormalBounds() віддає розміри «відновленого» вікна навіть коли воно
    // зараз розгорнуте — саме їх треба пам'ятати.
    const { x, y, width, height } = win.getNormalBounds();

    try {
        writeFileSync(file, JSON.stringify({ x, y, width, height, maximized: win.isMaximized() }, null, 4));
    } catch {
        // no-op
    }
}

/**
 * Перевіряє збережені координати: якщо вікно опинилося поза межами наявних
 * дисплеїв (від'єднали монітор), повертаємо дефолтний розмір без координат —
 * Electron сам відцентрує вікно.
 */
function normalize(state) {
    const defaults = {
        width: WINDOW_DEFAULTS.width,
        height: WINDOW_DEFAULTS.height,
    };

    if (!state || !Number.isFinite(state.width) || !Number.isFinite(state.height)) {
        return defaults;
    }

    const width = Math.max(WINDOW_DEFAULTS.minWidth, Math.round(state.width));
    const height = Math.max(WINDOW_DEFAULTS.minHeight, Math.round(state.height));

    if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) {
        return { width, height };
    }

    const visible = screen.getAllDisplays().some(({ workArea }) => {
        return (
            state.x < workArea.x + workArea.width &&
            state.x + width > workArea.x &&
            state.y < workArea.y + workArea.height &&
            state.y + height > workArea.y
        );
    });

    return visible ? { x: Math.round(state.x), y: Math.round(state.y), width, height } : { width, height };
}
