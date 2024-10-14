import { strict as assert } from "assert";
import dotenv from "dotenv";
import process from "process";

// Make sure we are in test mode!
process.env.TEST = "true";

// Also need to load the .env file
dotenv.config();

import type { SessionDoc } from "../server/concepts/sessioning";

// Test mode must be set before importing the routes
import { app } from "../server/routes";

import db, { client } from "../server/db";
if (db.databaseName !== "test-db") {
  throw new Error("Not connected to test database");
}

// Actual sessions are created by Express, here we use a mock session
function getEmptySession() {
  return { cookie: {} } as SessionDoc;
}

// Before each test...
beforeEach(async () => {
  // Drop the test database
  await db.dropDatabase();

  // Add some default users we can use
  await app.createUser(getEmptySession(), "alice", "alice123");
  await app.createUser(getEmptySession(), "bob", "bob123");
});

// After all tests are done...
after(async () => {
  // Close the database connection so that Node exits
  await client.close();
});

describe("Create a user and log in", () => {
  it("should create a user and log in", async () => {
    const session = getEmptySession();

    const created = await app.createUser(session, "barish", "1234");
    assert(created.user);
    await assert.rejects(app.logIn(session, "barish", "123"));
    await app.logIn(session, "barish", "1234");
    await assert.rejects(app.logIn(session, "barish", "1234"), "Should not be able to login while already logged-in");
  });

  it("duplicate username should fail", async () => {
    const session = getEmptySession();

    const created = await app.createUser(session, "barish", "1234");
    assert(created.user);
    await assert.rejects(app.createUser(session, "barish", "1234"));
  });

  it("get invalid username should fail", async () => {
    await assert.rejects(app.getUser(""), "Username should be at least 1 character long");
    await app.getUser("alice");
  });
});

describe("Create a community and post to it", () => {
  it("should create and join a community", async () => {
    const session = getEmptySession();

    await app.logIn(session, "alice", "alice123");
    await app.createCommunity(session, "Endometriosis");
    assert.notEqual((await app.getCommunityMembers(session, "Endometriosis")).length, 0);
    await assert.rejects(app.createCommunity(session, "Endometriosis"));
  });

  it("should create post in community", async () => {
    const session = getEmptySession();

    await app.logIn(session, "bob", "bob123");
    await app.createCommunity(session, "OCD");
    await app.createPost(session, "hello!", "OCD");
    assert.notEqual((await app.getCommunityPosts("OCD")).length, 0);
  });
});

describe("Start chat and send a message to another user", () => {
  it("should send a message to another user", async () => {
    const session = getEmptySession();

    await app.logIn(session, "alice", "alice123");
    await app.startChat(session, "bob");
    assert.rejects(app.startChat(session, "bob"));
    await app.sendMessage(session, "bob", "hi bob");
    assert.notEqual((await app.getChatMessages(session, "bob")).length, 0);
  });
});

describe("Symptom search", () => {
  it("should add known symptom to community ", async () => {
    const session = getEmptySession();

    await app.logIn(session, "alice", "alice123");
    await app.createCommunity(session, "JIA");
    await app.addCommonSymptom(session, "JIA", "joint pain");
    assert.equal((await app.searchBySymptoms("joint pain"))[0]?.labelName, "JIA");
  });
});

/*
 * As you add more tests, remember to put them inside `describe` blocks.
 */
