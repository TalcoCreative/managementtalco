## Scope

Two changes requested:

1. **Sidebar height fix** — current desktop icon rail does not stretch to the full page height when content is long.
2. **New Chat feature** — full in-app messaging system: DMs + groups, mentions of people and entities (tasks, projects, shooting, meetings, events, clients, prospects, KOL, EP), floating chat button, unread badge on dashboard + on the floating button, real-time updates, push notifications.

---

## 1. Sidebar height fix

`src/components/layout/AppSidebar.tsx` currently uses `h-screen` inside a flex parent that grows with content. Switch the layout root in `AppLayout.tsx` so the sidebar is `sticky top-0 h-dvh` (or set `align-items: stretch` + `h-auto min-h-dvh`) so the rail visually matches the full scroll height while the icons stay pinned at top. Will use `sticky top-0 self-start h-dvh` on the sidebar container — this is the cleanest fix and keeps icons visible on long pages.

---

## 2. Chat feature

### Database (new migration)

```text
chat_conversations
  id, type ('dm' | 'group'), name (nullable), avatar_url (nullable),
  created_by, created_at, updated_at, last_message_at

chat_participants
  id, conversation_id, user_id, role ('admin' | 'member'),
  joined_at, last_read_at, muted

chat_messages
  id, conversation_id, sender_id, content (text),
  reply_to_id (nullable), created_at, edited_at, deleted_at

chat_message_mentions
  id, message_id, mention_type ('user'|'task'|'project'|'shooting'|
    'meeting'|'event'|'client'|'prospect'|'kol'|'editorial_plan'),
  entity_id (uuid)
```

RLS: a user can read/write a conversation only if they are a participant. Mentions inherit from message.

Triggers:
- `update last_message_at` on insert into chat_messages
- push-notification trigger on new message → calls `send-web-push` for all participants except sender (reusing the existing edge function pattern)
- mention trigger → notifies mentioned users (push + bell notification row)

Realtime: add `chat_messages`, `chat_conversations`, `chat_participants` to `supabase_realtime` publication.

### Frontend

New files:
- `src/components/chat/ChatPopup.tsx` — floating panel with conversation list ↔ active conversation view (mirrors AIChatPopup pattern)
- `src/components/chat/ChatFloatingButton.tsx` — fixed bottom-right button with unread badge (desktop only — mobile uses bottom nav category)
- `src/components/chat/ConversationList.tsx`
- `src/components/chat/ConversationView.tsx` — messages, input, mention picker
- `src/components/chat/MentionPicker.tsx` — typeahead dropdown that searches users + entities by `@`-trigger and a small type chip (`@user:`, `@task:`, `@project:` …); single `@` opens unified search
- `src/components/chat/NewConversationDialog.tsx` — start DM or create group
- `src/components/chat/MessageBubble.tsx` — renders text + clickable mention pills that route to the entity
- `src/components/dashboard/ChatUnreadCard.tsx` — small card on the dashboard showing total unread count + recent conversations
- `src/hooks/useChatUnread.ts` — single source of truth for unread count (used by floating button and dashboard card), subscribes to realtime

Mounting:
- Add `<ChatFloatingButton />` to `AppLayout.tsx` (desktop only); on mobile, surface chat from the existing bottom nav "People" category
- Add `<ChatUnreadCard />` to `src/pages/Index.tsx` (dashboard)

### Mention search backend

Reuse the existing `GlobalSearch` query patterns — wrap the multi-table search into a small util `src/lib/mention-search.ts` shared between `GlobalSearch` and `MentionPicker`. Returns unified result rows `{type, id, label, secondary}`.

### Storage of mentions in messages

`content` stores plain text with markers like `@[Task: Brief Acme](task:uuid)`. On render, `MessageBubble` parses markers into clickable pills. `chat_message_mentions` rows are inserted alongside for indexing/notifications.

### Realtime subscription

`useChatUnread` and `ConversationView` subscribe to `postgres_changes` on `chat_messages` filtered by participant.

---

## Out of scope

- Voice/video calls, attachments, reactions, typing indicators (can come later)
- Message editing/deleting UI (schema supports it, UI minimal)
- Search inside chat history

---

## Verification

- Build passes
- Send DM between two users in dev
- Create a group, mention a task → mentioned user gets a push + bell notification
- Long page → sidebar visually fills full height
- Unread badge updates in realtime when a new message arrives
