import { MODULE_ID } from "./../CONSTS.mjs";
import { getQuant, getUser, canEdit, getAllQuants } from "./UserHandler.mjs";
import { notify } from "../utils.mjs";
import DiceType from "./DiceType.mjs";
import MessageHandler from "./MessageHandler.mjs";
import { getSetting } from "../settings.mjs";
import QueryManager from "./QueryManager.mjs";


/** 
 * @import User from "@client/documents/user.mjs"
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
 * Add a die of a given id to a user and creates the chat message.
 * @param {User|string} targetUserOrId          The user (or userId) whose die to add. 
 * @param {string} diceId                       The id of the die to add.
 * @param {object} [config]                     Additional configuration options.
 * @param {number} [config.amount=1]            How many die should be added? Default = 1;
 * @param {boolean} [config.chatMessage=true]   Should a chat message be created?
 * @param {object} [config.messageData]         The data object to use when creating the message.
 * @returns {Promise<boolean>}                  A promise that resolves to true if the action was successful, or false if not.
 */
async function add(targetUserOrId, diceId,  {amount=1, chatMessage=true, messageData={}}={}) {
    const targetUser = getUser(targetUserOrId);
    const diceType = DiceType.getFromId(diceId);

    if(!canEdit(game.user, targetUser, diceId)) {
        notify("missingEditPermission", "warn");
        return false;
    }

    /**
     * A hook event that fires before a die is added to a target.
     * @function shareddice.preAdd
     * @memberof hookEvents
     * @param {string} diceId            Id of the die being added.
     * @param {User} targetUser          The user whose die is about to be added.
     * @param {number} amount            The quantity of the die about to be added.
     * @returns {boolean}                Return `false` to prevent the die from being added.
     */
    if(Hooks.call(`${MODULE_ID}.preAdd`, diceId, targetUser, amount) === false) return false;

    if( !await QueryManager.query("_modifyQuant", targetUser, {diceId, delta: amount}) ) return false;

    /**
     * A hook event that fires after a die is added to a target.
     * @function shareddice.add
     * @memberof hookEvents
     * @param {string} diceId           Id of the die being added.
     * @param {User} targetUser         The user whose die was added.
     * @param {number} amount           The quantity of the die that was added.
     */
    Hooks.callAll(`${MODULE_ID}.add`, diceId, targetUser, amount);

    if(chatMessage) await MessageHandler.send("add", diceType, {targetUser, amount, messageData})

    return true;
}

/**
 * Remove a die of a given id from a user and creates the chat message.
 * @param {User|string} targetUserOrId          The user (or userId) whose die to remove. 
 * @param {string} diceId                       The id of the die to remove.
 * @param {object} [config]                     Additional configuration options.
 * @param {number} [config.amount=1]            How many die should be removed? Default = 1;
 * @param {boolean} [config.chatMessage=true]   Should a chat message be created?
 * @param {object} [config.messageData]         The data object to use when creating the message.
 * @returns {Promise<boolean>}                  A promise that resolves to true if the action was successful, or false if not.
 */
async function remove(targetUserOrId, diceId,  {amount=1, chatMessage=true, messageData={}}={}) {
    const targetUser = getUser(targetUserOrId);
    const diceType = DiceType.getFromId(diceId);
    
    if(!canEdit(game.user, targetUser, diceId)) {
        notify("missingEditPermission", "warn");
        return false;
    }

    /**
     * A hook event that fires before a die is removed from a target.
     * @function shareddice.preRemove
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being removed.
     * @param {User} targetUser                         The user whose die is about to be removed.
     * @param {number} amount                           The quantity of the die about to be removed.
     * @returns {boolean}                               Return `false` to prevent the die from being removed.
     */
    if(Hooks.call(`${MODULE_ID}.preRemove`, diceId, targetUser, amount) === false) return false;

    if( !await QueryManager.query("_modifyQuant", targetUser, {diceId, delta: -amount}) ) return false;

    /**
     * A hook event that fires after a die is removed from a target.
     * @function shareddice.remove
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being removed.
     * @param {User} targetUser                         The user whose die was removed.
     * @param {number} amount                           The quantity of the die that was removed.
     */
    Hooks.callAll(`${MODULE_ID}.remove`, diceId, targetUser, amount);

    if(chatMessage) await MessageHandler.send("remove", diceType, {targetUser, amount, messageData});

    return true;
}

