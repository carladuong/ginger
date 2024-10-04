import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";

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
    const _id = await this.labels.createOne({ labelName: labelName, itemIds: [] });
    return { msg: "Label successfully created!", label: await this.labels.readOne({ _id }) };
  }

  async affixLabel(itemId: ObjectId, labelName: string) {
    const labelObject = await this.labels.readOne({ labelName });
    const newLabeledItems = labelObject?.itemIds.push(itemId);
    return { msg: "Label added to item!" };
  }

  async removeLabel(itemId: ObjectId, labelName: string) {
    const labelObject = await this.labels.readOne({ labelName });
    const newLabeledItems = labelObject?.itemIds.filter((element) => element !== itemId);
    this.labels.partialUpdateOne({ itemId }, { itemIds: newLabeledItems });
    return { msg: "Label removed from item!" };
  }

  async findItemsByLabel(labelName: string) {
    return await this.labels.readMany({ labelName });
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
