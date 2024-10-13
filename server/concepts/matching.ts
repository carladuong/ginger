import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";
import { NotAllowedError } from "./errors";

export interface MatchDoc extends BaseDoc {
  entity1: ObjectId;
  entity2: ObjectId;
}

export interface OptDoc extends BaseDoc {
  entity: ObjectId;
}

/**
 * concept: Matching [Entity]
 */
export default class MatchingConcept {
  public readonly matches: DocCollection<MatchDoc>;
  public readonly matchable: DocCollection<OptDoc>;

  /**
   * Make an instance of Matching.
   */
  constructor(collectionName: string) {
    this.matches = new DocCollection<MatchDoc>(collectionName);
    this.matchable = new DocCollection<OptDoc>(collectionName + "_optedin");
  }

  async optIn(entity: ObjectId) {
    const existing = await this.matchable.readOne({ entity });
    if (existing) {
      throw new EntityAlreadyOptedInError(entity);
    } else {
      this.matchable.createOne({ entity });
      return { msg: "Successfully opted in to matching!" };
    }
  }

  async optOut(entity: ObjectId) {
    const existing = await this.matchable.readOne({ entity });
    if (!existing) {
      throw new EntityNotOptedInError(entity);
    } else {
      this.matchable.deleteOne({ entity: entity });
      return { msg: "Successfully opted out of matching!" };
    }
  }

  async createMatch(entity1: ObjectId, entity2: ObjectId) {
    const _id = await this.matches.createOne({ entity1, entity2 });
    return { msg: "Match successfully created!", match: await this.matches.readOne({ _id }) };
  }

  async checkIfMatchable(entity: ObjectId) {
    const existing = await this.matchable.readOne({ entity });
    if (existing) {
      return true;
    }
    return false;
  }

  async checkIfMatched(entity1: ObjectId, entity2: ObjectId) {
    if (entity1.equals(entity2)) {
      return true;
    }
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
