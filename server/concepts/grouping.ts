import { ObjectId } from "mongodb";

import DocCollection, { BaseDoc } from "../framework/doc";

export interface GroupDoc extends BaseDoc {
  groupName: string;
  members: ObjectId[];
}

export default class GroupingConcept {
  public readonly groups: DocCollection<GroupDoc>;

  constructor(collectionName: string) {
    this.groups = new DocCollection<GroupDoc>(collectionName);
  }

  async createGroup(groupName: string) {
    const _id = await this.groups.createOne({ groupName: groupName, members: [] });
    return { msg: "Group successfully created!", label: await this.groups.readOne({ _id }) };
  }

  async getGroups() {
    return await this.groups.readMany({});
  }

  async joinGroup(user: ObjectId, groupName: string) {
    const groupObject = await this.groups.readOne({ groupName });
    groupObject?.members.push(user);
    return { msg: "Joined group!" };
  }

  async leaveGroup(user: ObjectId, groupName: string) {
    const groupObject = await this.groups.readOne({ groupName });
    const newMemberList = groupObject?.members.filter((element) => element !== user);
    this.groups.partialUpdateOne({ groupName }, { members: newMemberList });
    return { msg: "Left group!" };
  }

  async getMembers(groupName: string) {
    return await this.groups.readMany({ groupName });
  }

  async getGroupsForUser(user: ObjectId) {
    const groupList = [];
    const groupObjects = await this.groups.readMany({});
    for (const groupDoc of groupObjects) {
      if (groupDoc.members.includes(user)) {
        groupList.push(groupDoc.groupName);
      }
    }
    return groupList;
  }
}
