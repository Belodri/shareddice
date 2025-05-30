import DiceType from "../classes/DiceType.mjs";
import { MODULE_ID } from "../CONSTS.mjs";
import { getSetting, setSetting } from "../settings.mjs";
import { log } from "../utils.mjs";

/** 
 * @import FormDataExtended from "@client/applications/ux/form-data-extended.mjs" 
 * @import { DiceTypeData } from "../classes/DiceType.mjs"
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class DiceTypesSettingMenu extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @type {Record<[diceId: string], DiceTypeData>} */
    #diceData = {};

    #selectedId = "";

    /** Use to validate submit data. */
    #testDie = new DiceType();

    constructor(...args) {
        super(...args);
        this.#diceData = foundry.utils.deepClone(getSetting("diceTypes"));
    }

    /** @inheritdoc */
    static DEFAULT_OPTIONS = {
        id: `${MODULE_ID}.DiceTypesConfigMenu`,
        tag: "form",
        window: {
            title: "SHAREDDICE.Settings.DiceTypeConfigTitle",
            contentClasses: ["standard-form"]
        },
        position: {
            width: 800,
        },
        form: {
            closeOnSubmit: false,
            submitOnChange: true,
            handler: DiceTypesSettingMenu.#onSubmit
        },
        actions: {
            save: DiceTypesSettingMenu.#onSave,
            createDiceType: DiceTypesSettingMenu.#onCreateDiceType,
            deleteDiceType: DiceTypesSettingMenu.#onDeleteDiceType
        }
    }

    /** @inheritdoc */
    static PARTS = {
        form: { template: `modules/${MODULE_ID}/templates/DiceTypesSettingMenu.hbs`, scrollable: [""] },
        footer: { template: "templates/generic/form-footer.hbs" }   
    }

    /** @inheritdoc */
    async _prepareContext() {
        const selectDiceOptions = [
            { id: "", name: game.i18n.localize("SHAREDDICE.Settings.EmptySelectLabel")},
            ...Object.values(this.#diceData)
        ];

        return {
            selectDiceOptions,
            die: this.#diceData[this.#selectedId] ?? {},
            fields: DiceType.schema.fields,
            buttons: [
                { type: "save", icon: "fa-solid fa-save", label: "SETTINGS.Save", action: "save" },
            ]
        };
    }

    //#region Actions

    /**
     * @this {DiceTypesSettingMenu}
     * @param {SubmitEvent} event           The originating form submission event
     * @param {HTMLFormElement} form        The form element that was submitted
     * @param {FormDataExtended} formData   Processed data for the submitted form
     * @returns {Promise<void>}
     */
    static async #onSubmit(event, form, formData) {
        if(this.#selectedId) {
            const submitData = foundry.utils.expandObject(formData.object);
            this.#testDie.validate({changes: submitData, clean: true});
            foundry.utils.mergeObject(this.#diceData[this.#selectedId], submitData);
        }
        
        const selectedId = form.querySelector(".dice-type-select")
            .selectedOptions[0].value;
        this.#selectedId = selectedId;

        this.render();
    }

    /**
     * Creates a new Dice Type in memory without saving it to settings.
     * 
     * @this {DiceTypesSettingMenu}
     * @param {PointerEvent} event          The originating click event
     * @param {HTMLElement} target          The capturing HTML element which defined a [data-action]
     * @returns {Promise<void>}
     */
    static async #onCreateDiceType(event, target) {
        const newType = new DiceType();
        this.#diceData[newType.id] = newType.toObject();
        this.#selectedId = newType.id;
        this.render();
    }

    /**
     * Deletes an existing Dice Type in memory without saving the change to settings. 
     * 
     * @this {DiceTypesSettingMenu}
     * @param {PointerEvent} event          The originating click event
     * @param {HTMLElement} target          The capturing HTML element which defined a [data-action]
     * @returns {Promise<void>}
     */
    static async #onDeleteDiceType(event, target) {
        if(!this.#selectedId) return;
        delete this.#diceData[this.#selectedId]
        this.#selectedId = "";
        this.render();
    }

    /**
     * Saves the current configuration to settings. Asks for confirmation if deletions were made.
     * @this {DiceTypesSettingMenu}
     * @returns {Promise<void>}
     */
    static async #onSave() {
        log("debug", "DiceTypeSetting onSave", { diceDataNew: this.#diceData });
        const settingData = getSetting("diceTypes");

        const deleted = [];
        for(const id in settingData) if(!this.#diceData[id]) deleted.push(settingData[id]);
        if(deleted.length && !await this.#confirmDelete(deleted)) return;

        await setSetting("diceTypes", this.#diceData);
        this.close();
    }

    /**
     * Dialog to confirm deletion of one or more Dice Types.
     * @param {import("../classes/DiceType.mjs").DiceTypeData[]} deleted    The data of the dice types about to be deleted.
     * @returns {Promise<boolean>}      A Promise which resolves to true if the user decides to delete
     */
    async #confirmDelete(deleted) {
        const delList = `<ul>${deleted.reduce((acc, curr) => acc += `<li>${curr.name}</li>`, "")}</ul>`;
        const content = `<div><p>${game.i18n.localize("AreYouSure")} ${game.i18n.localize("SHAREDDICE.Settings.DeleteDialog.Warning")}</p>${delList}</div>`;
        return foundry.applications.api.DialogV2.confirm({
            window: {
                title: game.i18n.localize("SHAREDDICE.Settings.DeleteDialog.Title"),
                icon: "fa-solid fa-dice-d20"
            },
            position: { width: 400 },
            content,
            rejectClose: false,
            modal: true,
        });
    }

    //#endregion
}
