import DiceType from "./DiceType.mjs";
import { notify } from "../utils.mjs";
import { MODULE_ID, USER_FLAG } from "../CONSTS.mjs";
import { getQuant } from "./UserHandler.mjs";

/**
 * @import User from "@client/documents/user.mjs"
 */

export default class QueryManager {
    static TIMEOUT = 30000;

    static QUERY_EVENTS = {
        _modifyQuant: _modifyQuant,
    }

    static register() {
        for(const [k, v] of Object.entries(this.QUERY_EVENTS)) {
            CONFIG.queries[`${MODULE_ID}.${k}`] = v;
        }
    }

    /**
     * Simple wrapper for User#query.
     * @param {string} eventName 
     * @param {User} targetUser 
     * @param {object} queryData 
     * @param {object} [config] 
     * @param {number} [config.timeout]
     * @param {boolean} [config.handleResponseObj] Should the response object be handled? If not it is returned directly.
     * @returns {Promise<any>}
     */
    static async query(eventName, targetUser, queryData, {timeout, handleResponseObj=true}={}) {
        const queryKey = `${MODULE_ID}.${eventName}`;

        if(!Number.isSafeInteger(timeout) || timeout <= 0) timeout = QueryManager.TIMEOUT;

        let res = null;
        try {
            res = targetUser.isSelf
                ? await Promise.resolve(CONFIG.queries[queryKey](queryData))
                : await targetUser.query(queryKey, queryData, { timeout });
        } catch(err) {
            notify("unexpectedError", "error", { console: false });
            console.error(`${MODULE_ID} | Query Error`, err);
        }

        return res && handleResponseObj 
            ? this._handleResponseObj(res)
            : res;
    }

    /**
     * @typedef {object} NotifParams
     * @property {string} msg                              The localization key without prefix.
     * @property {"success"|"info"|"warn"|"error"} type 
     * @property {NotificationOptions} [options={}] 
     */

    /**
     * Handles the response from a user query, displaying notifications if necessary.
     * @param {true|NotifParams|any} res The response from the user query.
     * @returns {boolean} True if the response indicates success, false otherwise.
     */
    static _handleResponseObj(res) {
        if(res === true) return true;
        
        if(res?.msg &&  res?.type) {
            notify(res.msg, res.type, res.options ?? {});
            return false;
        }

        notify("unexpectedError", "error", { console: false });
        console.error(`${MODULE_ID} | Unexpected query response`, res);
        return false;
    }
}

/**
 * 
 * @param {object} queryData
 * @param {string} queryData.diceId
 * @param {number} queryData.delta 
 * @returns {Promise<true|NotifParams>}
 */
async function _modifyQuant({diceId, delta}) {
    const diceType = DiceType.getFromId(diceId);
    const currentQuant = getQuant(game.user, diceId) ?? 0;
    const newQuant = currentQuant + delta;

    if(newQuant < 0) return { 
        msg: "onNegative",
        type: "warn"
    };

    if(newQuant > diceType.limit) return {
        msg: "onOverLimit",
        type: "warn",
        options: {
            format: { diceTypeLimit: diceType.limit, diceTypeName: diceType.name }
        }
    };

    await game.user.setFlag(MODULE_ID, `${USER_FLAG}.${diceId}`, newQuant);
    return true;
}
