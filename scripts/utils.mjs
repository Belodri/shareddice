import { LOCALIZE_KEY } from "./CONSTS.mjs";

/**
 * @typedef NotificationOptions
 * @property {boolean} [permanent=false]     Should the notification be permanently displayed until dismissed
 * @property {boolean} [progress=false]      Does this Notification include a progress bar?
 * @property {boolean} [localize=false]      Whether to localize the message content before displaying it
 * @property {boolean} [console=true]        Whether to log the message to the console
 * @property {boolean} [escape=true]         Whether to escape the values of `format`
 * @property {boolean} [clean=true]          Whether to clean the provided message string as untrusted user input.
 *                                           No cleaning is applied if `format` is passed and `escape` is true or
 *                                           `localize` is true and `format` is not passed.
 * @property {Record<string, string>} [format] A mapping of formatting strings passed to Localization#format
 */

/**
 * A simple wrapper for ui.notifications.notify that always localizes.
 * @param {string} msg                              The localization key without prefix.
 * @param {"success"|"info"|"warn"|"error"} type 
 * @param {NotificationOptions} [options={}] 
 */
export function notify(msg, type, options={}) {
    const fullMsg = `${LOCALIZE_KEY}.Notifications.${msg}`;
    options.localize =  true;
    return ui.notifications.notify(fullMsg, type, options);
}
