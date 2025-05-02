import { MODULE_ID, LOCALIZE_KEY } from "./CONSTS.mjs";

/**
 * A simple wrapper for ui.notifications.notify that always localizes.
 * @param {string} msg                              The localization key without prefix.
 * @param {"success"|"info"|"warn"|"error"} type 
 * @param {Record<string, string>} [format]         A mapping of formatting strings passed to Localization#format
 * @returns 
 */
export function notify(msg, type, format=undefined) {
    const fullMsg = `${LOCALIZE_KEY}.Notifications.${msg}`;
    return ui.notifications.notify(fullMsg, type, { localize: true, format });
}
