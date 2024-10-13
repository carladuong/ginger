import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError, NotFoundError } from "./errors";

export interface LabelDoc extends BaseDoc {
  labelName: string;
  itemIds: ObjectId[];
}

/**
 * concept: Labeling [Item]
 */
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
      if (labelObject.itemIds.some((id) => id.equals(itemId))) {
        throw new NotAllowedError("Label already added to item!");
      }
      await this.labels.partialUpdateOne({ _id: labelObject._id }, { itemIds: labelObject.itemIds.concat(itemId) });
      return { msg: "Label added to item!" };
    }
    throw new NotFoundError("Label does not exist!");
  }

  async removeLabel(itemId: ObjectId, labelName: string) {
    const labelObject = await this.labels.readOne({ labelName });
    if (!labelObject) {
      throw new NotFoundError("Label does not exist!");
    }
    const newLabeledItems = labelObject.itemIds.filter((element) => !element.equals(itemId));
    await this.labels.partialUpdateOne({ _id: labelObject._id }, { itemIds: newLabeledItems });
    return { msg: "Label removed from item!" };
  }

  async findItemsByLabel(labelName: string) {
    const labelObject = await this.labels.readOne({ labelName });
    if (labelObject) {
      return labelObject.itemIds;
    }
    throw new NotFoundError("Label does not exist!");
  }

  async checkIfItemLabeled(itemId: ObjectId, labelName: string) {
    const labels = await this.getItemLabels(itemId);
    if (labels.includes(labelName)) {
      return true;
    }
    return false;
  }

  async findItemsByLabels(labelNames: string[]) {
    if (labelNames.length === 0) {
      throw new NotAllowedError("Please provide at least one label.");
    }
    const candidates = await this.findItemsByLabel(labelNames[0]);
    if (labelNames.length === 1) {
      return candidates;
    }
    const result = [];
    for (const candidate of candidates) {
      const candidateLabels = await this.getItemLabels(candidate);
      let addCandidate = true;
      for (const name of labelNames) {
        if (!candidateLabels.includes(name)) {
          addCandidate = false;
          break;
        }
      }
      if (addCandidate) {
        result.push(candidate);
      }
    }
    return result;
  }

  async getItemLabels(itemId: ObjectId) {
    const labels = [];
    const labelObjects = await this.labels.readMany({});
    for (const labelDoc of labelObjects) {
      if (labelDoc.itemIds.some((id) => id.equals(itemId))) {
        labels.push(labelDoc.labelName);
      }
    }
    return labels;
  }
}
