/** 
 * @import Players from "@client/applications/ui/players.mjs"; 
 * @import { User } from "@client/documents/_module.mjs";
 */

import { MODULE_ID } from "../CONSTS.mjs";
import { getSetting } from "../settings.mjs";
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
        
        this.#allTypes = getSetting("diceTypes");

        html.querySelectorAll('li[data-user-id]')
            .forEach(li => this.#handleUserLi(li));
    }

    /** @param {HTMLElement} li */
    #handleUserLi(li) {
        const user = game.users.get(li.dataset.userId);

        const containerData = this.#getContainerData(user);
        if(!containerData) return;

        const ele = this.#createContainer(containerData)
        li.appendChild(ele);
    }

    /**
     * 
     * @param {User} eleUser 
     * @returns {"edit"|"use"|"gift"|null}
     */
    #getActionForUser(eleUser) {
        if(hasEditRole(eleUser)) return null;  // Editor users should not have anything displayed

        return this.#selfIsEditor 
            ? "edit"
            : eleUser.isSelf 
                ? "use"
                : "gift";
    }


    /**
     * @typedef {object} ContainerData
     * @property {string} eleUserId
     * @property {"edit"|"use"|"gift"} action
     * @property {{typeData: DiceTypeData, quant: number}[]} diceData
     * @property {boolean} createMoreButton
     */

    /**
     * 
     * @param {User} eleUser 
     * @returns {ContainerData | undefined}
     */
    #getContainerData(eleUser) {
        const action = this.#getActionForUser(eleUser);
        if(!action) return;

        const diceData = [];

        // Show own dice on other users if the action is 'gift'
        const workingQuants = getAllQuants(action === "gift" ? game.user : eleUser) ?? {};

        let createMoreButton = false;
        for(const [diceId, typeData] of Object.entries(this.#allTypes)) {
            if(!typeData.enabled) continue;
            const quant = workingQuants[diceId];
            const isVisible = quant > 0 || !typeData.hideIfZero;
            if(isVisible) diceData.push({ typeData, quant });
            else if(this.#selfIsEditor) createMoreButton = true;
        }

        return {
            eleUserId: eleUser.id,
            action,
            diceData,
            createMoreButton
        }
    }


    /**
     * 
     * @param {ContainerData} data 
     * @returns {HTMLDivElement}
     */
    #createContainer(data) {
        const contDiv = document.createElement("div");
        contDiv.className = `${MODULE_ID}.container`;

        for(const {typeData, quant} of data.diceData) {
            const diceContDiv = this.#makeDiceContainerDiv(data.action, data.eleUserId, typeData.id)

            const imgEle = document.createElement("img");
            imgEle.src = typeData.img;
            diceContDiv.appendChild(imgEle);

            const spanEle = document.createElement("span");
            spanEle.textContent = quant;
            diceContDiv.appendChild(spanEle);

            contDiv.appendChild(diceContDiv);
        }

        if(this.#selfIsEditor && data.createMoreButton) {
            const diceContDiv = this.#makeDiceContainerDiv("more", data.eleUserId);

            const addI = document.createElement("i");
            addI.className = "fa-solid fa-square-plus";
            diceContDiv.appendChild(addI);

            contDiv.appendChild(diceContDiv);
        }

        return contDiv;
    }

    /**
     * 
     * @param {"edit"|"use"|"gift"} action 
     * @param {string} eleUserId 
     * @param {string} diceId 
     * @returns {HTMLDivElement}
     */
    #makeDiceContainerDiv(action, eleUserId, diceId="" ) {
        const diceContDiv = document.createElement("div");
        diceContDiv.className = "die-container";
        diceContDiv.dataset.diceId = diceId;
        diceContDiv.dataset.tooltipText = this.#tooltips[action];
        diceContDiv.dataset.clickAction = action;
        diceContDiv.dataset.userId = eleUserId;

        diceContDiv.addEventListener("click", this.#clickEventListener.bind(this));
        if(action === "edit") diceContDiv.addEventListener("contextmenu", this.#contextEventListener.bind(this), { capture: true });
        return diceContDiv;
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
        try {
            this.#selectAndAddDialog(targetUserId, x, y);
        } catch(err) { console.error(err); }   
    }, 100);
    

    #onEdit = foundry.utils.debounce((diceId, targetUserId, isRemove=false) => {
        try {
            if(isRemove) this.#api.remove(targetUserId, diceId);
            else this.#api.add(targetUserId, diceId);
        } catch(err) { console.error(err); }
    }, 100);


    #onUse = foundry.utils.debounce((diceId) => {
        try {
            this.#api.use(diceId);
        } catch(err) { console.error(err); }
    }, 100);

    #onGift = foundry.utils.debounce((diceId, targetUserId) => {
        try {
            this.#api.gift(targetUserId, diceId);
        } catch(err) { console.error(err); }
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
        const selectOptions = Object.values(this.#allTypes)
            .filter(data => data.enabled && !userQuants[data.id])
    
        const selectField = foundry.applications.fields.createSelectInput({
            type: "single",
            name: "id",
            sort: true,
            valueAttr: "id",
            labelAttr: "name",
            options: selectOptions,
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

