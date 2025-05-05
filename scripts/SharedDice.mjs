import { MODULE_ID } from "./CONSTS.mjs";
import { getSetting } from "./settings.mjs";

/**
 * @typedef {object} UserDie
 * @property {string} id    The internal id of the die
 * @property {string} name  The name of the die as configured in the settings
 * @property {number} count How many of that die does the user have.
 */

/**
 * A mapping of diceIds to the amount the user has of those dice.
 * @typedef {{[diceId: string]: number}} FlagData
 */

class SharedDiceAPI {
    /**
     * Gets how many of a given die the user has.  
     * @param {string} userId 
     * @param {string} dieId
     * @returns {number}    The amount of the die (default to 0) or null if flagData was missing completely.
     */
    static getAmount(userId, dieId) {
        const flagData = SharedDiceAPI.#getFlagData(userId);
        return flagData ? (flagData[dieId] ?? 0) : null;
    }

    /**
     * Gets an object of dieIds and their respective amounts.
     * @param {string} userId 
     * @returns {FlagData}
     */
    static getAllAmounts(userId) {
        return SharedDiceAPI.#getFlagData(userId);
    }

    /**
     * Sets how many of a given die the user has.
     * @param {string} userId 
     * @param {string} dieId 
     * @param {number} amount 
     */
    static async setAmount(userId, dieId, amount) {
        const flagData = SharedDiceAPI.#getFlagData(userId);
        flagData[dieId] = amount;
    }

    static async increase(userId, dieId) {

    }

    static async decrease(userId, dieId) {

    }

    static async gift(sourceUserId, targetUserId) {

    }

    static async use(userId) {

    }

    //#region Helpers

    static #getFlagData(userId) {
        const user = game.users.get(userId);
        if(!user) return null;
        return user.getFlag(MODULE_ID, "diceData");
    }

    static async #setFlagData(userId, data) {
        const user = game.users.get(userId);
        if(!user) return null;
        if(!SharedDice.verifyFlagData(data)) return null;
        return user.setFlag(MODULE_ID, "diceData")
    }

    //#endregion
}

class Warnings {
    static TYPES = [
        "underflow"
    ]

    static warn(type, ...args) {

    }
}


class SharedDie {
    #amount = 0;

    /**
     * 
     * @param {object} dieData
     * @param {string} dieData.id       The id of the die, as defined in the settings
     * @param {number} dieData.amount    How many of that die the user has
     */
    constructor({id, amount}) {
        this.id = id;
        this.#amount = amount;
    }

    get amount() { return this.#amount; }

    setAmount(value) {
        if(!this._validateAmountChange(value)) return null;
        this.#amount = value;
        return this.amount;
    }

    get name() {
        //get the name of the die with this ID from the settings
    }

    get maxAmount() {
        return 2;   //get the max count for this die from the settings
    }

    warn(msg) {

    }

    increase(by=1) {
        return this.setAmount(this.amount + by)
    }

    decrease(by=1) {

    }
    
    /**
     * Validates a change to amount before it's applied.
     * @param {number} newAmount 
     * @param {boolean} [warn=true] 
     * @returns {boolean}
     */
    _validateAmountChange(newAmount, warn=true) {
        if(!Number.isSafeInteger(newAmount)) {
            if(warn) Warnings.warn("unsafeInt", this);
            return false;
        }

        if(newAmount < 0) {
            if(warn) Warnings.warn("underflow", this);
            return false;
        }

        if(this.maxAmount !== -1 && newAmount > this.maxAmount) {
            if(warn) Warnings.warn("overflow", this);
            return false;
        }

        return true;
    }
    
}




export default class SharedDice {
    static USER_FLAG_PATH = `userDiceCount`

    static onUpdateUser(user, changed, options, userId) {
        if( foundry.utils.hasProperty(changed, `flags.${MODULE_ID}.userDiceCount`) ) {
            SharedDice.onDiceCountChanged(userId);
        }
    }

    static handleRequest({action, targetUserId, data}) {
        if(targetUserId !== game.userId) return;

        switch (action) {
            case "setDiceCount":
                return SharedDice._setDiceCountSelf(data);
        }
    }

    /**
     * Called whenever the dice count of ANY user has changed.
     * @param {string} userId   The id of the user who's dice count changed.
     */
    static async onDiceCountChanged(userId) {
        
    }

    /**
     * 
     * @param {string} userId 
     * @returns {number}
     */
    static getDiceCount(userId) {
        const user = game.users.get(userId);
        return user ? (user.getFlag(MODULE_ID, "userDiceCount") ?? 0) : null;
    }

    /**
     * Sets the dice count of the executing user.
     * @param {number} targetValue 
     * @returns {Promise<User>}
     */
    static async _setDiceCountSelf(targetValue) {
        return game.user.setFlag(MODULE_ID, "userDiceCount", targetValue);
    }

    /**
     * Sets the dice count of a given user. For missing permissions, defers to socket.
     * At this point all data is assumed to be valid.
     * @param {string} userId 
     * @param {number} targetValue 
     */
    static async setDiceCount(userId, targetValue) {
        const targetUser = game.users.get(userId);
        if(targetUser.isOwner) return SharedDice._setDiceCountSelf(targetValue);
        
        game.socket.emit(`module.${MODULE_ID}`, {
            action: 'setDiceCount',
            targetUserId: userId,
            data: targetValue
        });
    }

    //#region Button Interactions

    static async grantDice(userId) {


        const currentCount = SharedDice.getDiceCount(userId);
        const newCount = currentCount + 1;
        if(!SharedDice.#isValidDiceCount(currentCount + 1)) return false;
        
    }

    //#endregion

    //#region Utils

    /**
     * Checks if a given dice count is valid and allowed.
     * @param {number} count 
     * @returns {boolean}
     */
    static #isValidDiceCount(count) {
        const maxDice = getSetting("maxDicePerPlayer");
        if(count < 0) return false;
        return maxDice === -1 
            ? true                  //no limit
            : count <= maxDice
    }

    /**
     * Can the current user grant new dice.
     * @returns {boolean}
     */
    static canUserGrant() {
        return game.user.role >= getSetting("minRoleToGrant");

    }

    static canAdd(userId) {
        const currentCount = SharedDice.getDiceCount(userId);
        return SharedDice.#isValidDiceCount(currentCount + 1)
    }

    //#endregion




    static async _setDiceCount(userId, count) {
        const user = game.users.get(userId);
        const canEdit = user.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
        if(canEdit) return user.setFlag(MODULE_ID, "userDiceCount", count);

    }

    static getDiceSize() {
        
    }


}

function log(msg, type="error", context={}) {
    const fullMsg = `Module ${MODULE_ID} | ${msg}`;
    console[type](fullMsg, context);
}
