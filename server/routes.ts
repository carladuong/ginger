import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Commenting, Friending, LabelingPosts, LabelingUsers, Matching, Messaging, Posting, Sessioning } from "./app";
import { PostOptions } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";

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
  async createPost(session: SessionDoc, content: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, content, options);
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
    return await LabelingPosts.findItemsByLabel(communityName);
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
  async getChatMessages(session: SessionDoc, chatter: ObjectId) {
    const user = Sessioning.getUser(session);
    return await Messaging.getChatMessages(user, chatter);
  }

  @Router.post("/chats/start")
  async startChat(session: SessionDoc, chatter: ObjectId) {
    const user = Sessioning.getUser(session);
    return await Messaging.startChat(user, chatter);
  }

  @Router.post("/chats/send/:to")
  async sendMessage(session: SessionDoc, to: ObjectId, content: string) {
    const user = Sessioning.getUser(session);
    return await Messaging.sendMessage(to, user, content);
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
    await Matching.optIn(user);
    const communities = await LabelingUsers.getItemLabels(user);
    for (const community of communities) {
      const members = await LabelingUsers.findItemsByLabel(community);
      for (const member of members) {
        if ((await Matching.checkIfMatchable(member)) && !(await Matching.checkIfMatched(user, member))) {
          await Matching.createMatch(user, member);
          await Messaging.startChat(user, member);
          break;
        }
      }
    }
    return { msg: "No matches found." };
  }

  @Router.post("/post/comments/add")
  async addComment(session: SessionDoc, parent: ObjectId, content: string) {
    const user = Sessioning.getUser(session);
    return await Commenting.addComment(parent, user, content);
  }

  @Router.delete("/post/comments/delete")
  async deleteComment(session: SessionDoc, comment: ObjectId) {
    const user = Sessioning.getUser(session);
    return await Commenting.deleteComment(comment);
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
