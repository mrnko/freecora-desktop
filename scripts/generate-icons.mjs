/**
 * Генерує іконки застосунку без жодних зовнішніх залежностей
 * (використовується лише вбудований у Node модуль `zlib`).
 *
 * Логотип малюється процедурно через signed-distance fields у тій самій
 * 48-одиничній системі координат, що й `public/favicon.svg` у репозиторії CRM,
 * тож форма й кольори збігаються з брендом. Це порт скрипта
 * `scripts/generate-pwa-icons.mjs` із Freecora CRM, доповнений пакуванням у
 * Windows-формат `.ico`.
 *
 * Запуск: `npm run icons`
 * Результат:
 *   build/icon.ico — багаторозмірна іконка застосунку (16…256), із заокругленням
 *   build/icon.png — 512×512 для документації
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'build');

/** Розміри, які Windows очікує знайти в .ico. */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

// ---------- кольори бренду ----------

const hex = (value) => {
    const h = value.replace('#', '');

    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = (value) => Math.min(1, Math.max(0, value));

const G0 = hex('#818CF8');
const G1 = hex('#4F46E5');
const G2 = hex('#4338CA');
const WHITE = [255, 255, 255];
const ACCENT = hex('#A5B4FC');
const DOT = hex('#C7D2FE');

const gradientColor = (t) => (t <= 0.55 ? mix(G0, G1, t / 0.55) : mix(G1, G2, (t - 0.55) / 0.45));
const blend = (base, over, coverage) => mix(base, over, clamp01(coverage));

// ---------- signed-distance fields (у 48-одиничному просторі логотипа) ----------

const sdRoundRect = (px, py, cx, cy, hx, hy, r) => {
    const dx = Math.abs(px - cx) - hx + r;
    const dy = Math.abs(py - cy) - hy + r;

    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
};

const sdSegment = (px, py, ax, ay, bx, by) => {
    const pax = px - ax;
    const pay = py - ay;
    const bax = bx - ax;
    const bay = by - ay;
    const h = clamp01((pax * bax + pay * bay) / (bax * bax + bay * bay));

    return Math.hypot(pax - bax * h, pay - bay * h);
};

const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;

/** Вісь градієнта, як у SVG: linearGradient 6,4 → 42,44. */
const gradT = (px, py) => {
    const abx = 42 - 6;
    const aby = 44 - 4;

    return clamp01(((px - 6) * abx + (py - 4) * aby) / (abx * abx + aby * aby));
};

/** Точки зростаючої ламаної: M27 33.5 L30.5 29.5 L33 32 L37 26.5 */
const ACCENT_POINTS = [
    [27, 33.5],
    [30.5, 29.5],
    [33, 32],
    [37, 26.5],
];

/**
 * Рендерить логотип у RGBA-буфер.
 *
 * @param {number} size     сторона в пікселях
 * @param {boolean} rounded заокруглити кути (для .ico) чи лишити full-bleed (для .png)
 */
function renderIcon(size, rounded) {
    const SS = 2; // суперсемплінг
    const dev = size * SS;
    const ppu = dev / 48; // пікселів пристрою на одиницю логотипа
    const hi = Buffer.alloc(dev * dev * 4);

    for (let y = 0; y < dev; y++) {
        for (let x = 0; x < dev; x++) {
            const u = (x + 0.5) / ppu;
            const v = (y + 0.5) / ppu;

            // Фоновий градієнт.
            let color = gradientColor(gradT(u, v));

            // Легке освітлення верхньої половини (аналог 8% білого шару в SVG).
            if (v < 24) {
                color = blend(color, WHITE, 0.06 * (1 - v / 24));
            }

            // Біла «F» — обʼєднання трьох заокруглених смуг.
            const dF = Math.min(
                sdRoundRect(u, v, 18, 24, 2.5, 11, 2.5),
                sdRoundRect(u, v, 24, 15.5, 8.5, 2.5, 2.5),
                sdRoundRect(u, v, 21.5, 24, 6, 2.5, 2.5),
            );
            color = blend(color, WHITE, 0.5 - dF * ppu);

            // Зростаюча ламана (круглі стики через min по відрізках).
            let dSeg = Infinity;
            for (let i = 0; i < ACCENT_POINTS.length - 1; i++) {
                dSeg = Math.min(dSeg, sdSegment(u, v, ...ACCENT_POINTS[i], ...ACCENT_POINTS[i + 1]));
            }
            color = blend(color, ACCENT, 0.5 - (dSeg - 1.3) * ppu);

            // Крапка на кінці ламаної.
            color = blend(color, DOT, 0.5 - sdCircle(u, v, 37.2, 26.4, 1.9) * ppu);

            // Заокруглення кутів бейджа (rx=12 при боці 48, як у SVG).
            const alpha = rounded ? clamp01(0.5 - sdRoundRect(u, v, 24, 24, 24, 24, 12) * ppu) : 1;

            const idx = (y * dev + x) * 4;
            hi[idx] = Math.round(color[0]);
            hi[idx + 1] = Math.round(color[1]);
            hi[idx + 2] = Math.round(color[2]);
            hi[idx + 3] = Math.round(alpha * 255);
        }
    }

    // Даунсемпл боксовим фільтром до фінального розміру.
    const out = Buffer.alloc(size * size * 4);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;

            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    const i = ((y * SS + sy) * dev + (x * SS + sx)) * 4;
                    r += hi[i];
                    g += hi[i + 1];
                    b += hi[i + 2];
                    a += hi[i + 3];
                }
            }

            const n = SS * SS;
            const o = (y * size + x) * 4;
            out[o] = Math.round(r / n);
            out[o + 1] = Math.round(g / n);
            out[o + 2] = Math.round(b / n);
            out[o + 3] = Math.round(a / n);
        }
    }

    return out;
}

