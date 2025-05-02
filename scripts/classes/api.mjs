import { MODULE_ID, USER_FLAG } from "./../CONSTS.mjs";
import { notify } from "../utils.mjs";
import DiceType from "./DiceType.mjs";
import { getSetting } from "../settings.mjs";
/** @import User from "@client/documents/user.mjs" */

/**
 * An object representing the collection of dice held by a user.
 * Keys are strings representing dice IDs, and values are numbers indicating the quantity of each die.
 * @typedef {{[diceId: string]: number}} UserDice
 */

/**
 * Manages the handling of dice quantities on a given user.
 */
class DiceUser {
    #user;

    #dice = new foundry.utils.Collection()

    constructor(user) {
        this.#user = user;
    }

    get flag() { return this.#user.getFlag(MODULE_ID, USER_FLAG) ?? {}; }

    get canAddRemove() { return this.#user.role >= getSetting("minRoleToEdit"); }

    get canGiftUse() { return !this.canAddRemove; }


    /**
     * Gets the quantity of a given die on this user.
     * Returns 0 if no dice of the given id exists on the user.
     * @param {string} diceId 
     * @returns {number}
     */
    getQuant(diceId) {
        return this.flag[diceId] ?? 0;
    }

    /**
     * Sets the quantity of a given die on this user.
     * Clamps the value between 0 and maxAllowed.
     * @param {string} diceId 
     * @param {number} quant 
     * @returns {Promise<number>}
     */
    async #setQuant(diceId, quant) {
        const diceType = DiceType.getFromId(diceId);
        if(!diceType) throw new Error(`Invalid diceId: "${diceId}"`);

        const newQuant = Math.clamp(quant, 0, diceType.maxAllowed);
        await this.user.setFlag(MODULE_ID, USER_FLAG, newQuant);
        return newQuant;
    }

    async add(diceId) {
        const diceType = DiceType.getFromId(diceId);
        const quant = this.getQuant(diceId);

        if(quant > diceType.maxPerUser) notify("MaxReached", "warn", { dieName: diceType.name })
    }

    /**
     * Checks if a given die 
     * @param {string} diceId 
     * @returns {boolean}
     */
    canAdd(diceId) {
        const diceType = DiceType.getFromId(diceId);
        return ( this.getQuant(diceId) + 1 ) <= diceType.maxPerUser 
    }

}


class UIHandler {

    static #instance;

    /** @returns {UIHandler} */
    static get instance() {
        if(!UIHandler.#instance) UIHandler.#instance = new UIHandler();
        return UIHandler.#instance;
    }

    /** @type {User} */
    #user;

    /** @type {{[userId: string]: UserDisplayData}} */
    #displayData;

    constructor() {
        if(UIHandler.#instance) throw new Error("An instance of UIHandler already exists. Use UIHandler.instance instead.");
        this.#user = game.user;
    }

    render() {
        //TODO
        //Creates the element if it doesn't exist or rerenders it if it does.
    }

    //#region DISPLAY DATA

    /**
     * @typedef {object} DieDisplayData     The display data for a single die element
     * @typedef {number} quantity           - from the user
     * @typedef {string} img                - from the settings
     * @typedef {string} id                 The id of the die type.
     * @typedef {boolean} isHidden          Is this element hidden from the user?
     * @typedef {}
     */

    /**
     * @typedef {object} UserDisplayData
     * @property {boolean} collapsed        Is the display for that user collapsed?
     * @property {DieDisplayData[]}         
     */

    /**
     * Gets the display data which determines what to display for each player in the list.
     * @returns {{[userId: string]: UserDisplayData}} 
     */
    #getDisplayData() {
        const displayData = {};
        for(const user of game.users) {
            displayData[user.id] = this.#getUserDisplayData(user);
        }
        return displayData;
    }

    /**
     * 
     * @param {User} user 
     */
    #getUserDisplayData(user) {
        //TODO
        // Gets the display data of a single user (including self).
    }

    //#endregion
}


export default class API {
    //#region Public

    /**
     * Determinesif the user can edit (add/remove) other users' dice.
     * @param {string} userId 
     * @returns {boolean}
     */
    static canUserEdit(userId) {
        const user = game.users.get(userId);
        return user.role >= getSetting("minRoleToEdit");
    }

    /**
     * Retrieve a specific DiceType from the settings by its unique ID.
     * @param {string} id   The id of the die type.
     * @returns {DiceType}  A DiceType instance if found, otherwise undefined.
     */
    static getDiceType(id) { return DiceType.getFromId(id); }

    static getUserDice(userId) { return API.#getUserFlag(userId); }

    static getUserDieQuant(userId, diceId) {
        const user = game.users.get(userId);
        return user?.getFlag()
    }

    //#endregion

    //#region Private

    /**
     * Get the module's flagdata from a given user document.
     * @param {string} userId 
     * @returns {UserDice}
     */
    static #getUserFlag(userId) {
        const user = game.users.get(userId);
        return user?.getFlag(MODULE_ID, USER_FLAG);
    }

    /**
     * Set the module's flagdata on a given user document.
     * @param {string} userId 
     * @param {UserDice} flagData 
     */
    static async #setUserFlag(userId, flagData) {
        const user = game.users.get(userId);
        return user?.setFlag(MODULE_ID, USER_FLAG, flagData);
    }

    //#endregion


    /**
     * Retrieves dice data associated with a specific user from their flags.
     * Can return either all dice data for the user or data for a specific die type.
     * Handles invalid user IDs and invalid dice ID (if provided).
     *
     * @param {string} userId - The ID of the user whose dice data is to be retrieved.
     * @param {string | null} [diceId=null] - Optional die ID to get the amount for. If null, returns all amounts for the user.
     * @returns {{[diceId: string]: number} | number | null} - All dice amount for the user, the count for a specific die, or `null` on error or if not found.
     */
    static #getUserDice(userId, diceId=null) {
        const user = game.users.get(userId);
        if(!user) return warn("INVALID_USER_ID", { userId });
        if(diceId && !validateDiceId(diceId)) return warn("INVALID_DICE_ID", { diceId });

        const userDiceData = user.getFlag("diceData");
        return diceId ? userDiceData[diceId] : userDiceData;
    }

    static async #_setUserFlag(userId, diceId, diceAmount) {
        if(!validateDiceId(diceId)) return warn("INVALID_DICE_ID", { diceId });

        const userDiceData = API.#getUserDice(userId);  //handles user validation
        if(!userDiceData) return;

        const user = game.users.get(userId);
        if(!validateDiceAmount(diceAmount)) return warn("INVALID_DICE_AMOUNT")
    }

}
