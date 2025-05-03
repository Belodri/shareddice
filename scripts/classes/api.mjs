import { MODULE_ID } from "./../CONSTS.mjs";
import { getQuant, getUser, setQuant, hasEditRole, getAllQuants } from "./UserHandler.mjs";
import { notify } from "../utils.mjs";

/** 
 * @import User from "@client/documents/user.mjs"
 * @import ChatMessage from "@client/documents/chat-message.mjs";
 */

/**
 * Register the module's API
 */
export function registerAPI() {
    const API = {
        add,
        remove,
        use,
        gift,
        getUserDice
    };

    window[MODULE_ID] = game.modules.get(MODULE_ID).api = API;
}

/**
 * Gets the quantity of a specific die from the user.
 * @param {User|string} targetUserOrId 
 * @param {string} [diceId=null]        If falsey, returns a record of all dice on the user instead.
 * @returns {number|import("./UserHandler.mjs").UserDiceData|undefined} 
 */
function getUserDice(targetUserOrId, diceId=null) {
    return diceId ? getQuant(targetUserOrId, diceId) : getAllQuants(targetUserOrId)
} 

/**
 * Add a die of a given id to a user.
 * @param {User|string} targetUserOrId 
 * @param {string} diceId 
 * @returns {Promise<ChatMessage|true>|null} Resolves to the resulting ChatMessage, true if no message template was configured, or null on failure.
 */
async function add(targetUserOrId, diceId) {
    const targetUser = getUser(targetUserOrId);
    if(hasEditRole(targetUser.id)) {
        notify("roleCannotHave", "warn");
        return null;
    }

    const /** @type {DiceType} */ diceType = DiceType.getFromId(diceId);
    
    const prevQuant = getQuant(targetUser, diceId) ?? 0;
    if(prevQuant >= diceType.limit) {
        notify("onOverLimit", "warn", { format: {diceTypeLimit: diceType.limit, diceTypeName: diceType.name} });
        return null;
    }

    const newQuant = prevQuant + 1;
    await setQuant(targetUser, diceId, newQuant);
    return MessageHandler.send("add", {diceType, targetUser});  //TODO implement Message Handler
}

/**
 * Remove a die of a given id to a user.
 * @param {User|string} targetUserOrId 
 * @param {string} diceId 
 * @returns {Promise<ChatMessage|true|null>} Resolves to the resulting ChatMessage, true if no message template was configured, or null on failure.
 */
async function remove(targetUserOrId, diceId) {
    const targetUser = getUser(targetUserOrId);
    if(hasEditRole(targetUser.id)) {
        notify("roleCannotHave", "warn");
        return null;
    }

    const /** @type {DiceType} */ diceType = DiceType.getFromId(diceId);
    
    const prevQuant = getQuant(targetUser, diceId) ?? 0;
    if(prevQuant <= 0) {
        notify("onNegative", "warn");
        return null;
    }

    const newQuant = prevQuant - 1;
    await setQuant(targetUser, diceId, newQuant);
    return MessageHandler.send("remove", {diceType, targetUser});  //TODO implement Message Handler
}


/**
 * Use a given die.
 * @param {string} diceId         
 * @returns {Promise<ChatMessage|true|null>} Resolves to the resulting ChatMessage, true if no message template was configured, or null on failure.
 */
async function use(diceId) {
    const prevQuant = getQuant(game.user, diceId) ?? 0;
    if(prevQuant <= 0) {
        notify("onNegative", "warn");
        return null;
    }
    const newQuant = prevQuant - 1;

    const /** @type {DiceType} */ diceType = DiceType.getFromId(diceId);

    await setQuant(game.user, diceId, newQuant);
    return MessageHandler.send("use", {diceType});  //TODO implement Message Handler
}

/**
 * Gift one use of a die to another user.
 * @param {User|string} targetUserOrId 
 * @param {string} diceId 
 * @returns {Promise<ChatMessage|true|null>} Resolves to the resulting ChatMessage, true if no message template was configured, or null on failure.
 */
async function gift(targetUserOrId, diceId) {
    const targetUser = getUser(targetUserOrId);

    if(hasEditRole(targetUser.id)) {
        notify("roleCannotHave", "warn");
        return null;
    }

    const /** @type {DiceType} */ diceType = DiceType.getFromId(diceId);

    const selfPrevQuant = getQuant(game.user, diceId) ?? 0;
    if(selfPrevQuant <= 0) {
        notify("onNegative", "warn");
        return null;
    }

    const targetPrevQuant = getQuant(targetUser, diceId) ?? 0;
    if(targetPrevQuant >= diceType.limit) {
        notify("onOverLimit", "warn", { format: {diceTypeLimit: diceType.limit, diceTypeName: diceType.name} });
        return null;
    }

    const newSelfQuant = selfPrevQuant - 1;
    const newTargetQuant = targetPrevQuant + 1;
    await setQuant(game.user, diceId, newSelfQuant);
    await setQuant(targetUser, diceId, newTargetQuant);
    return MessageHandler.send("gift", {diceType, targetUser});  //TODO implement Message Handler
}
