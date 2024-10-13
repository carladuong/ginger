import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError } from "./errors";

export interface MessageDoc extends BaseDoc {
  to: ObjectId;
  from: ObjectId;
  content: string;
}

export interface ChatDoc extends BaseDoc {
  chatter1: ObjectId;
  chatter2: ObjectId;
}

/**
 * concept: Messaging [Entity]
 */
export default class MessagingConcept {
  public readonly messages: DocCollection<MessageDoc>;
  public readonly chats: DocCollection<ChatDoc>;

  /**
   * Make an instance of Messaging.
   */
  constructor(collectionName: string) {
    this.messages = new DocCollection<MessageDoc>(collectionName);
    this.chats = new DocCollection<ChatDoc>(collectionName + "_chats");
  }

  async startChat(chatter1: ObjectId, chatter2: ObjectId) {
    const existing = await this.chats.readOne({
      $or: [
        { chatter1: chatter1, chatter2: chatter2 },
        { chatter1: chatter2, chatter2: chatter1 },
      ],
    });
    if (existing) {
      throw new NotAllowedError("Chat already exists!");
    }
    this.chats.createOne({ chatter1, chatter2 });
    return { msg: "Chat started!" };
  }

  async getChats(chatter: ObjectId) {
    return await this.chats.readMany({
      $or: [{ chatter1: chatter }, { chatter2: chatter }],
    });
  }

  async sendMessage(to: ObjectId, from: ObjectId, content: string) {
    const chat = this.chats.readOne({
      $or: [
        { chatter1: to, chatter2: from },
        { chatter1: from, chatter2: to },
      ],
    });
    if (!chat) {
      throw new NotAllowedError("No chat exists between these two users.");
    }
    const _id = await this.messages.createOne({ to, from, content });
    return { msg: "Message sent!", message: await this.messages.readOne({ _id }) };
  }

  async getChatMessages(chatter1: ObjectId, chatter2: ObjectId) {
    return await this.messages.readMany({
      $or: [
        { to: chatter1, from: chatter2 },
        { to: chatter2, from: chatter1 },
      ],
    });
  }
}