// ---------- мінімальний PNG-енкодер ----------

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);

    for (let n = 0; n < 256; n++) {
        let c = n;

        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }

        table[n] = c >>> 0;
    }

    return table;
})();

const crc32 = (buf) => {
    let c = 0xffffffff;

    for (let i = 0; i < buf.length; i++) {
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }

    return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);

    return Buffer.concat([len, typeBuf, data, crc]);
};

function encodePng(size, rgba) {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; // глибина
    ihdr[9] = 6; // тип кольору: RGBA

    const stride = size * 4;
    const raw = Buffer.alloc((stride + 1) * size);

    for (let y = 0; y < size; y++) {
        raw[y * (stride + 1)] = 0; // фільтр: none
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
    }

    const idat = zlib.deflateSync(raw, { level: 9 });

    return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- пакування .ico ----------

/**
 * Збирає .ico з готових PNG-зображень.
 *
 * Формат дозволяє зберігати кадри як PNG напряму (Windows Vista і новіші), тож
 * достатньо заголовка ICONDIR і по одному ICONDIRENTRY на кожен розмір.
 *
 * @param {{ size: number, png: Buffer }[]} images
 */
function encodeIco(images) {
    const HEADER_SIZE = 6;
    const ENTRY_SIZE = 16;

    const header = Buffer.alloc(HEADER_SIZE);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // тип: 1 = іконка
    header.writeUInt16LE(images.length, 4);

    const directory = Buffer.alloc(ENTRY_SIZE * images.length);
    let offset = HEADER_SIZE + directory.length;

    images.forEach(({ size, png }, index) => {
        const at = index * ENTRY_SIZE;

        directory[at] = size >= 256 ? 0 : size; // 0 означає 256
        directory[at + 1] = size >= 256 ? 0 : size;
        directory[at + 2] = 0; // кількість кольорів палітри
        directory[at + 3] = 0; // reserved
        directory.writeUInt16LE(1, at + 4); // площини
        directory.writeUInt16LE(32, at + 6); // біт на піксель
        directory.writeUInt32LE(png.length, at + 8);
        directory.writeUInt32LE(offset, at + 12);

        offset += png.length;
    });

    return Buffer.concat([header, directory, ...images.map(({ png }) => png)]);
}

// ---------- запис файлів ----------

fs.mkdirSync(OUT_DIR, { recursive: true });

const icoImages = ICO_SIZES.map((size) => ({ size, png: encodePng(size, renderIcon(size, true)) }));
const ico = encodeIco(icoImages);
fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), ico);
console.log(`✔ build/icon.ico (${ICO_SIZES.join(', ')} — ${(ico.length / 1024).toFixed(1)} KB)`);

const png512 = encodePng(512, renderIcon(512, false));
fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), png512);
console.log(`✔ build/icon.png (512×512 — ${(png512.length / 1024).toFixed(1)} KB)`);
