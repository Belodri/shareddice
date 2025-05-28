import DiceType from "./DiceType.mjs";
import { MODULE_ID } from "../CONSTS.mjs";
/** 
 * @import User from "@client/documents/user.mjs"
 * @import ChatMessage from "@client/documents/chat-message.mjs";
 * @import Hooks from "@client/helpers/hooks.mjs";
 */

/**
 * Singleton class to handle the creation of Chat Messages. 
 */
export default class MessageHandler {
    /** @type {MessageHandler} */
    static #instance;

    static get instance() { 
        if(!MessageHandler.#instance) MessageHandler.#instance = new MessageHandler();
        return MessageHandler.#instance;
    }

    static async send(...args) { return MessageHandler.instance.send(...args); }

    constructor() {
        if(MessageHandler.#instance) throw new Error(`An instance of MessageHandler already exists. Use MessageHandler.instance instead.`);
    }

    /**
     * 
     * @param {"add"|"remove"|"use"|gift} action
     * @param {DiceType} diceType
     * @param {object} [config]
     * @param {User} [config.targetUser]
     * @param {number} [config.amount]
     * @param {object} [config.messageData]
     * @returns {Promise<ChatMessage|true|null>}    Promise that resolves to the created chat message, true if the message template for the action was left blank, and null if the creation of the message has been cancelled via a hook.
     */
    async send(action, diceType, {targetUser, amount, messageData = {}}={}) {
        const template = this.#getMessageTemplate(action, diceType);
        if(template === "") return true; // Skip message creation if the typeMsg is falsey.
        else if(!template || typeof template !== "string") throw new Error(`Invalid actionType "${action}".`);

        const templateData = this.#getTemplateData({diceType, targetUser, amount});
        const content = this.#formatTemplate(template, templateData);

        const msgData = foundry.utils.mergeObject({
            content,
        }, messageData);

        const diceId = diceType.id;
        /**
         * A hook event that fires before a chat message is created.
         * @function shareddice.preCreateChatMessage
         * @memberof hookEvents
         * @param {string} action                                                   The action for which the chat message is about to be created.
         * @param {string} diceId                                                   The id of the dice type of the used in the action.
         * @param {User} [targetUser=undefined]                                     The target user of the action, if the action has a target. 
         * @param {import("@common/documents/_types.mjs").ChatMessageData} msgData  The message data used to create the message. Can be mutated.
         * @returns {boolean}                                                       Return `false` to prevent the chat message from being created.
         */
        if(Hooks.call(`${MODULE_ID}.preCreateChatMessage`, action, diceId, targetUser, msgData) === false) return null;
        
        const message = await ChatMessage.create(msgData);

        /**
         * A hook event that fires after a chat message is created.
         * @function shareddice.createChatMessage
         * @memberof hookEvents
         * @param {string} action                                                   The action for which the chat message has been created.
         * @param {string} diceId                                                   The id of the dice type of the used in the action.
         * @param {User} [targetUser=undefined]                                     The target user of the action, if the action had a target. 
         * @param {ChatMessage} message                                             The created chat message.
         */
        Hooks.callAll(`${MODULE_ID}.createChatMessage`, action, diceId, targetUser, message );

        return message;
    }

    #templateRegex = /\[\$(.+?)\]/g;

    /**
     * 
     * @param {string} msgTemplate
     * @param {{[key: string]:string|undefined}} templateData
     * @returns {string}
     */
    #formatTemplate(msgTemplate, templateData) {
        return msgTemplate.replaceAll(this.#templateRegex, (match, grp) => {
            const trimmed = grp.trim();
            const repVal = templateData[trimmed];
            return repVal ? `${repVal}` : match;
        });
    }

    /**
     * 
     * @param {object} data 
     * @returns {{[key: string]:string|undefined}}
     */
    #getTemplateData(data) {
        return {
            dieName: data.diceType?.name,
            sourceUser: game.user.name,
            targetUser: data.targetUser?.name,
            amount: data.amount
        }
    }

    /**
     * Gets the message template for a given action.
     * @param {string} action 
     * @param {DiceType} diceType 
     * @returns {string|undefined}  Can return an empty string! Returns undefined if no template of a given action exists.
     */
    #getMessageTemplate(action, diceType) {
        return diceType.messages[action];
    }
}
