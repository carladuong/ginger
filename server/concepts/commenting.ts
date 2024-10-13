import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";

export interface CommentDoc extends BaseDoc {
  parent: ObjectId;
  author: ObjectId;
  content: string;
}

/**
 * concept: Commenting [Author, Item]
 */
export default class CommentingConcept {
  public readonly comments: DocCollection<CommentDoc>;

  /**
   * Make an instance of Commenting.
   */
  constructor(collectionName: string) {
    this.comments = new DocCollection<CommentDoc>(collectionName);
  }

  async addComment(parent: ObjectId, author: ObjectId, content: string) {
    const _id = await this.comments.createOne({ parent, author, content });
    return { msg: "Comment successfully added!", comment: await this.comments.readOne({ _id }) };
  }

  async deleteComment(_id: ObjectId) {
    await this.comments.deleteOne({ _id });
    return { msg: "Comment deleted successfully!" };
  }

  async getItemComments(parent: ObjectId) {
    return await this.comments.readMany({ parent });
  }
}
