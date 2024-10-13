import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface LabelDoc extends BaseDoc {
  labelName: string;
  itemIds: ObjectId[];
}

export default class LabelingConcept {
  public readonly labels: DocCollection<LabelDoc>;

  constructor(collectionName: string) {
    this.labels = new DocCollection<LabelDoc>(collectionName);
  }

  async createLabel(labelName: string) {
    const existing = await this.labels.readOne({ labelName });
    if (existing) {
      throw new NotAllowedError("Label already exists!");
    }
    const _id = await this.labels.createOne({ labelName: labelName, itemIds: [] });
    return { msg: "Label successfully created!", label: await this.labels.readOne({ _id }) };
  }

  async affixLabel(itemId: ObjectId, labelName: string) {
    const labelObject = await this.labels.readOne({ labelName: labelName });
    if (labelObject) {
      if (labelObject.itemIds.includes(itemId)) {
        throw new NotAllowedError("Label already added to item!");
      }
      labelObject.itemIds.push(itemId);
      console.log(labelObject);
      return { msg: "Label added to item!" };
    }
    throw new NotFoundError("Label does not exist!");
  }

  async removeLabel(itemId: ObjectId, labelName: string) {
    const labelObject = await this.labels.readOne({ labelName });
    if (!labelObject) {
      throw new NotFoundError("Label does not exist!");
    }
    const newLabeledItems = labelObject.itemIds.filter((element) => element !== itemId);
    this.labels.partialUpdateOne({ itemId }, { itemIds: newLabeledItems });
    return { msg: "Label removed from item!" };
  }

  async findItemsByLabel(labelName: string) {
    const labelObject = await this.labels.readOne({ labelName });
    if (labelObject) {
      return labelObject.itemIds;
    }
    throw new NotFoundError("Label does not exist!");
  }

  async getItemLabels(itemId: ObjectId) {
    const labels = [];
    const labelObjects = await this.labels.readMany({});
    for (const labelDoc of labelObjects) {
      if (labelDoc.itemIds.includes(itemId)) {
        labels.push(labelDoc.labelName);
      }
    }
    return labels;
  }
}
