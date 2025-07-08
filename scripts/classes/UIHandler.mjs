/** 
 * @import Players from "@client/applications/ui/players.mjs"; 
 * @import { User } from "@client/documents/_module.mjs";
 * @import Collection from "@common/utils/collection.mjs";
 */

import { MODULE_ID } from "../CONSTS.mjs";
import { getAllQuants, getQuant } from "./UserHandler.mjs";
import DiceType from "./DiceType.mjs";
import { getSetting } from "../settings.mjs";
import { log } from "../utils.mjs";

const {Dialog} = foundry.applications.api;
const {NumberField} = foundry.data.fields;

export default class UIHandler {

    static OVERFLOW_ICONS = {
        "hidden": "fa-solid fa-caret-down fa-rotate-270",
        "shown": "fa-solid fa-caret-down fa-rotate-90",
    }

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

    /** @type {Collection<string, DiceType>} */
    #enabledTypes;

    /** @type {"PLAYER" | "TRUSTED" | "ASSISTANT" | "GAMEMASTER"} */
    #selfRole;

    /** @type {Set<[userId: string]>} */
    #expandedOverflows = new Set();

    /** @type {ResizeObserver} */
    #resizeObserver;

    get #api() { return game.modules.get(MODULE_ID).api; } 

    /**
     * Hook: 'renderPlayers'
     * 
     * @param {Players} playersApp 
     * @param {HTMLElement} html 
     * @param {object} data 
     */
    onRenderPlayers(playersApp, html, data) {
        log("debug", "Rendering Players");
        this.#enabledTypes = DiceType.getCollection(type => type.enabled);
        this.#selfRole = CONST.USER_ROLE_NAMES[game.user.role];
        
        html.querySelectorAll('li[data-user-id]')
            .forEach(li => this.#handleUserLi(li));
        
        this.#initResizeObserver();
    }

    /** @param {HTMLElement} li */
    #handleUserLi(li) {
        const user = game.users.get(li.dataset.userId);
        
        const containerData = this.#getContainerData(user);
        log("debug", "Handle User", { user, containerData });
        if(!containerData.length) return;

        const containers = this.#createUserContainers(user, containerData);
        li.appendChild(containers.main);
        if(containers.overflow) li.appendChild(containers.overflow);
    }

    /**
     * @typedef {object} DiceActions
     * @property {boolean} gift
     * @property {boolean} edit
     * @property {boolean} use
     */

    /**
     * @typedef {object} DiceData
     * @property {DiceActions} actions
     * @property {number} quant 
     * @property {DiceType} type
     */

    /** @typedef {DiceData[]} ContainerData */