/**
 * Use a given die.
 * @param {string} diceId                       The id of the die to use.
 * @param {object} [config]                     Additional configuration options.
 * @param {number} [config.amount=1]            How many die should be used? Default = 1;
 * @param {boolean} [config.chatMessage=true]   Should the chat message be created?
 * @param {object} [config.messageData]         The data object to use when creating the message.
 * @returns {Promise<boolean>}                  A promise that resolves to true if the action was successful, or false if not.
 */
async function use(diceId, {amount=1, chatMessage=true, messageData={}}={}) {
    const diceType = DiceType.getFromId(diceId);

    /**
     * A hook event that fires before a die is used.
     * @function shareddice.preUse
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being used.
     * @param {number} amount                           The quantity of the die about to be used.
     * @returns {boolean}                               Return `false` to prevent the die from being used.
     */
    if(Hooks.call(`${MODULE_ID}.preUse`, diceId, amount) === false) return false;

    if( !await QueryManager.query("_modifyQuant", game.user, {diceId, delta: -amount}) ) return false;

    /**
     * A hook event that fires after a die is used.
     * @function shareddice.use
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being used.
     * @param {number} amount                           The quantity of the die that was used.
     */
    Hooks.callAll(`${MODULE_ID}.use`, diceId, amount);

    if(chatMessage) await MessageHandler.send("use", diceType, {amount, messageData});

    return true;
}


/**
 * Gift one use of a die to another user.
 * @param {User|string} targetUserOrId          The user (or userId) who should receive the die. 
 * @param {string} diceId                       The id of the die to gift.
 * @param {object} [config]                     Additional configuration options.
 * @param {number} [config.amount=1]            How many die should be gifted? Default = 1;
 * @param {boolean} [config.chatMessage=true]   Should the chat message be created?
 * @param {object} [config.messageData]         The data object to use when creating the message.
 * @returns {Promise<boolean>}                  A promise that resolves to true if the action was successful, or false if not.
 */
async function gift(targetUserOrId, diceId, {amount=1, chatMessage=true, messageData={}}={}) {
    const targetUser = getUser(targetUserOrId);
    const diceType = DiceType.getFromId(diceId);

    if(!diceType.allowGift) {
        notify("disallowedGift", "warn");
        return false;
    }

    /**
     * A hook event that fires before a die is gifted to a target.
     * @function shareddice.preGift
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being gifted.
     * @param {User} targetUser                         The user about to receive the die.
     * @param {number} amount                           The quantity of the die about to be gifted.
     * @returns {boolean}                               Return `false` to prevent the die from being gifted.
     */
    if(Hooks.call(`${MODULE_ID}.preGift`, diceId, targetUser, amount ) === false) return false;

    if( !await QueryManager.query("_modifyQuant", game.user, {diceId, delta: -amount}) ) return false;

    const succeeded = await QueryManager.query("_modifyQuant", targetUser, {diceId, delta: amount});
    if(!succeeded) {
        // Rollback previous change on fail. 
        await QueryManager.query("_modifyQuant", game.user, {diceId, delta: amount});
        return false;
    }

    /**
     * A hook event that fires after a die is gifted to a target.
     * @function shareddice.gift
     * @memberof hookEvents
     * @param {string} diceId                           Id of the die being gifted.
     * @param {User} targetUser                         The user who received the die.
     * @param {number} amount                           The quantity of the die that was gifted.
     */
    Hooks.callAll(`${MODULE_ID}.gift`, diceId, targetUser, amount );

    if(chatMessage) await MessageHandler.send("gift", diceType, {targetUser, amount, messageData});

    return true;
}
