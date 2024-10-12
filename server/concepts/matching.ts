import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError } from "./errors";

export interface MatchDoc extends BaseDoc {
  entity1: ObjectId;
  entity2: ObjectId;
}

/**
 * concept: Matching [Entity]
 */
export default class MatchingConcept {
  public readonly matches: DocCollection<MatchDoc>;
  public readonly matchable: ObjectId[];

  /**
   * Make an instance of Matching.
   */
  constructor(collectionName: string) {
    this.matches = new DocCollection<MatchDoc>(collectionName);
    this.matchable = [];
  }

  async optIn(entity: ObjectId) {
    if (this.matchable.includes(entity)) {
      throw new EntityAlreadyOptedInError(entity);
    } else {
      this.matchable.push(entity);
      return { msg: "Successfully opted in to matching!" };
    }
  }

  async optOut(entity: ObjectId) {
    const index = this.matchable.indexOf(entity);
    if (index > -1) {
      this.matchable.splice(index, 1);
      return { msg: "Successfully opted out of matching!" };
    } else {
      throw new EntityNotOptedInError(entity);
    }
  }

  async createMatch(entity1: ObjectId, entity2: ObjectId) {
    const _id = await this.matches.createOne({ entity1, entity2 });
    return { msg: "Match successfully created!", match: await this.matches.readOne({ _id }) };
  }

  async checkIfMatchable(entity: ObjectId) {
    return this.matchable.includes(entity);
  }

  async checkIfMatched(entity1: ObjectId, entity2: ObjectId) {
    const match = await this.matches.readOne({
      $or: [
        { entity1: entity1, entity2: entity2 },
        { entity1: entity2, entity2: entity1 },
      ],
    });
    if (!match) {
      return false;
    }
    return true;
  }
}

export class EntityAlreadyOptedInError extends NotAllowedError {
  constructor(public readonly entity: ObjectId) {
    super("{0} is already opted in to matching!", entity);
  }
}

export class EntityNotOptedInError extends NotAllowedError {
  constructor(public readonly entity: ObjectId) {
    super("{0} hasn't opted in to matching!", entity);
  }
}
