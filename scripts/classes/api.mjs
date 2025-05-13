import { MODULE_ID } from "./../CONSTS.mjs";
import { getQuant, getUser, setQuant, hasEditRole, getAllQuants } from "./UserHandler.mjs";
import { notify } from "../utils.mjs";
import DiceType from "./DiceType.mjs";
import MessageHandler from "./MessageHandler.mjs";
import { getSetting } from "../settings.mjs";


/** 
 * @import User from "@client/documents/user.mjs"
 * @import ChatMessage from "@client/documents/chat-message.mjs";
 * @import Hooks from "@client/helpers/hooks.mjs";
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
        getUserDice,
        findDiceTypesByName,
        DiceType
    };

    window[MODULE_ID] = game.modules.get(MODULE_ID).api = API;
}

/**
 * Find a DiceType by name.
 * @param {string} dieName              The name to search for.
 * @param {boolean} [rawData=false]     If true, returns raw data objects instead of DiceType instances.
 * @returns {DiceType[]|import("./DiceType.mjs").DiceTypeData[]}    An array of all dice types with that name or an array of objects of said dice types.
 */
function findDiceTypesByName(dieName, rawData=false) {
    const allTypesData = getSetting("diceTypes");
    const foundData = Object.values(allTypesData).filter(data => data.name === dieName);
    return rawData ? foundData : foundData.map(data => new DiceType(data));
}

/**
 * Get the quantity of a specific die from the user.
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

    /**
     * A hook event that fires before a die is added to a target.
     * @function shareddice.preAdd
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being added.
     * @param {User} targetUser                         The user who's die is about to be added.
     * @param {number} newQuant                         The new quantity of the die the target user would have after adding.
     * @returns {boolean}                               Return `false` to prevent the die from being added.
     */
    if(Hooks.call(`${MODULE_ID}.preAdd`, diceId, targetUser, newQuant) === false) return null;

    await setQuant(targetUser, diceId, newQuant);
    const ret = await MessageHandler.send("add", diceType, {targetUser});

    /**
     * A hook event that fires after a die is added to a target.
     * @function shareddice.add
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being added.
     * @param {User} targetUser                         The user who's die was added.
     * @param {number} newQuant                         The quantity of the die the target has.
     */
    Hooks.callAll(`${MODULE_ID}.add`, diceId, targetUser, newQuant);

    return ret;
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

    /**
     * A hook event that fires before a die is removed from a target.
     * @function shareddice.preRemove
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being removed.
     * @param {User} targetUser                         The user who's die is about to be removed.
     * @param {number} newQuant                         The new quantity of the die the target user would have after removal.
     * @returns {boolean}                               Return `false` to prevent the die from being removed.
     */
    if(Hooks.call(`${MODULE_ID}.preRemove`, diceId, targetUser, newQuant) === false) return null;

    await setQuant(targetUser, diceId, newQuant);
    const ret = await MessageHandler.send("remove", diceType, {targetUser});

    /**
     * A hook event that fires after a die is removed from a target.
     * @function shareddice.remove
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being removed.
     * @param {User} targetUser                         The user who's die was removed.
     * @param {number} newQuant                         The quantity of the die the target has left.
     */
    Hooks.callAll(`${MODULE_ID}.remove`, diceId, targetUser, newQuant);

    return ret;
}


/**
 * Use a given die.
 * @param {string} diceId         
 * @returns {Promise<ChatMessage|true|null>} Resolves to the resulting ChatMessage, true if no message template was configured, or null on failure.
 */
async function use(diceId) {
    const /** @type {DiceType} */ diceType = DiceType.getFromId(diceId);

    const prevQuant = getQuant(game.user, diceId) ?? 0;
    if(prevQuant <= 0) {
        notify("noUsesRemaining", "warn", {format: {diceTypeName: diceType.name}});
        return null;
    }
    const newQuant = prevQuant - 1;

    /**
     * A hook event that fires before a die is used.
     * @function shareddice.preUse
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being used.
     * @param {number} newQuant                         The quantity of the die the user would have left after using.
     * @returns {boolean}                               Return `false` to prevent the die from being used.
     */
    if(Hooks.call(`${MODULE_ID}.preUse`, diceId, newQuant) === false) return null;

    await setQuant(game.user, diceId, newQuant);
    const ret = await MessageHandler.send("use", diceType); 

    /**
     * A hook event that fires after a die is used.
     * @function shareddice.use
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being used.
     * @param {number} newQuant                         The quantity of the die the user has left.
     */
    Hooks.callAll(`${MODULE_ID}.use`, diceId, newQuant);
    return ret;
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
        notify("noUsesRemaining", "warn", {format: {diceTypeName: diceType.name}});
        return null;
    }

    const targetPrevQuant = getQuant(targetUser, diceId) ?? 0;
    if(targetPrevQuant >= diceType.limit) {
        notify("onOverLimit", "warn", { format: {diceTypeLimit: diceType.limit, diceTypeName: diceType.name} });
        return null;
    }

    const newSelfQuant = selfPrevQuant - 1;
    const newTargetQuant = targetPrevQuant + 1;


    /**
     * A hook event that fires before a die is gifted to a target.
     * @function shareddice.preGift
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being gifted.
     * @param {User} targetUser                         The user about to receive the die.
     * @param {number} newSelfQuant                     The quantity of the die the user would have left after gifting.
     * @param {number} newTargetQuant                   The new quantity of the die the target user would have after gifting.
     * @returns {boolean}                               Return `false` to prevent the die from being gifted.
     */
    if(Hooks.call(`${MODULE_ID}.preGift`, diceId, targetUser, newSelfQuant, newTargetQuant ) === false) return null;

    await setQuant(game.user, diceId, newSelfQuant);
    await setQuant(targetUser, diceId, newTargetQuant);
    const ret = await MessageHandler.send("gift", diceType, {targetUser});

    /**
     * A hook event that fires after a die is gifted to a target.
     * @function shareddice.gift
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being gifted.
     * @param {User} targetUser                         The user who received the die.
     * @param {number} newSelfQuant                     The quantity of the die the user has left after gifting.
     * @param {number} newTargetQuant                   The new quantity of the die the target user has after gifting.
     */
    Hooks.callAll(`${MODULE_ID}.gift`, diceId, targetUser, newSelfQuant, newTargetQuant );

    return ret;
}
