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
     * @typedef {"use" | "gift" | "add" | "remove" | "toggleOverflow" | "toggleOverflowAll"} ClickAction
     */

    /** 
     * @typedef {object} ActionData
     * @property {string} userId
     * @property {string} [diceId]
     * @property {Partial<{
     *  left: ClickAction,
     *  right: ClickAction,
     *  leftCtrl: ClickAction,
     *  rightCtrl: ClickAction
     * }>} clickActions
     */

    /**
     * @typedef {object} DiceData
     * @property {ActionData} actionData
     * @property {number} quant 
     * @property {DiceType} type
     */

    /**
     * 
     * @param {User} user 
     * @returns {DiceData[]}
     */
    #getContainerData(user) {
        const userQuants = getAllQuants(user) ?? {};
        return this.#enabledTypes
            .map(type => {
                const quant = userQuants[type.id] ?? 0;
                const actionData = this.#getActionDataForDie(type, user, quant);
                return { type, actionData, quant }
            })
            .sort((a, b) => b.type.sortPriority - a.type.sortPriority);
    }

    /**
     * Get the action data for the current user for a given eleUser's die.
     * @param {DiceType} diceType 
     * @param {User} eleUser 
     * @returns {ActionData}
     */
    #getActionDataForDie(diceType, eleUser, userQuant=0) {
        const leftClick = eleUser.isSelf && userQuant > 0 ? "use"
            : !eleUser.isSelf && diceType.allowGift && getQuant(game.user, diceType.id) > 0 && userQuant < diceType.limit ? "gift"
                : undefined;

        const editPermission = diceType.editPermissions[this.#selfRole];
        const canEdit = editPermission === DiceType.EDIT_PERMISSIONS.ALL
            || ( editPermission === DiceType.EDIT_PERMISSIONS.SELF && eleUser.isSelf );

        const clickActions = { left: leftClick };
        if(canEdit) {
            clickActions.leftCtrl = "add";
            clickActions.rightCtrl = "remove";
        }

        return {
            userId: eleUser.id, 
            diceId: diceType.id,
            clickActions
        }
    }

    #DATASET_TYPE_CONVERTERS = {
        "string": { to: (value) => value, from: (value) => value },
        "number": { to: (value) => String(value), from: (value) => Number(value) },
        "boolean": { to: (value) => String(value), from: (value) => value === "true" },
        "null": { to: () => "null", from: () => null }
    }

    /**
     * Takes a data object with potentially nested properties and writes it to the dataset property of a HTMLElement.
     * @param {HTMLElement} element 
     * @param {object} data 
     * @returns {void}
     */
    #writeToDataset(element, data) {
        const flat = foundry.utils.flattenObject(data);

        for(const [key, value] of Object.entries(flat)) {
            if(value === undefined) continue;
            const type = value === null ? "null" : typeof value;
            
            const converter = this.#DATASET_TYPE_CONVERTERS[type];
            if(!converter) throw new Error(`Unable to convert data -> dataset. Invalid type '${type}' for value of key '${key}'`);

            // Key with module id and type to prevent potential name collisions and for type safety.
            const dataKey = [MODULE_ID, type, key].join(".");
            element.dataset[dataKey] = converter.to(value);
        }
    }

    /**
     * Takes a HTMLElement and converts its dataset properties assigned by this module back to a type-safe data object.
     * @param {HTMLElement} element
     * @returns {object}
     */
    #readFromDataset(element) {
        const data = {};
        for(const dataKey in element.dataset) {
            const valueString = element.dataset[dataKey];

            const [moduleId, type, ...keySegments] = dataKey.split(".");
            if(moduleId !== MODULE_ID) continue;
            
            const converter = this.#DATASET_TYPE_CONVERTERS[type];
            if(!converter) throw new Error(`Unable to convert dataset -> data. Invalid type '${type}' for value of key '${dataKey}'`);

            const key = keySegments.join(".");
            data[key] = converter.from(valueString);
        }
        
        return foundry.utils.expandObject(data);
    }

    /**
     * 
     * @param {User} user 
     * @param {DiceData[]} containerData
     * @returns {{main: HTMLDivElement, overflow: HTMLDivElement|undefined}}
     */
    #createUserContainers(user, containerData) {
        const containers = { main: this.#makeUserContainer(user.id, "main") };

        const overflowThreshold = getSetting("overflowThreshold") ?? 3;
        
        for(let i = 0; i < containerData.length; i++) {
            const container = i < overflowThreshold ? containers.main 
                : ( containers.overflow ??= this.#makeUserContainer(user.id, "overflow") );

            const {type, quant, actionData} = containerData[i];
            const {left, leftCtrl} = actionData.clickActions;

            const ttKey = [left, leftCtrl && "edit"].filter(Boolean).join("_");
            const tooltipText = ttKey ? game.i18n.format(`SHAREDDICE.UI.Tooltips.${ttKey}`, { dieName: type.name, targetUser: user.name }) : "";

            const dieContainer = this.#makeDieContainer({ img: type.img, spanText: `${quant}`, tooltipText });
            
            this.#writeToDataset(dieContainer, actionData);

            container.appendChild(dieContainer);
        }

        if(containers.overflow) {
            const isHidden = !this.#expandedOverflows.has(user.id);
            if(isHidden) containers.overflow.hidden=true;

            const overflowContainer = this.#makeDieContainer({ 
                iconClassName: UIHandler.OVERFLOW_ICONS[isHidden ? "hidden" : "shown"], 
                tooltipText: game.i18n.localize(`SHAREDDICE.UI.Tooltips.${isHidden ? "expand" : "collapse"}`)
            });

            const actionData = {
                userId: user.id,
                clickActions: { left: "toggleOverflow", right: "toggleOverflowAll" }
            }

            this.#writeToDataset(overflowContainer, actionData);
            overflowContainer.dataset.toggleOverflow = "true";  // Simple flag for toggleAll selector

            containers.main.appendChild(overflowContainer);
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
     * @param {Partial<{
     *  img: string,
     *  spanText: string,
     *  tooltipText: string,
     *  iconClassName: string
     * }>} data 
     * @returns {HTMLDivElement}
     */
    #makeDieContainer({img, spanText, tooltipText, iconClassName }={}) {
        const div = document.createElement("div");
        div.className = "die-container";
        div.dataset.moduleId = MODULE_ID;

        if(tooltipText) div.dataset.tooltip = tooltipText;

        if(img) {
            const imgEle = document.createElement("img");
            imgEle.src = img;
            div.appendChild(imgEle);
        }

        if(spanText) {
            const spanEle = document.createElement("span");
            spanEle.textContent = spanText;
            div.appendChild(spanEle);
        }

        if(iconClassName) {
            const iconEle = document.createElement("i");
            iconEle.className = iconClassName;
            div.appendChild(iconEle);
        }

        return div;
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

        const isCtrl = event.ctrlKey || event.metaKey;
        const isRight = event.type === "contextmenu";
        const isActionDialog = getSetting("enableActionDialogs");

        /** @type {ActionData} */
        const actionData =  this.#readFromDataset(target);
        const { userId, diceId, clickActions } = actionData;
        const { left, right, leftCtrl, rightCtrl } = clickActions;
        // If userId exists after being read from the dataset, we know the data is from this module.
        // Should any other property be undefined when needed, an error will be thrown and caught by the individual action functions.
        if(!userId) return;

        const clickType = isCtrl
            ? isRight ? "rightCtrl" : "leftCtrl"
            : isRight ? "right" : "left";

        const clickAction = clickActions[clickType];

        switch(clickAction) {
            case "toggleOverflow": return this.#onToggleOverflow(userId);
            case "toggleOverflowAll": return this.#onToggleOverflow();
            case "use": return isActionDialog ? this.#onUseDialog(diceId, event) : this.#onUse(diceId);
            case "gift": return isActionDialog ? this.#onGiftDialog(diceId, userId, event) : this.#onGift(diceId, userId);
            case "add": return isActionDialog ? this.#onEditDialog(diceId, userId, event) : this.#onEdit(diceId, userId, false);
            case "remove": return isActionDialog ? this.#onEditDialog(diceId, userId, event) : this.#onEdit(diceId, userId, true);
            default: break;
        }

        // Press ctrl for edit 
        const ctrlAvailble = diceId && !isCtrl && (leftCtrl || rightCtrl);
        if(ctrlAvailble) return foundry.ui.notifications.warn(`SHAREDDICE.Notifications.InvalidClickAction.HoldCtrlForEdit`, {localize: true});

        // Release ctrl for use
        const useAvailable = diceId && left === "use" && isCtrl;
        if(useAvailable) return foundry.ui.notifications.warn(`SHAREDDICE.Notifications.InvalidClickAction.ReleaseCtrlForUse`, {localize: true});

        // Release ctrl for gift
        const giftAvailable = diceId && left === "gift" && isCtrl;
        if(giftAvailable) return foundry.ui.notifications.warn(`SHAREDDICE.Notifications.InvalidClickAction.ReleaseCtrlForGift`, {localize: true});

        // no actions available
        const noActionAvailable = diceId && !left && !right && !leftCtrl && !rightCtrl;
        if(noActionAvailable) return foundry.ui.notifications.warn(`SHAREDDICE.Notifications.InvalidClickAction.NoAvailableAction`, {localize: true});

        // default
        return foundry.ui.notifications.warn(`SHAREDDICE.Notifications.InvalidClickAction.Default`, {localize: true});
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
        const selfQuant_remaining = getQuant(game.user, diceId) ?? 0;
        if(!selfQuant_remaining) return;

        const type = this.#enabledTypes.get(diceId);

        const actionQuant = await this.#showQuantityDialog({
            title: `${type.name}`,
            label: game.i18n.localize("SHAREDDICE.UI.ActionDialogs.useAction"),
            min: 1,
            max: selfQuant_remaining,
            value: 1,
            event
        });

        if(actionQuant > 0) this.#api.use(diceId, { amount: actionQuant});
    }

    async #onGiftDialog(diceId, targetUserId, event) {
        const selfQuant_remaining = getQuant(game.user, diceId) ?? 0;
        if(!selfQuant_remaining) return;
        
        const targetUser = game.users.get(targetUserId);
        const targetQuant_remaining = getQuant(targetUser, diceId) ?? 0;
        const type = this.#enabledTypes.get(diceId);
        const targetQuant_diffToMax = Math.max(0, type.limit - targetQuant_remaining);

        const actionQuant = await this.#showQuantityDialog({
            title: `${type.name} - ${targetUser.name}`,
            label: game.i18n.localize("SHAREDDICE.UI.ActionDialogs.giftAction"),
            min: 1,
            max: Math.min(selfQuant_remaining, targetQuant_diffToMax),
            value: 1,
            event
        });

        if(actionQuant > 0) this.#api.gift(targetUserId, diceId, { amount: actionQuant});
    }

    async #onEditDialog(diceId, targetUserId, event) {
        const targetUser = game.users.get(targetUserId);
        const targetQuant_remaining = getQuant(targetUser, diceId) ?? 0;
        const type = this.#enabledTypes.get(diceId);

        const actionQuant = await this.#showQuantityDialog({
            title: `${type.name} - ${targetUser.name}`,
            label: game.i18n.localize("SHAREDDICE.UI.ActionDialogs.editAction"),
            min: -targetQuant_remaining,
            max: type.limit - targetQuant_remaining,
            value: 0,
            event
        });

        // actionQuant === null falls through
        if(actionQuant > 0) this.#api.add(targetUserId, diceId, { amount: actionQuant});
        if(actionQuant < 0) this.#api.remove(targetUserId, diceId, { amount: Math.abs(actionQuant)});
    }

    /**
     * Generic helper to show a quantity input dialog.
     * @param {object} config
     * @param {string} config.title - The title for the dialog window.
     * @param {string} config.label - The label for the number input field.
     * @param {number} config.min - The minimum allowed value.
     * @param {number} config.max - The maximum allowed value.
     * @param {number} config.value - The default value.
     * @param {PointerEvent} config.event - The originating pointer event.
     * @returns {Promise<number|null>} The quantity entered by the user, or null if cancelled.
     */
    async #showQuantityDialog({ title, label, min, max, value, event }) {
        if (max < min) throw new Error(`UIHandler | Invalid argument: 'max' cannot be smaller than 'min'.`);

        const quantGroup = new NumberField({
            min,
            max,
            integer: true,
            label,
        }).toFormGroup({},{name: "quant", value}).outerHTML;

        const res = await Dialog.input({
            window: { title },
            position: {
                left: event.screenX + 20,
                top: event.screenY
            },
            content: quantGroup,
            rejectClose: false,
            modal: true,
        });

        return res?.quant ?? null;
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
            ? `.die-container[data-toggle-overflow="true"][data-${MODULE_ID}\\.string\\.user-id="${userId}"] > i`
            : `.die-container[data-toggle-overflow="true"] > i`;
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
            : `.shareddice\\.container.overflow`;
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

