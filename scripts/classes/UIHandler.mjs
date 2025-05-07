/** 
 * @import Players from "@client/applications/ui/players.mjs"; 
 * @import { User } from "@client/documents/_module.mjs";
 */

import { MODULE_ID } from "../CONSTS.mjs";
import { getSetting } from "../settings.mjs";
import { getAllQuants, hasEditRole } from "./UserHandler.mjs";

export default class UIHandler {

    static CONFIG = {
        icons: {
            "overflowHidden": "fa-solid fa-caret-down fa-rotate-270",
            "overflowShown": "fa-solid fa-caret-down fa-rotate-90",
        },
        maxDiceDisplay: 3,
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

    #selfIsEditor = false;

    /** @type {Record<string, import("./DiceType.mjs").DiceTypeData>} */
    #allTypes;

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
        this.#selfIsEditor = hasEditRole(game.user);
        
        this.#allTypes = getSetting("diceTypes");

        html.querySelectorAll('li[data-user-id]')
            .forEach(li => this.#handleUserLi(li));
        
        this.#initResizeObserver();
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
     * @property {{typeData: DiceTypeData, quant: number}[]} diceData
     */

    /**
     * 
     * @param {User} user 
     * @returns {ContainerData}
     */
    #getContainerData(user) {
        const action = this.#getActionForUser(user);
        if(!action) return;

        const userQuants = getAllQuants(user) ?? {};

        const diceData = Object.values(this.#allTypes)
            .filter(typeData => typeData.enabled)
            .map(typeData => ({
                typeData,
                quant: userQuants[typeData.id] ?? 0
            }));

        return { action, diceData };
    }

    /**
     * 
     * @param {User} user 
     * @param {ContainerData} containerData
     * @returns {{main: HTMLDivElement, overflow: HTMLDivElement|undefined}}
     */
    #createUserContainers(user, {action, diceData}) {
        const containers = {
            main: this.#makeUserContainer(user.id, "main")
        };

        let index = 0;
        let isOverflow = false;
        for(const {typeData, quant } of diceData) {
            if(index >= UIHandler.CONFIG.maxDiceDisplay) {
                isOverflow = true;
                if(!containers.overflow) containers.overflow = this.#makeUserContainer(user.id, "overflow");
            }
            index++;

            const workingCont = isOverflow ? containers.overflow : containers.main;
            const options = {
                diceId: typeData.id, 
                img: typeData.img, 
                spanText: `${quant}`,
                tooltipKey: action,
                tooltipArgs: { 
                    dieName: typeData.name,
                    targetUser: user.name,
                },
                contextListener: action === "edit"
            }
            const diceContDiv = this.#makeDieContainer(user.id, action, options);
            workingCont.appendChild(diceContDiv);
        }
        
        if(containers.overflow) {
            const isHidden = !this.#expandedOverflows.has(user.id);
            if(isHidden) containers.overflow.hidden=true;

            const iconClassName = UIHandler.CONFIG.icons[isHidden ? "overflowHidden" : "overflowShown"];
            const overflowToggleEle = this.#makeDieContainer(user.id, "toggleOverflow", { 
                iconClassName, 
                tooltipKey: isHidden ? "expand" : "collapse",
                contextListener: true
            });
            containers.main.appendChild(overflowToggleEle);
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
     * @param {boolean} [options.contextListener=false]
     * @returns {HTMLDivElement}
     */
    #makeDieContainer(userId, clickAction, {diceId, img, spanText, iconClassName, tooltipKey, tooltipArgs, contextListener=false}={}) {
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
        if(contextListener) diceContDiv.addEventListener("contextmenu", this.#contextEventListener.bind(this), { capture: true });

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
     * Get the action the current user is allowed to perform on eleUser's dice.
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
        if(!clickAction) return;
        event.preventDefault();
        event.stopPropagation();

        switch(clickAction) {
            case "edit": return this.#onEdit(diceId, userId, true);
            case "toggleOverflow": return this.#onToggleOverflow();
        }
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

        const iClassName = UIHandler.CONFIG.icons[setHidden ? "overflowHidden" : "overflowShown"];
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
            ? `.die-container[data-click-action="toggleOverflow"][data-user-id="${userId}"] > i`
            : `.die-container[data-click-action="toggleOverflow"][data-user-id] > i`;
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
     * Updates the left position of all overflow elements so they 
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

