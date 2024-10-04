import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Friending, Grouping, Labeling, Posting, Sessioning } from "./app";
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

  @Router.get("/labels/items/:labelName")
  async getItemsWithLabel(session: SessionDoc, labelName: string) {
    return Labeling.findItemsByLabel(labelName);
  }

  @Router.get("/posts/labels/:id")
  async postLabels(session: SessionDoc, id: ObjectId) {
    return Labeling.getItemLabels(id);
  }

  @Router.post("/labels/create/:labelName")
  async createLabel(session: SessionDoc, labelName: string) {
    return Labeling.createLabel(labelName);
  }

  @Router.post("/labels/add")
  async addLabel(session: SessionDoc, labelName: string, post: ObjectId) {
    return Labeling.affixLabel(post, labelName);
  }

  @Router.delete("/labels/remove")
  async removeLabel(session: SessionDoc, labelName: string, post: ObjectId) {
    return Labeling.removeLabel(post, labelName);
  }

  @Router.get("/groups/members/:groupName")
  async getGroupMembers(session: SessionDoc, groupName: string) {
    return Grouping.getMembers(groupName);
  }

  @Router.get("/user/groups/:userId")
  async getUserGroups(session: SessionDoc, userId: ObjectId) {
    return Grouping.getGroupsForUser(userId);
  }

  @Router.get("/groups")
  async getAllGroups(session: SessionDoc) {
    return Grouping.getGroups();
  }

  @Router.post("/groups/join/:groupName")
  async joinGroup(session: SessionDoc, groupName: string) {
    const user = Sessioning.getUser(session);
    return Grouping.joinGroup(user, groupName);
  }

  @Router.delete("/groups/leave/:groupName")
  async leaveGroup(session: SessionDoc, groupName: string) {
    const user = Sessioning.getUser(session);
    return Grouping.leaveGroup(user, groupName);
  }

  @Router.post("/groups/create/:groupName")
  async createGroup(session: SessionDoc, groupName: string) {
    return Grouping.createGroup(groupName);
  }

  @Router.post("/matches/find")
  async findMatches() {
    throw new Error("Not yet implemented");
  }

  @Router.post("/post/comments/add")
  async addComment() {
    throw new Error("Not yet implemented");
  }

  @Router.delete("/post/comments/delete")
  async deleteComment() {
    throw new Error("Not yet implemented");
  }

  @Router.get("/chats")
  async getChats() {
    throw new Error("Not yet implemented");
  }

  @Router.post("/chats/start/:user")
  async startChat() {
    throw new Error("Not yet implemented");
  }

  @Router.post("/chats/send/:user")
  async sendMessage() {
    throw new Error("Not yet implemented");
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
