import { LOCALIZE_KEY, MODULE_ID } from "./CONSTS.mjs";
import { getSetting } from "./settings.mjs";

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

/**
 * Logs a message to the console, respecting the user's logLevel setting.
 * @param {"log"|"warn"|"info"|"debug"} type 
 * @param {string} msg 
 * @param {Record<string, any>} [data={}]  An object containing additional data to log.
 * @throws {Error} If an invalid `type` is provided.
 * @returns {void}
 */
export function log(type, msg, data={}) {
    const logLevels = ["warn","log","info", "debug"];

    const typeIndex = logLevels.indexOf(type);    
    if(typeIndex === -1) throw new Error(`shareddice | Invalid log type "${type}".`);

    const logLevel = getSetting("logLevel");    
    const maxVerbosity = logLevels.indexOf(logLevel);
    if(typeIndex > maxVerbosity) return;    // Also catches logLevel "none"

    const clonedData = foundry.utils.deepClone(data);
    console[type](`${MODULE_ID} | ${msg}`, clonedData);
}
