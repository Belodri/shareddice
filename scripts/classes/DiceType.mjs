import { getSetting, setSetting } from "../settings.mjs";
/**
 * @import Collection from "@common/utils/collection.mjs";
 */

/**
 * @typedef {object} MessageTemplates
 * @property {string} add                  Chat message template used when a die is given to a player. Omits message if blank.
 * @property {string} remove               Chat message template used when a die is removed from a player. Omits message if blank.
 * @property {string} use                  Chat message template used when a player consumes/uses a die. Omits message if blank.
 * @property {string} gift                 Chat message template used when a player gives a die to another player. Omits message if blank.
 */

/**
 * @typedef {object} EditPermissions
 * @property {0|1|2} PLAYER
 * @property {0|1|2} TRUSTED
 * @property {0|1|2} ASSISTANT
 * @property {2} GAMEMASTER                     Read-only
 */

/**
 * Raw data of a DiceType. 
 * @typedef {object} DiceTypeData
 * @property {string} id                        The unique identifier for this die type configuration. Cannot be changed after creation.
 * @property {boolean} enabled                  Determines if this dice type is currently active.
 * @property {EditPermissions} editPermissions  Determines which roles (as in CONST.USER_ROLES) can add/remove this dice.
 * @property {string} name                      The user-facing name for this die type (e.g., "Inspiration", "Hero Point"). Used in UI elements and chat messages via [$shareDieName].
 * @property {string} img                       The file path to the img representing this die type.
 * @property {number} maxPerUser                The maximum number of dice of this type a single user can possess. (0 for unlimited)
 * @property {boolean} allowGift                Can players gift their own uses of this die to others?
 * @property {number} sortPriority              Determines the order in which dice are displayed next to the user names. Higher priority means closer to the user name.
 * @property {MessageTemplates} messages
 */

/**
 * Data model of a DiceType. 
 */
export default class DiceType extends foundry.abstract.DataModel {
    static EDIT_PERMISSIONS = {
        NONE: 0,
        SELF: 1,
        ALL: 2,
    }

    //#region Data Model

