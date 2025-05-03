/** 
 * @import Players from "@client/applications/ui/players.mjs"; 
 * @import { User } from "@client/documents/_module.mjs";
 */

import { MODULE_ID } from "../CONSTS.mjs";
import DiceType from "./DiceType.mjs";
import { getAllQuants, hasEditRole } from "./UserHandler.mjs";

export default class UIHandler {

    static #instance;

    /** @returns {UIHandler} */
    static get instance() {
        if (!UIHandler.#instance) UIHandler.#instance = new UIHandler();
        return UIHandler.#instance;
    }

    static onRenderPlayers(...args) { return UIHandler.instance.onRenderPlayers(...args) }

    static rerender() { ui.players.render(); }

    constructor() {
        if (UIHandler.#instance) throw new Error("An instance of UIHandler already exists. Use UIHandler.instance instead.");
    }

    #selfIsEditor = false;

    #tooltips = {
        edit: "",
        use: "",
        gift: "",
        more: ""
    };

    /** @type {{[id: string]: import("./DiceType.mjs").DiceTypeData}} */
    #allTypes;

    get #api() { return game.modules.get(MODULE_ID).api; } 

    /**
     * Hook: 'renderPlayers'
     * 
     * @param {Players} playersApp 
     * @param {HTMLElement} html 
     * @param {object} data 
     */
    onRenderPlayers(playersApp, html, data) {
        this.#selfIsEditor = hasEditRole(game.user);
        for(const k in this.#tooltips) this.#tooltips[k] = game.i18n.localize(`SHAREDDICE.UI.Tooltips.${k}`);
        this.#allTypes = DiceType.getDataAll();

        html.querySelectorAll('li[data-user-id]')
            .forEach(li => this.#handleUserLi(li));
    }

    /** @param {HTMLElement} li */
    #handleUserLi(li) {
        const user = game.users.get(li.dataset.userId);
        const ele = this.#makeContainer(user);
        if(!ele) return;

        li.appendChild(ele);
    }

    /**
     * 
     * @param {User} user 
     * @returns {"edit"|"use"|"gift"|null}
     */
    #getActionForUser(user) {
        if(hasEditRole(user)) return null;  // Editor users should not have anything displayed

        return this.#selfIsEditor 
            ? "edit"
            : user.isSelf 
                ? "use"
                : "gift";
    }

    /**
     * 
     * @param {User} user 
     * @returns {HTMLDivElement}
     */
    #makeContainer(user) {
        const action = this.#getActionForUser(user);
        if(!action) return null;

        const allQuants = getAllQuants(user) ?? {};
        const contDiv = document.createElement("div");
        contDiv.className = `${MODULE_ID}.container`;

        const makeDiceContDiv = (clickAction, diceId="") => {
            const diceContDiv = document.createElement("div");
            diceContDiv.className = "die-container";
            diceContDiv.dataset.diceId = diceId;
            diceContDiv.dataset.tooltipText = this.#tooltips[clickAction];
            diceContDiv.dataset.clickAction = clickAction;
            diceContDiv.dataset.userId = user.id;

            diceContDiv.addEventListener("click", this.#clickEventListener.bind(this));
            if(action === "edit") diceContDiv.addEventListener("contextmenu", this.#contextEventListener.bind(this), { capture: true });
            return diceContDiv;
        }

        let unlistedEnabledDiceCount = 0;
        for(const [diceId, typeData] of Object.entries(this.#allTypes)) {
            if(!typeData.enabled) continue;

            const quant = allQuants[diceId];
            if(typeof quant !== "number") {
                unlistedEnabledDiceCount++;
                continue;
            }

            const imgEle = document.createElement("img");
            imgEle.src = typeData.img;
            const spanEle = document.createElement("span");
            spanEle.textContent = quant;

            const diceContDiv = makeDiceContDiv(action, diceId);
            diceContDiv.appendChild(imgEle);
            diceContDiv.appendChild(spanEle);
            contDiv.appendChild(diceContDiv);
        }
        
        if(this.#selfIsEditor && unlistedEnabledDiceCount) {
            const diceContDiv = makeDiceContDiv("more");

            const addI = document.createElement("i");
            addI.className = "fa-solid fa-square-plus";
            diceContDiv.appendChild(addI);

            contDiv.appendChild(diceContDiv);
        }
        return contDiv;
    }

    //#region Event Handling
    
    /**
     * 
     * @param {MouseEvent} event 
     */
    #clickEventListener(event) {
        const {clickAction, diceId, userId} = event.currentTarget.dataset;
        if(!clickAction) return;
        event.preventDefault();
        event.stopPropagation();
        
        switch(clickAction) {
            case "more": return this.#onMore(userId, event.clientX, event.clientY);
            case "edit": return this.#onEdit(diceId, userId);
            case "use": return  this.#onUse(diceId);
            case "gift": return this.#onGift(diceId, userId);
        }
    }

    /**
     * 
     * @param {MouseEvent} event 
     */
    #contextEventListener(event) {
        const {clickAction, diceId, userId} = event.currentTarget.dataset;
        if(clickAction !== "edit") return;
        event.preventDefault();
        event.stopPropagation();

        this.#onEdit(diceId, userId, true);
    }

    #onMore = foundry.utils.debounce((targetUserId, x, y) => {
        this.#selectAndAddDialog(targetUserId, x, y);
    }, 100);
    

    #onEdit = foundry.utils.debounce((diceId, targetUserId, isRemove=false) => {
        if(isRemove) this.#api.remove(targetUserId, diceId);
        else this.#api.add(targetUserId, diceId);
    }, 100);


    #onUse = foundry.utils.debounce((diceId) => {
        this.#api.use(diceId);
    }, 100);

    #onGift = foundry.utils.debounce((diceId, targetUserId) => {
        this.#api.gift(targetUserId, diceId);
    }, 100);

    //#endregion

    /**
     * 
     * @param {string} targetUserId 
     * @param {number} [x=null] 
     * @param {number} [y=null] 
     * @returns {Promise<void>}
     */
    async #selectAndAddDialog(targetUserId, x=null, y=null) {
        const pos = {};
        if(x !== null && y !== null) {
            pos.left = x;
            pos.top = y;
        }
    
        const userQuants = getAllQuants(targetUserId) ?? {};
        const selectField = foundry.applications.fields.createSelectInput({
            type: "single",
            name: "id",
            sort: true,
            valueAttr: "id",
            labelAttr: "name",
            options: Object.values(this.#allTypes)
                .filter(data => data.enabled && !(data.id in userQuants)),
        });
            
        const formGroup = foundry.applications.fields.createFormGroup({
            input: selectField,
            label: "SHAREDDICE.Dialogs.SelectMore.Label",
            hint: "SHAREDDICE.Dialogs.SelectMore.Hint",
            localize: true,
        }).outerHTML;
    
        const chosenId = await foundry.applications.api.DialogV2.prompt({
            content: formGroup,
            window: { title: game.i18n.localize("SHAREDDICE.Dialogs.SelectMore.Title") },
            position: pos,
            ok: {
                label: "SHAREDDICE.Dialogs.SelectMore.Add",
                callback: (_event, button) => new foundry.applications.ux.FormDataExtended(button.form).object.id
            },
            rejectClose: false,
            modal: true,
        });
        if(chosenId) this.#api.add(targetUserId, chosenId);
    }
}