    /**
     * 
     * @param {User} user 
     * @returns {ContainerData}
     */
    #getContainerData(user) {
        const userQuants = getAllQuants(user) ?? {};
        return this.#enabledTypes
            .map(type => {
                const actions = this.#getActionsForDie(type, user, userQuants[type.id]);

                return {
                    type,
                    actions,
                    clickAction: this.#getClickActionFromActions(actions),
                    quant: userQuants[type.id] ?? 0,
                }
            })
            .sort((a, b) => b.type.sortPriority - a.type.sortPriority)
            
    }

    /**
     * Get the actions the current user is allowed to perform on a given eleUser's die.
     * @param {DiceType} type 
     * @param {User} eleUser 
     * @returns {DiceActions}
     */
    #getActionsForDie(type, eleUser, userQuant=0) {
        const use = eleUser.isSelf && userQuant > 0;
        const gift = !use && type.allowGift && getQuant(game.user, type.id) > 0 && userQuant < type.limit;

        const editPerm = type.editPermissions[this.#selfRole];
        const edit = editPerm === DiceType.EDIT_PERMISSIONS.ALL
            || ( editPerm === DiceType.EDIT_PERMISSIONS.SELF && eleUser.isSelf );

        return { gift, use, edit, toggleOverflow: false }
    }

    #getClickActionFromActions({use, edit, gift}) {
        const valArr = [];
        if(use) valArr.push("use");
        if(gift) valArr.push("gift"); // This will only be pushed if 'use' was false, due to input constraints
        if(edit) valArr.push("edit");
        return valArr.join("_");
    }


    /**
     * 
     * @param {User} user 
     * @param {DiceData[]} containerData
     * @returns {{main: HTMLDivElement, overflow: HTMLDivElement|undefined}}
     */
    #createUserContainers(user, containerData) {
        const containers = {
            main: this.#makeUserContainer(user.id, "main")
        };

        let index = 0;
        let isOverflow = false;
        for(const {type, quant, actions, clickAction} of containerData) {
            if(index >= getSetting("overflowThreshold")) {
                isOverflow = true;
                if(!containers.overflow) containers.overflow = this.#makeUserContainer(user.id, "overflow");
            }
            index++;

            const workingCont = isOverflow ? containers.overflow : containers.main;

            const datasetData = {
                userId: user.id,
                diceId: type.id,
                actions,
            };

            const options = {
                img: type.img, 
                spanText: `${quant}`,
            };
            if(clickAction) {
                options.tooltipKey = clickAction;
                options.tooltipArgs = { 
                    dieName: type.name,
                    targetUser: user.name,
                };
            }

            const diceContDiv = this.#makeDieContainer(datasetData, options);
            workingCont.appendChild(diceContDiv);
        }
        
        if(containers.overflow) {
            const isHidden = !this.#expandedOverflows.has(user.id);
            if(isHidden) containers.overflow.hidden=true;

            const iconClassName = UIHandler.OVERFLOW_ICONS[isHidden ? "hidden" : "shown"];
            const overflowToggleEle = this.#makeDieContainer({
                userId: user.id, 
                actions: { toggleOverflow: true }
            }, { 
                iconClassName, 
                tooltipKey: isHidden ? "expand" : "collapse",
            });
            containers.main.appendChild(overflowToggleEle);
        }

        return containers;
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
        div.dataset.tooltipDirection = "UP";
        div.addEventListener("pointerup", this.#eventListener.bind(this));
        div.addEventListener("contextmenu", this.#eventListener.bind(this), { capture: true });
        return div;
    }
    
    /**
     * 
     * @param {object} datasetData
     * @param {string} datasetData.userId
     * @param {Record<string, boolean>} [datasetData.actions={}]
     * @param {string} [datasetData.diceId]
     * @param {object} [options]
     * @param {string} [options.img]
     * @param {string} [options.spanText]
     * @param {string} [options.iconClassName]
     * @param {string} [options.tooltipKey]
     * @param {object} [options.tooltipArgs]
     * @returns {HTMLDivElement}
     */
    #makeDieContainer({userId, actions={}, diceId}, {img, spanText, iconClassName, tooltipKey, tooltipArgs}={}) {
        const diceContDiv = document.createElement("div");
        diceContDiv.className = "die-container";

        const datasetData = this.#createDatasetData(userId, actions, diceId);
        Object.entries(datasetData).forEach(([k, v]) => diceContDiv.dataset[k] = v);

        if(tooltipKey) {
            diceContDiv.dataset.tooltipText = tooltipArgs
                ? game.i18n.format(`SHAREDDICE.UI.Tooltips.${tooltipKey}`, tooltipArgs)
                : game.i18n.localize(`SHAREDDICE.UI.Tooltips.${tooltipKey}`);
        }
        
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
     * @param {string} userId 
     * @param {Record<string, boolean>} actions 
     * @param {string} diceId 
     * @returns {Record<string, string>}
     */
    #createDatasetData(userId, actions={}, diceId=undefined) {
        const data = {
            userId: userId || "",
            actions: {
                toggleOverflow: actions.toggleOverflow ? "true" : "",
                use: actions.use ? "true" : "", 
                gift: actions.gift ? "true" : "",
                edit: actions.edit ? "true" : "",
            },
            diceId: diceId || "",
            moduleId:MODULE_ID,
        };
        return foundry.utils.flattenObject(data);
    }

    //#region Event Handling
    
    /**
     * 
     * @param {PointerEvent} event 
     */
    #eventListener(event) {
        if(!event.currentTarget.dataset?.userId) return;
        if(!["pointerup", "contextmenu"].includes(event.type)) return;
        if(event.type === "pointerup" && event.button !== 0) return;

        const target = event.target.closest(`div[data-module-id="${MODULE_ID}"]`);
        if(!target) return;

        event.preventDefault();
        event.stopPropagation();

        const {actions, userId, diceId} = foundry.utils.expandObject({...target.dataset});
        const {toggleOverflow, edit, use, gift} = actions;
        const isCtrl = event.ctrlKey || event.metaKey;
        const isRight = event.type === "contextmenu";
        const isActionDialog = getSetting("enableActionDialogs");

        if(toggleOverflow && !isRight) return this.#onToggleOverflow(userId);
        if(toggleOverflow && isRight) return this.#onToggleOverflow();

        // Remove
        if(edit && isCtrl && isRight) return isActionDialog 
            ? this.#onEditDialog(diceId, userId, event) 
            : this.#onEdit(diceId, userId, true);
        // Add
        if(edit && isCtrl && !isRight) return isActionDialog 
            ? this.#onEditDialog(diceId, userId, event) 
            : this.#onEdit(diceId, userId, false);  
        // Use
        if(use && !isCtrl && !isRight) return isActionDialog
            ? this.#onUseDialog(diceId, event)
            : this.#onUse(diceId);
        // Gift
        if(gift && !isCtrl && !isRight) return isActionDialog
            ? this.#onGiftDialog(diceId, userId, event)
            : this.#onGift(diceId, userId);

    }

    #onToggleOverflow = foundry.utils.debounce((userId) => {
        try {
            this.#toggleOverflow(userId);
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


    //#region Action Dialogs

    /**
     * @param {string} diceId 
     * @param {PointerEvent} event 
     */
    async #onUseDialog(diceId, event) {
        const available = getQuant(game.user, diceId);
        if(!available) return;

        const type = this.#enabledTypes.get(diceId);
        const quantGroup = new NumberField({
            min: 1,
            max: available,
            integer: true,
            label: game.i18n.localize("SHAREDDICE.UI.ActionDialogs.useAction"),
        }).toFormGroup({},{name: "quant", value: 1}).outerHTML;

        const res = await this.#inputDialog(quantGroup, `${type.name}`, event);
        if(res?.quant) this.#api.use(diceId, { amount: res.quant});
    }

    async #onGiftDialog(diceId, targetUserId, event) {
        const selfAvailable = getQuant(game.user, diceId);
        if(!selfAvailable) return;
        
        const targetUser = game.users.get(targetUserId);
        const targetQuant = getQuant(targetUser, diceId);
        const type = this.#enabledTypes.get(diceId);
        const targetAvailable = Math.max(0, type.limit - targetQuant);

        const quantGroup = new NumberField({
            min: 1,
            max: Math.min(selfAvailable, targetAvailable),
            integer: true,
            label: game.i18n.localize("SHAREDDICE.UI.ActionDialogs.giftAction"),
        }).toFormGroup({},{name: "quant", value: 1}).outerHTML;

        const res = await this.#inputDialog(quantGroup, `${type.name} - ${targetUser.name}`, event);
        if(res?.quant) this.#api.gift(targetUserId, diceId, { amount: res.quant});
    }

    async #onEditDialog(diceId, targetUserId, event) {
        const targetUser = game.users.get(targetUserId);
        const targetQuant = getQuant(targetUser, diceId);
        const type = this.#enabledTypes.get(diceId);

        const quantGroup = new NumberField({
            min: -targetQuant,
            max: type.limit - targetQuant,
            integer: true,
            label: game.i18n.localize("SHAREDDICE.UI.ActionDialogs.editAction"),
        }).toFormGroup({},{name: "quant", value: 0}).outerHTML;

        const res = await this.#inputDialog(quantGroup, `${type.name} - ${targetUser.name}`, event);
        if(res?.quant > 0) this.#api.add(targetUserId, diceId, { amount: res.quant});
        if(res?.quant < 0) this.#api.remove(targetUserId, diceId, { amount: Math.abs(res.quant)});
    }

    async #inputDialog(content, title, event) {
        return Dialog.input({
            window: { title },
            position: {
                left: event.screenX + 20,
                top: event.screenY
            },
            content,
            rejectClose: false,
            modal: true,
        });
    }

    //#endregion


    /**
     * Toggles the overflow of a given user or toggles the overflow of all users if omitted.
     * @param {string} [userId=null]
     */
    #toggleOverflow(userId=null) {
        const divs = this.#getOverflowDivs(userId);
        const icons = this.#getOverflowIcons(userId);

        const setHidden = userId 
            ? this.#expandedOverflows.has(userId) 
            : ( this.#expandedOverflows.size >= (game.users.size / 2) );  // hide all if more than half are expanded

        const iClassName = UIHandler.OVERFLOW_ICONS[setHidden ? "hidden" : "shown"];
        const tooltipKey = setHidden ? "expand" : "collapse";
        const tooltipText = game.i18n.localize(`SHAREDDICE.UI.Tooltips.${tooltipKey}`);
        
        for(const div of divs) div.toggleAttribute("hidden", setHidden);
        for(const icon of icons) {
            icon.className = iClassName;
            icon.parentElement.dataset.tooltipText = tooltipText;
        }

        if(userId) {
            if(setHidden) this.#expandedOverflows.delete(userId);
            else this.#expandedOverflows.add(userId); 
            return;
        }
        
        if(setHidden) this.#expandedOverflows.clear();
        else this.#expandedOverflows = new Set(game.users.map(u => u.id));
    }

    /**
     * Gets the overflow icons for a single user or all overflow icons if no userId is provided.
     * @param {string} [userId=null] 
     * @returns {NodeList<HTMLElement>}
     */
    #getOverflowIcons(userId=null) {
        const selector = userId 
            ? `.die-container[data-actions\\.toggle-overflow="true"][data-user-id="${userId}"] > i`
            : `.die-container[data-actions\\.toggle-overflow="true"][data-user-id] > i`;
        return ui.players.element.querySelectorAll(selector);
    }

    /**
     * Gets the overflow divs for a single user or all overflow divs if no userId is provided.
     * @param {string} [userId=null] 
     * @returns {NodeList<HTMLDivElement>}
     */
    #getOverflowDivs(userId=null) {
        const selector = userId 
            ? `.shareddice\\.container.overflow[data-user-id="${userId}"]`
            : ".shareddice\\.container.overflow[data-user-id]";
        return ui.players.element.querySelectorAll(selector);
    }

    #initResizeObserver() {
        if(!this.#resizeObserver) {
            this.#resizeObserver = new ResizeObserver(entries => {
                const width = entries[0].target.getBoundingClientRect().right;
                this.#updateOverflowLeft(width);
            });
        }

        const playersDiv = document.getElementById("players-active");
        this.#resizeObserver.disconnect();
        this.#resizeObserver.observe(playersDiv);

        const width = playersDiv.getBoundingClientRect().right;
        this.#updateOverflowLeft(width);
    }

    /**
     * Updates the left position of all overflow elements so they're aligned vertically.
     * @param {number} left    Left position in px
     * @returns {void}
     */
    #updateOverflowLeft(left) {
        const overflowDivs = this.#getOverflowDivs();
        for(const div of overflowDivs) {
            div.style.left = `${left}px`;
        }
    } 
}

