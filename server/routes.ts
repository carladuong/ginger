import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Commenting, Friending, LabelingLabels, LabelingPosts, LabelingUsers, Matching, Messaging, Posting, Replying, Sessioning } from "./app";
import { PostOptions } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";
import { NotAllowedError } from "./concepts/errors";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await Authing.getUsers();
  }

  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Authing.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string) {
    Sessioning.isLoggedOut(session);
    return await Authing.create(username, password);
  }

  @Router.patch("/users/username")
  async updateUsername(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    return await Authing.updateUsername(user, username);
  }

  @Router.patch("/users/password")
  async updatePassword(session: SessionDoc, currentPassword: string, newPassword: string) {
    const user = Sessioning.getUser(session);
    return Authing.updatePassword(user, currentPassword, newPassword);
  }

  @Router.delete("/users")
  async deleteUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    Sessioning.end(session);
    return await Authing.delete(user);
  }

  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Authing.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await Authing.getUserByUsername(author))._id;
      posts = await Posting.getByAuthor(id);
    } else {
      posts = await Posting.getPosts();
    }
    return Responses.posts(posts);
  }

  @Router.post("/posts")
  async createPost(session: SessionDoc, content: string, community1: string, community2?: string, community3?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, content, options);
    if (created.post) {
      if (community1) {
        LabelingPosts.affixLabel(created.post._id, community1);
      } else {
        throw new NotAllowedError("No community selected!");
      }
      if (community2) {
        LabelingPosts.affixLabel(created.post._id, community2);
      }
      if (community3) {
        LabelingPosts.affixLabel(created.post._id, community3);
      }
    } else {
      throw new NotAllowedError("Post not found.");
    }
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.patch("/posts/:id")
  async updatePost(session: SessionDoc, id: string, content?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return await Posting.update(oid, content, options);
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    return Posting.delete(oid);
  }

  @Router.get("/friends")
  async getFriends(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.idsToUsernames(await Friending.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: SessionDoc, friend: string) {
    const user = Sessioning.getUser(session);
    const friendOid = (await Authing.getUserByUsername(friend))._id;
    return await Friending.removeFriend(user, friendOid);
  }

  @Router.get("/friend/requests")
  async getRequests(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Responses.friendRequests(await Friending.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.sendRequest(user, toOid);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.removeRequest(user, toOid);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.acceptRequest(fromOid, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.rejectRequest(fromOid, user);
  }

  @Router.post("/communities/create")
  async createCommunity(session: SessionDoc, communityName: string) {
    const user = Sessioning.getUser(session);
    await LabelingUsers.createLabel(communityName);
    await LabelingPosts.createLabel(communityName);
    return LabelingUsers.affixLabel(user, communityName);
  }

  @Router.post("/communities/symptoms/add")
  async addCommonSymptom(session: SessionDoc, communityName: string, symptom: string) {
    const user = Sessioning.getUser(session);
    if (!(await LabelingUsers.checkIfItemLabeled(user, communityName))) {
      throw new NotAllowedError("Must be member of community to contribute to common symptoms.");
    }
    const communityLabel = await LabelingPosts.labels.readOne({ labelName: communityName });
    if (!communityLabel) {
      throw new NotAllowedError("Community does not exist.");
    }
    const symptomLabel = await LabelingLabels.labels.readOne({ labelName: symptom });
    if (!symptomLabel) {
      await LabelingLabels.createLabel(symptom);
    }
    return await LabelingLabels.affixLabel(communityLabel._id, symptom);
  }

  @Router.delete("/communities/symptoms/delete")
  async deleteCommonSymptom(session: SessionDoc, communityName: string, symptom: string) {
    const user = Sessioning.getUser(session);
    if (!(await LabelingUsers.checkIfItemLabeled(user, communityName))) {
      throw new NotAllowedError("Must be member of community to contribute to common symptoms.");
    }
    const communityLabel = await LabelingPosts.labels.readOne({ labelName: communityName });
    if (!communityLabel) {
      throw new NotAllowedError("Community does not exist.");
    }
    return await LabelingLabels.removeLabel(communityLabel._id, symptom);
  }

  @Router.get("/communities/search")
  async searchBySymptoms(symptoms: string) {
    const symptomList = symptoms.split(",");
    const itemIds = await LabelingLabels.findItemsByLabels(symptomList);
    const result = [];
    for (const itemId of itemIds) {
      result.push(await LabelingPosts.labels.readOne({ _id: itemId }));
    }
    return result;
  }

  @Router.post("/communities/join")
  async joinCommunity(session: SessionDoc, communityName: string) {
    const user = Sessioning.getUser(session);
    return await LabelingUsers.affixLabel(user, communityName);
  }

  @Router.delete("/communities/leave")
  async leaveCommunity(session: SessionDoc, communityName: string) {
    const user = Sessioning.getUser(session);
    return await LabelingUsers.removeLabel(user, communityName);
  }

  @Router.get("/communities/members/:communityName")
  async getCommunityMembers(session: SessionDoc, communityName: string) {
    return await LabelingUsers.findItemsByLabel(communityName);
  }

  @Router.get("/communities/:communityName")
  async getCommunityPosts(communityName: string) {
    const ids = await LabelingPosts.findItemsByLabel(communityName);
    const posts = [];
    for (const id of ids) {
      posts.push(await Posting.getById(id));
    }
    return posts;
  }

  @Router.get("/communities")
  async getUserCommunities(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await LabelingUsers.getItemLabels(user);
  }

  @Router.get("/chats")
  async getChats(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Messaging.getChats(user);
  }

  @Router.get("/chats/:chatter")
  async getChatMessages(session: SessionDoc, chatter: string) {
    const user = Sessioning.getUser(session);
    const chatterId = (await Authing.getUserByUsername(chatter))._id;
    return await Messaging.getChatMessages(user, chatterId);
  }

  @Router.post("/chats/start")
  async startChat(session: SessionDoc, chatter: string) {
    const user = Sessioning.getUser(session);
    const chatterId = (await Authing.getUserByUsername(chatter))._id;
    return await Messaging.startChat(user, chatterId);
  }

  @Router.post("/chats/send/:to")
  async sendMessage(session: SessionDoc, to: string, content: string) {
    const user = Sessioning.getUser(session);
    const toId = (await Authing.getUserByUsername(to))._id;
    return await Messaging.sendMessage(toId, user, content);
  }

  @Router.post("/matches/optin")
  async optInToMatch(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Matching.optIn(user);
  }

  @Router.delete("/matches/optout")
  async optOutOfMatch(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Matching.optOut(user);
  }

  @Router.post("/match")
  async matchBuddy(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    const communities = await LabelingUsers.getItemLabels(user);
    for (const community of communities) {
      const members = await LabelingUsers.findItemsByLabel(community);
      for (const member of members) {
        if ((await Matching.checkIfMatchable(member)) && !(await Matching.checkIfMatched(user, member))) {
          await Matching.createMatch(user, member);
          await Messaging.startChat(user, member);
          return { msg: "Match created!", member };
        }
      }
    }
    return { msg: "No matches found." };
  }

  @Router.post("/post/comments/add")
  async addComment(session: SessionDoc, parentId: string, content: string) {
    const user = Sessioning.getUser(session);
    const parent = new ObjectId(parentId);
    return await Commenting.addComment(parent, user, content);
  }

  @Router.post("/post/comments/reply")
  async replyToComment(session: SessionDoc, parentId: string, content: string) {
    const user = Sessioning.getUser(session);
    const parent = new ObjectId(parentId);
    return await Replying.addComment(parent, user, content);
  }

  @Router.delete("/post/comments/delete")
  async deleteComment(session: SessionDoc, commentId: string) {
    const user = Sessioning.getUser(session);
    const comment = new ObjectId(commentId);
    return await Commenting.deleteComment(comment);
  }

  @Router.get("/post/comments")
  async getComments(postId: string) {
    const id = new ObjectId(postId);
    return await Commenting.getItemComments(id);
  }

  @Router.get("/post/comments/replies")
  async getRepliesToComment(commentId: string) {
    const id = new ObjectId(commentId);
    return await Replying.getItemComments(id);
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
