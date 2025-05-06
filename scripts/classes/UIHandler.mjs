/** 
 * @import Players from "@client/applications/ui/players.mjs"; 
 * @import { User } from "@client/documents/_module.mjs";
 */

import { MODULE_ID } from "../CONSTS.mjs";
import { getSetting } from "../settings.mjs";
import { getAllQuants, hasEditRole } from "./UserHandler.mjs";

export default class UIHandler {

    static maxDiceDisplay = 3;

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

    /** @type {import("./DiceType.mjs").DiceTypeData} */
    #allTypes;

    /** @type {Set<[userId: string]>} */
    #expandedOverflows = new Set();

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
        
        this.#allTypes = getSetting("diceTypes");

        html.querySelectorAll('li[data-user-id]')
            .forEach(li => this.#handleUserLi(li));
    }

    /** @param {HTMLElement} li */
    #handleUserLi(li) {
        const user = game.users.get(li.dataset.userId);
        
        const containerData = this.#getContainerData(user);
        if(!containerData) return;

        const containers = this.#createUserContainers(user, containerData);
        li.appendChild(containers.main);
        if(containers.overflow) li.appendChild(containers.overflow);
    }

    /**
     * @param {string} userId 
     * @param  {"main"|"overflow"} type
     * @returns {HTMLDivElement}
     */
    #makeUserContainer(userId, type) {
        const div = document.createElement("div");
        div.classList.add(`${MODULE_ID}.container`, type);
        div.dataset.userId = userId;
        return div;
    }

    /**
     * @typedef {object} ContainerData
     * @property {"edit"|"use"|"gift"} action
     * @property {{typeData: DiceTypeData, quant: number, isOverflow: boolean}[]} diceData
     * @property {boolean} showEditorButton
     */

    /**
     * 
     * @param {User} user 
     * @returns {ContainerData}
     */
    #getContainerData(user) {
        const action = this.#getActionForUser(user);
        if(!action) return;

        // Show own dice on other users if the action is 'gift'
        const workingQuants = getAllQuants(action === "gift" ? game.user : user) ?? {};

        const data = {
            action,
            showEditorButton: false,
            diceData: [],
        }
        
        let index = 0;
        for(const typeData of Object.values(this.#allTypes)) {
            if(!typeData.enabled) continue;

            const quant = workingQuants[typeData.id] ?? 0;
            const isViewable = quant > 0 || !typeData.hideIfZero;
            if(!isViewable && this.#selfIsEditor) {
                data.showEditorButton = true;
                continue;
            }

            const isOverflow = index >= UIHandler.maxDiceDisplay;
            index++;
            data.diceData.push({ typeData, quant, isOverflow })
        }

        return data;
    }

    static ICONS = {
        "overflowHidden": "fa-solid fa-caret-down fa-rotate-270",
        "overflowShown": "fa-solid fa-caret-down fa-rotate-90",
        "openEditor": "fa-solid fa-square-plus"
    };

    /**
     * 
     * @param {User} user 
     * @param {ContainerData} containerData
     * @returns {{main: HTMLDivElement, overflow: HTMLDivElement|undefined}}
     */
    #createUserContainers(user, {action, showEditorButton, diceData}) {
        const containers = {
            main: this.#makeUserContainer(user.id, "main")
        };
        
        for(const {typeData, quant, isOverflow } of diceData) {
            if(isOverflow && !containers.overflow) {
                containers.overflow = this.#makeUserContainer(user.id, "overflow");
            }

            const workingCont = isOverflow ? containers.overflow : containers.main;
            const options = {
                diceId: typeData.id, 
                img: typeData.img, 
                spanText: `${quant}`,
                tooltipKey: action,
                tooltipArgs: { 
                    dieName: typeData.name,
                    targetUser: user.name,
                }
            }
            const diceContDiv = this.#makeDieContainer(user.id, action, options);
            workingCont.appendChild(diceContDiv);
        }
        
        if(containers.overflow) {
            const isHidden = !this.#expandedOverflows.has(user.id);
            if(isHidden) containers.overflow.hidden=true;

            const iconClassName = UIHandler.ICONS[isHidden ? "overflowHidden" : "overflowShown"];
            const overflowToggleEle = this.#makeDieContainer(user.id, "toggleOverflow", { 
                iconClassName, 
                tooltipKey: isHidden ? "expand" : "collapse"
            });
            containers.main.appendChild(overflowToggleEle);
        }

        if(showEditorButton) {
            const iconClassName = UIHandler.ICONS.openEditor;
            const editorEle = this.#makeDieContainer(user.id, "openEditor", { iconClassName, tooltipKey: "openEditor" });
            if(containers.overflow) containers.overflow.appendChild(editorEle);
            else containers.main.appendChild(editorEle);
        }

        return containers;
    }

    
    /**
     * 
     * @param {string} userId 
     * @param {string} clickAction 
     * @param {object} [options]
     * @param {string} [options.diceId]
     * @param {string} [options.img]
     * @param {string} [options.spanText]
     * @param {string} [options.iconClassName]
     * @param {string} [options.tooltipKey]
     * @param {object} [options.tooltipArgs]
     * @returns {HTMLDivElement}
     */
    #makeDieContainer(userId, clickAction, {diceId, img, spanText, iconClassName, tooltipKey, tooltipArgs}={}) {
        const diceContDiv = document.createElement("div");
        diceContDiv.className = "die-container";
        diceContDiv.dataset.clickAction = clickAction;
        diceContDiv.dataset.userId = userId;

        if(tooltipKey) {
            diceContDiv.dataset.tooltipText = tooltipArgs
                ? game.i18n.format(`SHAREDDICE.UI.Tooltips.${tooltipKey}`, tooltipArgs)
                : game.i18n.localize(`SHAREDDICE.UI.Tooltips.${tooltipKey}`)
        }
        
        diceContDiv.addEventListener("click", this.#clickEventListener.bind(this));
        if(clickAction === "edit") diceContDiv.addEventListener("contextmenu", this.#contextEventListener.bind(this), { capture: true });

        if(diceId) diceContDiv.dataset.diceId = diceId;

        if(img) {
            const imgEle = document.createElement("img");
            imgEle.src = img;
            diceContDiv.appendChild(imgEle);
        }

        if(spanText) {
            const spanEle = document.createElement("span");
            spanEle.textContent = spanText;
            diceContDiv.appendChild(spanEle);
        }

        if(iconClassName) {
            const iconEle = document.createElement("i");
            iconEle.className = iconClassName;
            diceContDiv.appendChild(iconEle);
        }

        return diceContDiv;
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
            case "openEditor": return this.#onOpenEditor(userId, event.clientX, event.clientY);
            case "edit": return this.#onEdit(diceId, userId);
            case "use": return  this.#onUse(diceId);
            case "gift": return this.#onGift(diceId, userId);
            case "toggleOverflow": return this.#onToggleOverflow(userId);
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

    #onToggleOverflow = foundry.utils.debounce((userId) => {
        try {
            this.#toggleOverflow(userId);
        } catch(err) { console.error(err); }
    }, 100);

    #onOpenEditor = foundry.utils.debounce((targetUserId, x, y) => {
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
     * @param {string} userId 
     */
    #toggleOverflow(userId) {
        const divSelector = `.shareddice\\.container.overflow[data-user-id="${userId}"]`;
        const div = ui.players.element.querySelector(divSelector);
        const isHidden = div.toggleAttribute("hidden");

        const iconSelector = `.die-container[data-click-action="toggleOverflow"][data-user-id="${userId}"] > i`;
        const icon = ui.players.element.querySelector(iconSelector);
        icon.className = UIHandler.ICONS[isHidden ? "overflowHidden" : "overflowShown"];

        const tooltipKey = isHidden ? "expand" : "collapse";
        icon.parentElement.dataset.tooltipText = game.i18n.localize(`SHAREDDICE.UI.Tooltips.${tooltipKey}`);

        if(isHidden) this.#expandedOverflows.delete(userId);
        else this.#expandedOverflows.add(userId);
    }

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
            .filter(data => data.enabled 
                && (typeof userQuants[data.id] === "undefined" ||  (!userQuants[data.id] && data.hideIfZero))
            );
    
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
            localize: true,
        }).outerHTML;
    
        const chosenId = await foundry.applications.api.DialogV2.prompt({
            content: formGroup,
            window: { title: game.i18n.localize("SHAREDDICE.Dialogs.SelectMore.Title") },
            position: pos,
            ok: {
                label: "SHAREDDICE.Dialogs.SelectMore.AddButton",
                callback: (_event, button) => new foundry.applications.ux.FormDataExtended(button.form).object.id
            },
            rejectClose: false,
            modal: true,
        });
        if(chosenId) this.#api.add(targetUserId, chosenId);
    }
}

