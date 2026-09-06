/**
 * Конфігурація обгортки.
 *
 * Змінна оточення FREECORA_URL дозволяє запустити застосунок проти іншого
 * середовища (наприклад локального `https://app.freecora.test`) без правок коду:
 *
 *     set FREECORA_URL=https://app.freecora.test && npm start
 */

/** Адреса, яку відкриває застосунок під час запуску. */
export const APP_URL = process.env.FREECORA_URL || 'https://app.freecora.com';

/** Маркетинговий сайт — для пункту меню «Довідка → Сайт Freecora». */
export const SITE_URL = 'https://freecora.com';

/** Куди веде пункт «Повідомити про проблему». */
export const ISSUES_URL = 'https://github.com/mrnko/freecora-desktop/issues';

/** Пошта підтримки. */
export const SUPPORT_EMAIL = 'info@freecora.com';

/**
 * Хости, які застосунок відкриває всередині свого вікна. Усе інше йде в
 * системний браузер. Список будується від хоста APP_URL, тож для локального
 * середовища (`app.freecora.test`) правити нічого не треба.
 */
export const ALLOWED_HOSTS = buildAllowedHosts(APP_URL);

/** Розміри вікна за замовчуванням, якщо збереженого стану ще немає. */
export const WINDOW_DEFAULTS = {
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
};

/**
 * Колір фону вікна до першого малювання — gray-50 / gray-950 з палітри CRM.
 * Потрібен, щоб при запуску не блимало білим на темній системній темі.
 */
export const BACKGROUND_COLOR = { light: '#F9FAFB', dark: '#030712' };

/** Ідентифікатор застосунку для Windows (групування на панелі задач). */
export const APP_USER_MODEL_ID = 'com.freecora.desktop';

/**
 * Збирає білий список хостів із адреси CRM: сам хост, кореневий домен і
 * сусідні піддомени, які використовує Freecora (короткі посилання й запрошення).
 */
function buildAllowedHosts(url) {
    let host;

    try {
        host = new URL(url).hostname;
    } catch {
        host = 'app.freecora.com';
    }

    const root = host.startsWith('app.') ? host.slice(4) : host;

    return [host, root, `go.${root}`, `invite.${root}`, `api.${root}`];
}

/** Чи належить адреса до застосунку (а не до зовнішнього сайту). */
export function isInternalUrl(url) {
    try {
        const { protocol, hostname } = new URL(url);

        return (protocol === 'https:' || protocol === 'http:') && ALLOWED_HOSTS.includes(hostname);
    } catch {
        return false;
    }
}
