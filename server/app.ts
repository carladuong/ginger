import AuthenticatingConcept from "./concepts/authenticating";
import CommentingConcept from "./concepts/commenting";
import FriendingConcept from "./concepts/friending";
import LabelingConcept from "./concepts/labeling";
import MatchingConcept from "./concepts/matching";
import MessagingConcept from "./concepts/messaging";
import PostingConcept from "./concepts/posting";
import SessioningConcept from "./concepts/sessioning";

// The app is a composition of concepts instantiated here
// and synchronized together in `routes.ts`.
export const Sessioning = new SessioningConcept();
export const Authing = new AuthenticatingConcept("users");
export const Posting = new PostingConcept("posts");
export const Friending = new FriendingConcept("friends");
export const LabelingPosts = new LabelingConcept("postLabels");
export const LabelingUsers = new LabelingConcept("userLabels");
export const LabelingLabels = new LabelingConcept("symptoms");
export const Messaging = new MessagingConcept("messages");
export const Matching = new MatchingConcept("matches");
export const Commenting = new CommentingConcept("comments");
export const Replying = new CommentingConcept("replies");