    /** @override */
    static defineSchema() {
        const {
            StringField, NumberField, BooleanField, DocumentIdField, FilePathField, SchemaField, SetField
        } = foundry.data.fields;

        const editChoices = {
            [DiceType.EDIT_PERMISSIONS.NONE]: "SHAREDDICE.Fields.editPermissions.choices.none",
            [DiceType.EDIT_PERMISSIONS.SELF]: "SHAREDDICE.Fields.editPermissions.choices.self",
            [DiceType.EDIT_PERMISSIONS.ALL]: "SHAREDDICE.Fields.editPermissions.choices.all"
        };

        return {
            id: new DocumentIdField({ initial: () => foundry.utils.randomID() }),
            enabled: new BooleanField({ 
                initial: true, 
                label: "SHAREDDICE.Fields.enabled.Label",
                hint: "SHAREDDICE.Fields.enabled.Hint"
            }),
            editPermissions: new SchemaField({
                PLAYER: new NumberField({
                    label: "USER.RolePlayer",
                    choices: editChoices,
                    initial: DiceType.EDIT_PERMISSIONS.NONE,
                    nullable: false,
                }),
                TRUSTED: new NumberField({
                    label: "USER.RoleTrusted",
                    choices: editChoices,
                    initial: DiceType.EDIT_PERMISSIONS.NONE,
                    nullable: false,
                }),
                ASSISTANT: new NumberField({
                    label: "USER.RoleAssistant",
                    choices: editChoices,
                    initial: DiceType.EDIT_PERMISSIONS.NONE,
                    nullable: false,
                }),
                GAMEMASTER: new NumberField({
                    initial: DiceType.EDIT_PERMISSIONS.ALL,
                    readonly: true,
                    nullable: false,
                    required: true,
                })
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
            sortPriority: new NumberField({
                nullable: false,
                initial: 0,
                required: true,
                label: "SHAREDDICE.Fields.sortPriority.Label",
                hint: "SHAREDDICE.Fields.sortPriority.Hint",
            }),
            allowGift: new BooleanField({
                label: "SHAREDDICE.Fields.allowGift.Label",
                hint: "SHAREDDICE.Fields.allowGift.Hint",
                initial: true,
            }),
            messages: new SchemaField({
                add: new StringField({
                    initial: () => game.i18n.localize("SHAREDDICE.Fields.msgOnAdd.Placeholder"),
                    required: true,
                    label: "SHAREDDICE.Fields.msgOnAdd.Label",
                    hint: "SHAREDDICE.Fields.msgOnAdd.Hint"
                }),
                remove: new StringField({
                    initial: () => game.i18n.localize("SHAREDDICE.Fields.msgOnRemove.Placeholder"),
                    required: true,
                    label: "SHAREDDICE.Fields.msgOnRemove.Label",
                    hint: "SHAREDDICE.Fields.msgOnRemove.Hint"
                }),
                use: new StringField({
                    initial: () => game.i18n.localize("SHAREDDICE.Fields.msgOnUse.Placeholder"),
                    required: true,
                    label: "SHAREDDICE.Fields.msgOnUse.Label",
                    hint: "SHAREDDICE.Fields.msgOnUse.Hint"
                }),
                gift: new StringField({
                    initial: () => game.i18n.localize("SHAREDDICE.Fields.msgOnGift.Placeholder"),
                    required: true,
                    label: "SHAREDDICE.Fields.msgOnGift.Label",
                    hint: "SHAREDDICE.Fields.msgOnGift.Hint"
                })
            })
        }
    }

    //#endregion

    /**
     * Create a new DiceType and save it to settings.
     * @returns {Promise<DiceType>}
     */
    static async create() { 
        const newType = new DiceType();
        const allTypesData = getSetting("diceTypes");
        allTypesData[newType.id] = newType.toJSON();
        await setSetting("diceTypes", allTypesData);
        return newType;
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

        const allTypesData = getSetting("diceTypes");
        allTypesData[this.id] = this.toJSON();
        await setSetting("diceTypes", allTypesData);
        return this;
    }

    /**
     * Delete this DiceType.
     * @returns {Promise<DiceType>}
     */
    async delete() {
        const allTypesData = getSetting("diceTypes");
        delete allTypesData[this.id];
        await setSetting("diceTypes", allTypesData);
        return this;
    }

    /**
     * Retrieve a specific DiceType from the settings by its unique ID.
     * @param {string} diceId               The unique identifier for the desired dice type.
     * @param {boolean} [data=false]        If true, the data object of the DiceType is returned instead of the instance. 
     * @returns {DiceType|DiceTypeData}     The DiceType instance or it's data object.
     * @throws {Error} If the diceId was not found in the settings.
     */
    static getFromId(diceId, data=false) {
        const diceTypes = getSetting("diceTypes");
        const typeData = diceTypes[diceId];
        if(!typeData) throw new Error(`Invalid diceId: "${diceId}"`);

        return data ? typeData : new DiceType(typeData);
    }

    /**
     * Gets a collection of known dice types, optionally filtered.
     * @param {function(DiceType): *} [filterFunc]      Optional predicate function to filter dice types. 
     *                                                  Called for each DiceType instance. Return a truthy value to 
     *                                                  include the type in the collection, falsey to exclude it.
     * @returns {Collection<string, DiceType>}      A collection of DiceType instances, keyed by their ID.
     */
    static getCollection(filterFunc) {
        const typesCollection = new foundry.utils.Collection();
        const setting = getSetting("diceTypes")
        for(const data of Object.values(setting)) {
            const type = new DiceType(data);
            if(typeof filterFunc === "function" && !filterFunc(type)) continue;
            typesCollection.set(type.id, type);  
        }
        return typesCollection;
    }

    /**
     * Get the max amount a user can have of this die.
     * If no limit, returns `Infinity`
     * @returns {number} 
     */
    get limit() {
        return this.maxPerUser === 0 ? Infinity : this.maxPerUser;
    }
}
