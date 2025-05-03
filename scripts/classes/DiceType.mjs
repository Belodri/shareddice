import { MODULE_ID } from "../CONSTS.mjs";
import { getSetting, setSetting } from "../settings.mjs";

/**
 * Data model of a DiceType. 
 * @typedef {object} DiceTypeData
 * @property {string} id                        The unique identifier for this die type configuration. Cannot be changed after creation.
 * @property {boolean} enabled                  Determines if this dice type is currently active.
 * @property {string} name                      The user-facing name for this die type (e.g., "Inspiration", "Hero Point"). Used in UI elements and chat messages via [$shareDieName].
 * @property {string} img                       The file path to the img representing this die type.
 * @property {number} maxPerUser                The maximum number of dice of this type a single user can possess. (0 for unlimited)
 * @property {string} msgOnAdd                  Chat message template used when a die is given to a player. Omits message if blank.
 * @property {string} msgOnRemove               Chat message template used when a die is removed from a player. Omits message if blank.
 * @property {string} msgOnUse                  Chat message template used when a player consumes/uses a die. Omits message if blank.
 * @property {string} msgOnGift                 Chat message template used when a player gives a die to another player. Omits message if blank.
 *
 */


/**
 * Data model of a DiceType. 
 * 
 * @property {DiceTypeData}
 */
export default class DiceType extends foundry.abstract.DataModel {

    //id = "";

    enabled = true;

    name = "d20";

    img = "icons/svg/d20-grey.svg";

    maxPerUser = 0;

    msgOnAdd = "[$sourceUser] gave [$targetUser] a [$shareDieName].";

    msgOnRemove = "[$sourceUser] removed a [$shareDieName] from [$targetUser].";

    msgOnUse = "[$sourceUser] has used a [$shareDieName]";

    msgOnGift = "[$sourceUser] has gifted a [$shareDieName] to [$targetUser]";

    /**
     * Get the max amount a user can have of this die.
     * If no limit, returns `Infinity`
     * @returns {number} 
     */
    get limit() {
        return this.maxPerUser === 0 ? Infinity : this.maxPerUser;
    }

    //#region Data Model

    static LOCALIZATION_PREFIXES = [MODULE_ID.toUpperCase()];

    static defineSchema() {
        const {
            StringField, NumberField, BooleanField, DocumentIdField, FilePathField
        } = foundry.data.fields;

        return {
            id: new DocumentIdField({ initial: () => foundry.utils.randomID() }),
            enabled: new BooleanField({ 
                initial: true, 
                label: "SHAREDDICE.Fields.enabled.Label",
                hint: "SHAREDDICE.Fields.enabled.Hint"
            }),
            name: new StringField({
                initial: () => game.i18n.localize("SHAREDDICE.Fields.name.Initial"),
                required: true,
                blank: false,
                label: "SHAREDDICE.Fields.name.Label",
                hint: "SHAREDDICE.Fields.name.Hint"
            }),
            img: new FilePathField({
                initial: "icons/svg/d20-grey.svg",
                categories: ["IMAGE"],
                label: "SHAREDDICE.Fields.img.Label",
                hint: "SHAREDDICE.Fields.img.Hint"
            }),
            maxPerUser: new NumberField({
                min: 0,
                integer: true,
                nullable: false,
                required: true,
                initial: 0,
                label: "SHAREDDICE.Fields.maxPerUser.Label",
                hint: "SHAREDDICE.Fields.maxPerUser.Hint",
            }),
            msgOnAdd: new StringField({
                initial: () => game.i18n.localize("SHAREDDICE.Fields.msgOnAdd.Placeholder"),
                required: true,
                label: "SHAREDDICE.Fields.msgOnAdd.Label",
                hint: "SHAREDDICE.Fields.msgOnAdd.Hint"
            }),
            msgOnRemove: new StringField({
                initial: () => game.i18n.localize("SHAREDDICE.Fields.msgOnRemove.Placeholder"),
                required: true,
                label: "SHAREDDICE.Fields.msgOnRemove.Label",
                hint: "SHAREDDICE.Fields.msgOnRemove.Hint"
            }),
            msgOnUse: new StringField({
                initial: () => game.i18n.localize("SHAREDDICE.Fields.msgOnUse.Placeholder"),
                required: true,
                label: "SHAREDDICE.Fields.msgOnUse.Label",
                hint: "SHAREDDICE.Fields.msgOnUse.Hint"
            }),
            msgOnGift: new StringField({
                initial: () => game.i18n.localize("SHAREDDICE.Fields.msgOnGift.Placeholder"),
                required: true,
                label: "SHAREDDICE.Fields.msgOnGift.Label",
                hint: "SHAREDDICE.Fields.msgOnGift.Hint"
            })
        }
    }

    //#endregion

    //#region CRUD

    /**
     * Create a new DiceType and save it to settings.
     * @returns {Promise<DiceType>}
     */
    static async create() { 
        const newType = new DiceType();
        const allTypesData = DiceType.getDataAll();
        allTypesData[newType.id] = newType.toJSON();
        await setSetting("diceTypes", allTypesData);
        return newType;
    }

    /**
     * Retrieve a specific DiceType from the settings by its unique ID.
     * @param {string} diceId               The unique identifier for the desired dice type.
     * @param {boolean} [data=false]        If true, the data object of the DiceType is returned instead of the instance. 
     * @returns {DiceType|DiceTypeData}     The DiceType instance or it's data object.
     * @throws {Error} If the dice diceId was not found in the settings.
     */
    static getFromId(diceId, data=false) {
        const diceTypes = getSetting("diceTypes");
        const typeData = diceTypes[diceId];
        if(!typeData) throw new Error(`Invalid diceId: "${diceId}"`);

        return data ? typeData : new DiceType(typeData);
    }

    /**
     * Get the data object for all configured dice types from settings.
     * Always returns at least an empty object.
     * @returns {{[id: string]: DiceTypeData}}
     */
    static getDataAll() {
        return getSetting("diceTypes");
    }

    static async _setDataAll(data) {
        return setSetting("diceTypes", data);
    }

    /**
     * Gets the property of a die directly from the settings.
     * Avoids having to initialize the DataModel.
     * @param {string} diceId 
     * @param {string} key 
     * @returns {any}
     */
    static getProp(diceId, key) {
        const data = DiceType.getDataAll();
        return foundry.utils.getProperty(data, `${diceId}.${key}`);
    }

    /**
     * Checks if a diceId exists in the settings.
     * @param {string} diceId 
     * @returns {boolean}
     */
    static exists(diceId) {
        const data = DiceType.getDataAll();
        return !!data[diceId];
    }

    /**
     * Update this DiceType and save to settings.
     * @param {object} changes        The update object.
     * @param {object} [options]      The update options.
     * @returns {Promise<DiceType>}
     */
    async update(changes, options={}) {
        changes = foundry.utils.expandObject(changes);
        this.updateSource(changes, options);

        const allTypesData = DiceType.getDataAll();
        allTypesData[this.id] = this.toJSON();
        await setSetting("diceTypes", allTypesData);
        return this;
    }

    /**
     * Delete this DiceType.
     * @returns {Promise<DiceType}
     */
    async delete() {
        const allTypesData = DiceType.getDataAll();
        delete allTypesData[this.id];
        await setSetting("diceTypes", allTypesData);
        return this;
    }

    //#endregion
}


