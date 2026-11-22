# DuelZone --- End-to-End Coding Agent Project Brief

> **Purpose:** This document is the single source of truth for an AI
> coding agent building DuelZone, a production-minded 1v1 multiplayer
> gaming web application. The agent must plan, implement, test,
> document, and prepare the application for deployment end to end.

------------------------------------------------------------------------

## 1. Instructions to the Coding Agent

You are a senior full-stack engineer, software architect, UI/UX
designer, security reviewer, and QA engineer.

Build **DuelZone**, a responsive browser-based gaming platform where
authenticated users can play three 1v1 games:

1.  Tic-Tac-Toe
2.  Rock Paper Scissors
3.  Connect Four

Players must be able to compete with a friend through a private room
code or be paired with a random opponent through matchmaking. The
application also includes player profiles, match history, XP, levels,
competitive ranks, a global leaderboard, and in-game chat.

### Required working style

-   First inspect the repository and identify its current state. Do not
    overwrite existing work without understanding it.
-   If the repository is empty, scaffold the project using the
    architecture in this document.
-   Before implementation, produce a concise execution plan and identify
    assumptions or conflicts.
-   Implement in small, verifiable phases. Keep the application runnable
    after each phase.
-   Do not create fake buttons, placeholder interactions, or UI that
    looks functional but is not connected.
-   Do not claim a feature is complete until it is implemented and
    tested.
-   Prefer simple, maintainable solutions over unnecessary abstractions.
-   Use strict input validation, clear error handling, and secure
    defaults.
-   Keep secrets in environment variables. Never commit `.env` files or
    credentials.
-   Add loading, empty, success, error, offline, reconnecting, and
    opponent-disconnected states where relevant.
-   Use accessible semantic HTML, keyboard support, visible focus
    states, and responsive layouts.
-   Add comments for non-obvious logic, not for every line.
-   Keep dependencies current and compatible; do not blindly install
    packages.
-   Do not use mock data in production flows. Seed data may be provided
    for local development and must be clearly identified.
-   When finished, provide setup instructions, environment variable
    documentation, test results, deployment instructions, and a list of
    any remaining limitations.

### Definition of done

The project is complete only when:

-   A user can register, log in, log out, and maintain an authenticated
    session.
-   Two distinct authenticated users can play each of the three games in
    separate browser sessions.
-   Private room creation and joining work.
-   Random matchmaking works independently for each game.
-   Game state is validated and controlled by the server.
-   Results are persisted and cannot be awarded twice.
-   XP, levels, ranks, statistics, leaderboard, and match history update
    correctly.
-   In-game chat works only for authorized players in the relevant
    match.
-   Disconnection and reconnection scenarios are handled.
-   Core flows are tested and documented.
-   The app can be run locally using the documented commands.

------------------------------------------------------------------------

# 2. Product Overview

## 2.1 Product name

**DuelZone**

## 2.2 Product summary

DuelZone is a web-based 1v1 multiplayer gaming hub. Users select a game,
invite a friend using a private room code, or enter a random matchmaking
queue. Each match is synchronized in real time through WebSockets. The
server is authoritative: it validates actions, manages turns and timers,
determines outcomes, and awards progression points.

## 2.3 Goals

-   Provide a simple, attractive, low-friction multiplayer experience.
-   Support three different game mechanics through one reusable match
    infrastructure.
-   Demonstrate full-stack development, database design, REST APIs,
    WebSockets, authentication, and real-time state management.
-   Provide meaningful player progression and competitive engagement.
-   Work on desktop and mobile browsers.

## 2.4 Out of scope for the initial release

Do not build these unless the core scope is stable:

-   Voice or video calling.
-   Payments, subscriptions, or betting.
-   Tournaments and team play.
-   Spectator mode.
-   Native mobile applications.
-   Complex friend/follow social graph.
-   AI opponents.
-   In-game purchases or cosmetic stores.
-   Elo-based ranked matchmaking in the first release.

Design the architecture so future additions are possible without
building them now.

## 2.5 Target users

-   Casual players who want quick 1v1 matches.
-   Friends who want to play through private room codes.
-   Competitive users who want to track XP, rank, and match records.

------------------------------------------------------------------------

# 3. Functional Requirements

Use the IDs below in code comments, tests, and the final requirements
traceability checklist where useful.

## 3.1 Authentication and account management

-   **FR-AUTH-01:** Users can register with a unique username, email,
    and password.
-   **FR-AUTH-02:** Validate email format, username rules, and password
    strength.
-   **FR-AUTH-03:** Hash passwords using bcrypt or Argon2. Never store
    plaintext passwords.
-   **FR-AUTH-04:** Users can log in and log out.
-   **FR-AUTH-05:** Authenticated sessions use secure, HTTP-only cookies
    where practical. If bearer tokens are used, document the storage and
    refresh strategy; avoid long-lived tokens in localStorage.
-   **FR-AUTH-06:** Protected APIs and Socket.io connections require
    valid authentication.
-   **FR-AUTH-07:** Users can view and update allowed profile fields.
-   **FR-AUTH-08:** Users can choose an avatar from a safe predefined
    avatar set or use a validated image URL if upload support is
    deliberately implemented.
-   **FR-AUTH-09:** Users can change their password through a secure
    flow if password reset is implemented; otherwise clearly document
    that it is not included in MVP.
-   **FR-AUTH-10:** Duplicate email and username registrations must be
    rejected with safe, useful messages.

## 3.2 Player profile

Display:

-   Username and avatar.
-   Account creation date.
-   Total XP and level.
-   Current rank.
-   Total matches, wins, losses, and draws.
-   Win rate.
-   Per-game statistics.
-   Recent match history.

Do not expose email addresses or private account information on public
profiles.

## 3.3 Game lobby

-   **FR-LOBBY-01:** Display the three available games.
-   **FR-LOBBY-02:** Each game card shows a short description and play
    action.
-   **FR-LOBBY-03:** Users can choose Quick Match or Private Room.
-   **FR-LOBBY-04:** Show the user's connection state.
-   **FR-LOBBY-05:** Prevent a user from joining multiple active matches
    at once.
-   **FR-LOBBY-06:** Provide a cancel-search action for matchmaking.

## 3.4 Private rooms

-   **FR-ROOM-01:** An authenticated user can create a room for a
    selected game.
-   **FR-ROOM-02:** The server generates a unique, unpredictable room
    code (six characters or longer; use an unambiguous alphabet).
-   **FR-ROOM-03:** The creator becomes Player 1 and waits for an
    opponent.
-   **FR-ROOM-04:** Another authenticated user can join using the code.
-   **FR-ROOM-05:** Reject invalid, expired, full, completed, or
    already-started rooms.
-   **FR-ROOM-06:** A room supports exactly two players.
-   **FR-ROOM-07:** The host can cancel a waiting room.
-   **FR-ROOM-08:** Rooms expire after a configurable waiting period.
-   **FR-ROOM-09:** Do not reveal private room details to unauthorized
    users.

## 3.5 Random matchmaking

-   **FR-MM-01:** A player can queue for one selected game.
-   **FR-MM-02:** Maintain a separate queue per game.
-   **FR-MM-03:** Pair two eligible players atomically.
-   **FR-MM-04:** A player can cancel while waiting.
-   **FR-MM-05:** Prevent duplicate queue entries and self-matches.
-   **FR-MM-06:** Do not pair users who already have an active match.
-   **FR-MM-07:** Notify both players when a match is found.
-   **FR-MM-08:** Handle a player disconnecting before the match begins.
-   **FR-MM-09:** Use a queue timeout and return the player to the lobby
    with a clear message.
-   **FR-MM-10:** In a single-server MVP, an in-memory queue is
    acceptable if its limitations are documented. Use Redis-backed
    queues before horizontal scaling.

## 3.6 Match lifecycle

A match should move through explicit states:

`WAITING_FOR_PLAYER -> READY -> IN_PROGRESS -> COMPLETED`

Additional terminal or recovery states may include:

`CANCELLED`, `ABANDONED`, `EXPIRED`.

-   **FR-MATCH-01:** Every match has a unique ID and exactly two player
    IDs once ready.
-   **FR-MATCH-02:** Server assigns player slots and game-specific
    symbols/colors.
-   **FR-MATCH-03:** Server owns the canonical game state.
-   **FR-MATCH-04:** Server validates every action against match state,
    player membership, turn, and game rules.
-   **FR-MATCH-05:** Server broadcasts the updated state to authorized
    match participants.
-   **FR-MATCH-06:** Server determines the outcome; never trust a
    client-supplied winner.
-   **FR-MATCH-07:** Completed results are persisted exactly once.
-   **FR-MATCH-08:** Players can request a rematch.
-   **FR-MATCH-09:** A rematch creates a new match or a clearly
    versioned new round; do not overwrite the previous result.
-   **FR-MATCH-10:** Show a result screen with outcome, XP earned, and
    rematch/lobby actions.

## 3.7 Game requirements

### Tic-Tac-Toe

-   Board is 3 × 3.
-   Two players receive X and O.
-   Server assigns the first turn.
-   A move must target an empty valid cell.
-   Players alternate turns.
-   Win conditions: three matching marks in a row, column, or diagonal.
-   Draw condition: all cells occupied and no winner.
-   Reject moves after completion.
-   Support a configurable per-move timeout if timers are enabled.
-   UI displays current turn, player names, symbols, and result.

### Rock Paper Scissors

-   Two players submit choices simultaneously.
-   Valid choices: `ROCK`, `PAPER`, `SCISSORS`.
-   Do not reveal either choice until both have submitted or a round
    timeout occurs.
-   Resolve outcomes on the server.
-   Use best-of-five rounds: first player to three round wins wins the
    match. If a different match rule is selected, document it
    consistently.
-   If both choices are equal, the round is a draw and does not
    increment either player's round wins.
-   Each round has a configurable selection deadline.
-   Prevent a player from changing a submitted choice.
-   Clear round choices after resolution and prepare the next round.
-   UI displays round number, hidden/submitted status, score, countdown,
    and revealed result.

### Connect Four

-   Board is 6 rows × 7 columns.
-   Players receive distinct token colors.
-   A move specifies a valid column.
-   Server places the token in the lowest available row in that column.
-   Reject full columns and invalid columns.
-   Detect four consecutive tokens horizontally, vertically, and
    diagonally.
-   Draw if the board is full without a winner.
-   Reject moves after completion.
-   UI displays whose turn it is, the board, player colors, and result.

## 3.8 Chat

-   **FR-CHAT-01:** Only the two authenticated participants can send and
    receive messages in a match room.
-   **FR-CHAT-02:** Validate message length, for example 1--500
    characters.
-   **FR-CHAT-03:** Trim whitespace and reject empty messages.
-   **FR-CHAT-04:** Render messages safely as text; do not render
    arbitrary HTML.
-   **FR-CHAT-05:** Apply rate limits to prevent spam.
-   **FR-CHAT-06:** Persist chat messages if match chat history is part
    of the selected implementation; otherwise document the transient
    behavior.
-   **FR-CHAT-07:** Show sender and timestamp.
-   **FR-CHAT-08:** Chat must not expose messages from other matches.

## 3.9 XP, levels, ranks, and leaderboard

Initial configurable rewards:

  Outcome      XP
  --------- -----
  Win         +30
  Loss        +10
  Draw        +15

Initial level progression proposal:

`XP required for next level = 500 × current level`

Ranks based on total XP:

  Rank                   XP
  ---------- --------------
  Bronze             0--499
  Silver         500--1,499
  Gold         1,500--2,999
  Platinum     3,000--4,999
  Diamond            5,000+

Rules:

-   Keep XP and rank thresholds in a centralized configuration, not
    scattered through code.
-   Award XP only after a valid completed match.
-   Ensure a match result can award XP only once.
-   Do not award XP for abandoned or invalid matches unless a documented
    policy says otherwise.
-   Store an XP transaction/ledger or equivalent idempotency record so
    duplicate events cannot double-award points.
-   Update player totals and match statistics consistently.
-   Leaderboard is sorted by XP descending, with a deterministic
    tie-breaker such as wins and then account creation date.
-   Paginate leaderboard results.
-   Display the current user's position even if outside the current
    page, where practical.
-   Clearly label XP-based rank as progression rank. It is not a skill
    rating.

------------------------------------------------------------------------

# 4. Non-Functional Requirements

-   **NFR-01 Performance:** Normal UI interactions should feel
    immediate; real-time game events should be delivered with low
    latency under ordinary network conditions.
-   **NFR-02 Reliability:** A transient socket disconnect must not
    silently corrupt match state.
-   **NFR-03 Security:** Validate all input on the server; authenticate
    and authorize all protected operations.
-   **NFR-04 Scalability:** Keep matchmaking and game state behind
    service interfaces so Redis can be introduced later.
-   **NFR-05 Maintainability:** Use modular game engines, reusable UI
    components, clear naming, and documented contracts.
-   **NFR-06 Usability:** Provide clear instructions, status messages,
    and responsive layouts.
-   **NFR-07 Accessibility:** Keyboard navigation, focus indicators,
    sufficient contrast, and accessible labels.
-   **NFR-08 Data integrity:** Completed match results, XP awards, and
    statistics must be consistent and idempotent.
-   **NFR-09 Compatibility:** Support current major desktop and mobile
    browsers.
-   **NFR-10 Observability:** Use structured server logs and meaningful
    error codes; never log passwords, tokens, or secrets.

------------------------------------------------------------------------

# 5. High-Level Design (HLD)

## 5.1 Recommended architecture

Use a modular monolith for the initial version. This keeps deployment
and development manageable while maintaining clear module boundaries.

### Frontend

-   React + Vite.
-   React Router for page navigation.
-   Tailwind CSS for styling.
-   Socket.io client for real-time events.
-   A small shared auth/session state layer.
-   A match state layer that consumes server snapshots and events.
-   A reusable game shell around game-specific boards.

### Backend

-   Node.js.
-   Express REST API.
-   Socket.io real-time gateway.
-   MongoDB.
-   Mongoose.
-   Authentication and authorization middleware.
-   Domain services for matchmaking, matches, game engines, chat, and
    progression.

### Infrastructure

-   Frontend hosting: Vercel or equivalent.
-   Backend hosting: Render or equivalent, with WebSocket support.
-   Database: MongoDB Atlas.
-   Optional future infrastructure: Redis for multi-instance
    matchmaking, presence, and Socket.io adapter.

## 5.2 HLD component diagram

``` text
                         +----------------------+
                         |      Web Browser     |
                         |   React + Vite UI    |
                         +----------+-----------+
                                    |
                  +-----------------+-----------------+
                  |                                   |
             HTTPS / REST                         WebSocket
                  |                                   |
       +----------v-----------+            +----------v-----------+
       |   Express API Layer  |            |  Socket.io Gateway   |
       +----------+-----------+            +----------+-----------+
                  |                                   |
       +----------v-----------------------------------v-----------+
       |                  Application Services                    |
       |                                                           |
       | Auth | Users | Matchmaking | Match | Game Engines | Chat  |
       |                 Progression | Leaderboard                  |
       +-------------------------------+---------------------------+
                                       |
                              +--------v--------+
                              |    MongoDB      |
                              | Users, Matches, |
                              | Stats, XP, Chat |
                              +-----------------+

       Future scaling:
       Redis for distributed queues, presence, locks, and Socket.io adapter.
```

## 5.3 HLD module responsibilities

  Module          Responsibility
  --------------- ------------------------------------------------
  Auth            Registration, login, session validation
  Users           Public profile and account settings
  Lobby           Game discovery and lobby state
  Rooms           Private room lifecycle and codes
  Matchmaking     Per-game queues and pairing
  Match           Match state, player membership, lifecycle
  Game engines    Pure rules and state transitions for each game
  Chat            Authorized match chat and persistence
  Progression     XP, levels, ranks, stats
  Leaderboard     Ranking queries and pagination
  Presence        Connected/disconnected status
  Observability   Logging, error reporting, health checks

## 5.4 Main data flows

### Private room

1.  Client sends `room:create` with selected game.
2.  Server authenticates the socket.
3.  Room service creates a waiting room and unique code.
4.  Creator is added as Player 1.
5.  Creator receives room code and waiting status.
6.  Opponent submits `room:join`.
7.  Server validates code, room expiry, room capacity, and user
    eligibility.
8.  Server adds Player 2, initializes game state, and marks match ready.
9.  Both players receive `match:ready` and the initial state.

### Random matchmaking

1.  Client sends `matchmaking:join` with a game type.
2.  Server verifies that user is authenticated and not already active or
    queued.
3.  Matchmaking service adds the player to that game's queue.
4.  Service atomically selects another eligible player.
5.  Service creates a match and removes both queue entries.
6.  Both players join the match socket room.
7.  Both receive the same initial match snapshot.
8.  Match begins.

### Game action

1.  Client sends a game action with match ID and action payload.
2.  Server verifies authentication and match membership.
3.  Server checks match status and turn/phase.
4.  Game engine validates and applies the action.
5.  Server stores or safely checkpoints the updated state.
6.  Server broadcasts the authoritative state to both players.
7.  If terminal, server finalizes the result and awards progression
    once.

### Match completion

1.  Game engine returns a terminal outcome.
2.  Match service performs an idempotent completion operation.
3.  Result is persisted.
4.  XP ledger entries are created once.
5.  Player statistics and XP totals are updated consistently.
6.  Leaderboard data reflects the new totals.
7.  Both clients receive `match:completed`.

------------------------------------------------------------------------

# 6. Low-Level Design (LLD)

## 6.1 Suggested repository structure

Use a monorepo with separate client and server directories.

``` text
duelzone/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.jsx
│   │   │   ├── router.jsx
│   │   │   └── providers/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── common/
│   │   │   ├── game/
│   │   │   └── profile/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── lobby/
│   │   │   ├── matchmaking/
│   │   │   ├── rooms/
│   │   │   ├── matches/
│   │   │   ├── chat/
│   │   │   ├── leaderboard/
│   │   │   └── history/
│   │   ├── games/
│   │   │   ├── tic-tac-toe/
│   │   │   ├── rock-paper-scissors/
│   │   │   └── connect-four/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/
│   │   ├── socket/
│   │   ├── styles/
│   │   └── main.jsx
│   ├── package.json
│   └── .env.example
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── sockets/
│   │   ├── games/
│   │   │   ├── tic-tac-toe/
│   │   │   ├── rock-paper-scissors/
│   │   │   └── connect-four/
│   │   ├── validators/
│   │   ├── utils/
│   │   ├── constants/
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   ├── package.json
│   └── .env.example
│
├── docs/
│   ├── HLD.md
│   ├── LLD.md
│   ├── API.md
│   ├── SOCKET_EVENTS.md
│   └── TESTING.md
├── README.md
├── PROJECT.md
└── package.json
```

Adapt this structure if the repository already has a consistent
convention.

## 6.2 Backend layers

Follow this request flow:

`Route -> Middleware -> Controller -> Service -> Model/Repository`

-   **Routes:** Declare URL and HTTP method.
-   **Middleware:** Authentication, validation, rate limiting, and error
    handling.
-   **Controllers:** Parse request and return HTTP response.
-   **Services:** Implement business rules and orchestration.
-   **Game engines:** Pure deterministic functions that validate and
    transition game state.
-   **Models:** Define persistence schemas and indexes.
-   **Repositories:** Optional data-access abstraction if it genuinely
    simplifies the code.

Do not put all business logic in controllers or socket event handlers.

## 6.3 Core data models

Design Mongoose schemas with validation, timestamps, indexes, and
appropriate references.

### User

``` js
{
  username: String,       // unique, normalized
  email: String,          // unique, normalized
  passwordHash: String,
  avatar: String,
  createdAt: Date,
  updatedAt: Date
}
```

### PlayerStats

``` js
{
  userId: ObjectId,       // unique reference to User
  totalXp: Number,
  level: Number,
  rank: String,
  totalMatches: Number,
  wins: Number,
  losses: Number,
  draws: Number,
  perGame: {
    ticTacToe: { matches: Number, wins: Number, losses: Number, draws: Number },
    rockPaperScissors: { matches: Number, wins: Number, losses: Number, draws: Number },
    connectFour: { matches: Number, wins: Number, losses: Number, draws: Number }
  },
  updatedAt: Date
}
```

### Match

``` js
{
  gameType: String,       // TICTACTOE | RPS | CONNECT_FOUR
  mode: String,           // PRIVATE | RANDOM
  status: String,         // WAITING | READY | IN_PROGRESS | COMPLETED | CANCELLED | ABANDONED
  players: [{
    userId: ObjectId,
    slot: Number,
    displayNameSnapshot: String
  }],
  state: Object,          // validated game-specific state
  currentTurnUserId: ObjectId,
  winnerUserId: ObjectId, // null for draw or unfinished
  result: String,         // WIN | DRAW | ABANDONED
  startedAt: Date,
  completedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Room

A room may be a separate collection or a waiting Match document with a
unique room code. Choose one approach and avoid storing duplicate state
in both.

If separate:

``` js
{
  code: String,           // unique index, expires
  gameType: String,
  hostUserId: ObjectId,
  guestUserId: ObjectId,
  matchId: ObjectId,
  status: String,         // WAITING | JOINED | CANCELLED | EXPIRED
  expiresAt: Date,
  createdAt: Date
}
```

### ChatMessage

``` js
{
  matchId: ObjectId,
  senderId: ObjectId,
  message: String,
  createdAt: Date
}
```

### XpLedger

``` js
{
  userId: ObjectId,
  matchId: ObjectId,
  amount: Number,
  reason: String,         // WIN | LOSS | DRAW
  createdAt: Date
}
```

Create a unique compound index on `{ userId, matchId }` for XP ledger
entries so a user cannot receive duplicate rewards for the same match.

### Index recommendations

-   User: unique normalized email and username.
-   PlayerStats: unique `userId`; leaderboard sort index on `totalXp`
    and tie-break fields.
-   Match: `players.userId + completedAt`, `status + createdAt`, and
    `gameType + createdAt`.
-   Room: unique `code`, TTL index on `expiresAt` if TTL behavior is
    appropriate.
-   ChatMessage: `{ matchId: 1, createdAt: 1 }`.
-   XpLedger: unique `{ userId: 1, matchId: 1 }`.

TTL deletion is asynchronous in MongoDB. The application must still
check expiry explicitly.

## 6.4 Game engine interface

All game engines should expose a consistent interface:

``` ts
type GameEngine = {
  createInitialState(players): GameState;
  validateAction(state, playerId, action): ValidationResult;
  applyAction(state, playerId, action): GameState;
  getOutcome(state): GameOutcome | null;
  getNextPlayer(state): string | null;
};
```

Use TypeScript if feasible. If the project uses JavaScript, use JSDoc
types and runtime validation.

Keep game engines independent of Express, Socket.io, and Mongoose. This
makes them easy to unit test.

### Tic-Tac-Toe state example

``` js
{
  board: Array(9).fill(null),
  playerSymbols: {
    player1UserId: "X",
    player2UserId: "O"
  },
  currentTurnUserId: "player1UserId",
  status: "IN_PROGRESS",
  winnerUserId: null
}
```

Action:

``` js
{ type: "PLACE_MARK", index: 4 }
```

### Rock Paper Scissors state example

``` js
{
  roundNumber: 1,
  scores: { player1: 0, player2: 0 },
  submissions: {
    player1: null,
    player2: null
  },
  phase: "WAITING_FOR_CHOICES",
  deadlineAt: Date,
  status: "IN_PROGRESS",
  winnerUserId: null
}
```

Action:

``` js
{ type: "SUBMIT_CHOICE", choice: "ROCK" }
```

Never broadcast hidden choices before both players have submitted or the
round has resolved. The server may store submissions privately and
broadcast only submission status.

### Connect Four state example

``` js
{
  board: Array.from({ length: 6 }, () => Array(7).fill(null)),
  playerColors: {
    player1UserId: "RED",
    player2UserId: "YELLOW"
  },
  currentTurnUserId: "player1UserId",
  status: "IN_PROGRESS",
  winnerUserId: null
}
```

Action:

``` js
{ type: "DROP_TOKEN", column: 3 }
```

## 6.5 Game rules and validation

For every action, validate:

1.  The match exists.
2.  The user is authenticated.
3.  The user is one of the two match participants.
4.  The match is in the correct state.
5.  The action payload passes schema validation.
6.  The action is legal for the current game phase.
7.  It is the user's turn, where turn-based.
8.  The action has not already been processed.
9.  The match is not completed or expired.

Use an action ID or sequence number where needed to make retries safe.
Do not assume WebSocket delivery is exactly once.

## 6.6 Concurrency and idempotency

-   Avoid race conditions when two players join the same room
    simultaneously.
-   Use atomic MongoDB updates, transactions where supported, and unique
    indexes.
-   For matchmaking, reserve/remove queue entries atomically.
-   For match completion, use a conditional update that only transitions
    a non-terminal match to completed.
-   Award XP only if the completion transition succeeds.
-   Use a unique XP ledger key per user and match.
-   If a database transaction fails, do not send a success event.
-   Do not rely solely on client-side button disabling to prevent
    duplicate actions.

------------------------------------------------------------------------

# 7. REST API Design

Use a consistent response envelope and centralized error handling.

Example success:

``` json
{
  "success": true,
  "data": {},
  "message": "Request completed"
}
```

Example error:

``` json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted information"
  }
}
```

## 7.1 Authentication

  Method   Endpoint               Description
  -------- ---------------------- ----------------------
  POST     `/api/auth/register`   Create account
  POST     `/api/auth/login`      Authenticate
  POST     `/api/auth/logout`     End session
  GET      `/api/auth/me`         Current user/session

## 7.2 Users and profiles

  Method   Endpoint                       Description
  -------- ------------------------------ -------------------------------
  GET      `/api/users/me`                Own profile
  PATCH    `/api/users/me`                Update allowed profile fields
  GET      `/api/users/:username`         Public profile
  GET      `/api/users/:username/stats`   Public statistics

## 7.3 Rooms and matches

  Method   Endpoint                         Description
  -------- -------------------------------- ---------------------------------
  POST     `/api/rooms`                     Create private room
  POST     `/api/rooms/join`                Join by room code
  DELETE   `/api/rooms/:code`               Cancel owned waiting room
  GET      `/api/matches/:matchId`          Fetch authorized match snapshot
  GET      `/api/matches/history`           Paginated own match history
  GET      `/api/matches/:matchId/result`   Fetch authorized result

## 7.4 Leaderboard and stats

  Method   Endpoint                Description
  -------- ----------------------- -----------------------
  GET      `/api/leaderboard`      Paginated leaderboard
  GET      `/api/stats/me`         Current user's stats
  GET      `/api/stats/me/games`   Per-game stats

Validate pagination bounds and sort parameters. Never allow arbitrary
client-supplied database field names to be used in sort or query
operations.

------------------------------------------------------------------------

# 8. Socket.io Event Contract

Use a consistent event naming convention and validate every payload.

## 8.1 Client-to-server events

  -----------------------------------------------------------------------------------
  Event                     Payload                           Description
  ------------------------- --------------------------------- -----------------------
  `matchmaking:join`        `{ gameType }`                    Enter a game queue

  `matchmaking:cancel`      `{ gameType }`                    Leave queue

  `room:create`             `{ gameType }`                    Create private room

  `room:join`               `{ code }`                        Join private room

  `room:cancel`             `{ roomId }`                      Cancel waiting room

  `game:action`             `{ matchId, actionId, action }`   Submit game action

  `match:rematch-request`   `{ matchId }`                     Request rematch

  `chat:send`               `{ matchId, message }`            Send match message

  `match:reconnect`         `{ matchId, lastKnownVersion }`   Request current state
  -----------------------------------------------------------------------------------

## 8.2 Server-to-client events

  -----------------------------------------------------------------------------------------------------
  Event                           Payload                                       Description
  ------------------------------- --------------------------------------------- -----------------------
  `matchmaking:queued`            `{ gameType, position? }`                     Queue confirmation

  `matchmaking:found`             `{ matchId, opponent, gameType }`             Match found

  `matchmaking:cancelled`         `{ gameType }`                                Queue cancelled

  `room:created`                  `{ code, roomId, expiresAt }`                 Room created

  `room:joined`                   `{ matchId, players }`                        Room joined

  `match:ready`                   `{ matchId, gameType, players, state }`       Match ready

  `game:state`                    `{ matchId, version, state }`                 Authoritative state

  `game:error`                    `{ code, message }`                           Invalid action or game
                                                                                error

  `match:completed`               `{ matchId, outcome, xpAwards }`              Match completed

  `match:opponent-disconnected`   `{ userId, gracePeriodEndsAt }`               Opponent disconnected

  `match:opponent-reconnected`    `{ userId }`                                  Opponent reconnected

  `match:rematch-requested`       `{ userId }`                                  Rematch request

  `chat:message`                  `{ messageId, sender, message, createdAt }`   New message

  `server:error`                  `{ code, message }`                           General safe error
  -----------------------------------------------------------------------------------------------------

Document event payload schemas in `docs/SOCKET_EVENTS.md`. Use
acknowledgements for request/response actions where useful, with
timeouts and safe retry behavior.

## 8.3 Socket room authorization

-   Use server-generated room names, such as `match:<matchId>`.
-   Never let clients join arbitrary Socket.io rooms.
-   Before joining a match room, verify that the authenticated user is a
    participant.
-   Validate membership again for every game and chat event.
-   Do not trust a `userId` supplied in a client payload; derive
    identity from the authenticated socket session.
-   On logout or token/session revocation, disconnect or invalidate the
    associated socket.

------------------------------------------------------------------------

# 9. Matchmaking and Presence Design

## 9.1 Queue model

For a single backend instance, use an in-memory queue service with
maps/sets:

``` text
queues = {
  TICTACTOE: [],
  RPS: [],
  CONNECT_FOUR: []
}
```

Track queued users separately so the same user cannot enter duplicate
queues.

## 9.2 Pairing algorithm

1.  Authenticate the user.
2.  Validate game type.
3.  Check the user has no active match and is not queued elsewhere.
4.  Add the user to the selected queue.
5.  Remove stale/disconnected entries.
6.  Select another eligible user.
7.  Atomically reserve both users.
8.  Create match record.
9.  Join both sockets to the match room.
10. Send the initial snapshot.
11. Clear queue reservations.

Use a lock or serialized queue operation to avoid pairing one user
twice. For a single-process MVP, a carefully designed in-process
mutex/queue worker can work; document that it is not distributed-safe.

## 9.3 Presence

-   Track active socket IDs per user, not only per socket.
-   A user may have multiple tabs.
-   Treat a user as online while at least one authenticated socket is
    connected.
-   On disconnect, wait a short configurable grace period before
    treating the user as disconnected from an active match.
-   Reconnection should re-authenticate and re-authorize before
    restoring match access.
-   A reconnecting client must receive the latest authoritative match
    snapshot.
-   Never rely on a browser's `beforeunload` event as the only
    disconnect mechanism.

## 9.4 Disconnect policy

Implement a clear policy and display it to players:

-   During an active match, start a configurable reconnect grace period,
    e.g. 30 seconds.
-   If the player reconnects within the grace period, restore the match.
-   If they do not reconnect, mark the match abandoned or award a
    forfeit according to a documented policy.
-   Do not award normal win/loss XP repeatedly.
-   For MVP, choose one consistent forfeit policy and apply it to all
    three games.

For RPS, a disconnected player must not leave a hidden submitted choice
unresolved indefinitely; apply the same timeout and abandonment policy.

------------------------------------------------------------------------

# 10. Frontend UX and UI Specification

## 10.1 Visual direction

Use a premium dark esports aesthetic:

-   Background: near-black / deep navy.
-   Accent colors: electric purple, blue, and restrained cyan.
-   Cards: subtle contrast and borders.
-   Typography: modern sans-serif, strong heading hierarchy.
-   Buttons: clear primary and secondary variants.
-   Use restrained glow effects; avoid excessive gradients and visual
    clutter.
-   Maintain strong contrast and readability.
-   Build responsive layouts for mobile, tablet, and desktop.

The design should feel like a polished gaming product, not a generic
admin dashboard.

## 10.2 Navigation

Primary navigation:

-   Dashboard
-   Play
-   Leaderboard
-   Match History
-   Profile

Show the signed-in player's avatar, level, and XP in the header or
profile menu.

## 10.3 Required screens

### A. Landing page

-   DuelZone logo/name.
-   Short product explanation.
-   Sign up and login actions.
-   Game preview cards.
-   Clear call to action.

### B. Login and registration

-   Email, username where required, password.
-   Field validation and useful errors.
-   Password visibility toggle.
-   Loading and disabled submit states.
-   Link between login and registration.
-   Responsive layout.

### C. Dashboard

-   Welcome message.
-   Player XP, level, and rank.
-   Play now action.
-   Three game cards.
-   Recent match summary.
-   Leaderboard preview.
-   Online/connection status.

### D. Game lobby

-   Selected game title and rules.
-   Quick Match action.
-   Create Private Room action.
-   Join by room code.
-   Matchmaking progress state.
-   Cancel search action.

### E. Waiting room

-   Room code with copy action.
-   Host and opponent slots.
-   Waiting indicator.
-   Cancel/leave action.
-   Instructions for sharing the code.

### F. Match screen

-   Opponent and current player panels.
-   Connection status.
-   Game board or choices.
-   Current turn or round phase.
-   Timer when relevant.
-   In-game chat panel.
-   Exit/forfeit confirmation.
-   Rematch and return-to-lobby controls after completion.

### G. Result screen

-   Winner/draw outcome.
-   Player scores.
-   XP earned.
-   Updated rank/level if changed.
-   Rematch request status.
-   Return to lobby.

### H. Profile

-   Avatar and username.
-   XP progress bar.
-   Level and rank.
-   Win rate and match counts.
-   Per-game breakdown.
-   Recent results.

### I. Leaderboard

-   Ranked player list.
-   Avatar, username, XP, level, rank, wins.
-   Pagination.
-   Highlight current user.
-   Loading, empty, and error states.

### J. Match history

-   Game type.
-   Opponent.
-   Result.
-   Date/time.
-   XP gained.
-   Link to match details if available.
-   Pagination and filters.

## 10.4 UI component reuse

Build reusable components such as:

-   `AppLayout`
-   `Navbar`
-   `Sidebar` if useful for desktop
-   `GameCard`
-   `PlayerCard`
-   `Avatar`
-   `RankBadge`
-   `XpProgress`
-   `MatchmakingStatus`
-   `RoomCodeDisplay`
-   `GameTimer`
-   `ChatPanel`
-   `MatchResultModal`
-   `LoadingState`
-   `ErrorState`
-   `EmptyState`
-   `ConfirmDialog`

Do not duplicate the same layout and state logic in every game.

## 10.5 Frontend state boundaries

-   Authentication state: current user and session.
-   Socket connection state: connected, reconnecting, disconnected.
-   Lobby state: selected game and matchmaking status.
-   Match state: server snapshot and latest version.
-   Chat state: messages for the current match.
-   Profile state: profile and stats.
-   Avoid duplicating server-owned game state in unrelated global
    stores.
-   The client renders the latest authoritative snapshot; it may use
    optimistic UI only if it can safely roll back rejected actions.

------------------------------------------------------------------------

# 11. Security Design

Implement security as part of development, not as a final cosmetic step.

-   Hash passwords with bcrypt or Argon2.
-   Use HTTPS in production.
-   Use secure, HTTP-only, same-site cookies if using cookie
    authentication; implement CSRF protection where required.
-   Restrict CORS to configured frontend origins.
-   Validate all REST bodies, params, query strings, and Socket.io
    payloads.
-   Add rate limits to login, registration, room creation, matchmaking,
    and chat.
-   Enforce authorization on every protected resource.
-   Use safe error messages; do not expose stack traces to clients.
-   Sanitize and normalize usernames.
-   Render chat as plain text.
-   Restrict message length and frequency.
-   Do not trust client timestamps, winner IDs, XP amounts, player IDs,
    or turn ownership.
-   Do not accept arbitrary MongoDB operators from user input.
-   Protect against NoSQL injection by validating and constructing
    queries explicitly.
-   Store secrets in environment variables.
-   Avoid logging credentials, access tokens, private messages, or
    sensitive user data.
-   Use dependency auditing and remove unused dependencies.
-   Add account and socket rate limiting.
-   Consider an origin check for WebSocket handshakes.

------------------------------------------------------------------------

# 12. Error Handling and Edge Cases

Handle at least these cases:

-   Invalid login or duplicate registration.
-   Expired or invalid session.
-   Socket connection failure.
-   User refreshes the page during a match.
-   User opens multiple tabs.
-   User joins a queue twice.
-   User tries to join two matches.
-   Two users attempt to join the same room simultaneously.
-   Room code does not exist or has expired.
-   Room is already full.
-   Player submits a move out of turn.
-   Player submits an invalid move.
-   Player repeats a previous action.
-   Player sends an action after the match has ended.
-   Player disconnects and reconnects.
-   Both players disconnect.
-   Match completion event is retried.
-   Database write fails during match completion.
-   XP ledger entry already exists.
-   Chat message is too long or spammy.
-   Leaderboard is empty.
-   Match history has no records.
-   A client receives an older state version after a newer one.

For stale state, include a monotonically increasing match state version.
Clients should ignore snapshots with a lower version than the latest
applied version.

------------------------------------------------------------------------

# 13. Testing Strategy

Use unit, integration, and end-to-end tests.

## 13.1 Unit tests

### Authentication and validation

-   Password hashing and verification.
-   Username/email validation.
-   Invalid payload rejection.
-   Authorization helper behavior.

### Game engines

Tic-Tac-Toe: - Valid move. - Invalid cell. - Occupied cell. - Wrong
player turn. - Horizontal, vertical, and diagonal wins. - Draw. - Move
after terminal state.

Rock Paper Scissors: - Each winning combination. - Tie. - Invalid
choice. - Hidden choice behavior. - Best-of-five completion. - Duplicate
submission. - Round timeout.

Connect Four: - Valid token drop. - Invalid column. - Full column. -
Horizontal win. - Vertical win. - Both diagonal win directions. -
Draw. - Move after terminal state.

### Progression

-   Win/loss/draw XP.
-   Level calculation.
-   Rank threshold boundaries.
-   Duplicate XP award rejection.
-   Stats update correctness.

## 13.2 Integration tests

-   Register and log in.
-   Access protected endpoint.
-   Create and join private room.
-   Reject third player.
-   Join and cancel matchmaking.
-   Pair two players in same game queue.
-   Prevent duplicate pairing.
-   Submit valid and invalid socket actions.
-   Verify chat authorization.
-   Complete match and persist result.
-   Verify XP and statistics.
-   Fetch leaderboard and history.

## 13.3 End-to-end tests

Use Playwright or an equivalent browser automation tool.

Test with two independent browser contexts:

1.  Register User A and User B.
2.  Log both in.
3.  User A creates a private room.
4.  User B joins.
5.  Play and finish a Tic-Tac-Toe match.
6.  Verify both clients show the same result.
7.  Verify history and XP for both accounts.
8.  Repeat with random matchmaking.
9.  Play RPS and Connect Four.
10. Test disconnect and reconnect.

## 13.4 Manual test checklist

-   [ ] Desktop layout.
-   [ ] Mobile layout.
-   [ ] Keyboard navigation.
-   [ ] Registration and login errors.
-   [ ] Room code copy and join.
-   [ ] Random queue cancellation.
-   [ ] Game move validation.
-   [ ] Opponent disconnect.
-   [ ] Reconnect and state restoration.
-   [ ] Chat authorization and rate limits.
-   [ ] XP and leaderboard consistency.
-   [ ] Match history.
-   [ ] No duplicate rewards.
-   [ ] Refresh during match.

------------------------------------------------------------------------

# 14. Development Roadmap

Build the project in working increments. Do not attempt every feature at
once.

## Phase 0 --- Repository inspection and planning

-   Inspect existing files and tooling.
-   Confirm runtime and package manager.
-   Create or update architecture documents.
-   Define API and socket contracts.
-   Create task checklist and implementation order.
-   Identify environment variables.

**Exit criteria:** Project plan and runnable skeleton are ready.

## Phase 1 --- Foundation and UI shell

-   Scaffold client and server.
-   Configure environment variables.
-   Configure MongoDB connection.
-   Configure Express and health endpoint.
-   Configure React Router and Tailwind.
-   Build shared layout, navbar, landing page, and dashboard shell.
-   Add error and loading patterns.

**Exit criteria:** Client and server run locally; health endpoint
succeeds.

## Phase 2 --- Authentication and profiles

-   Build user model and validation.
-   Register, login, logout, and current-user endpoints.
-   Add secure auth middleware.
-   Build login and registration screens.
-   Build profile screen and editable fields.
-   Add basic player stats initialization.

**Exit criteria:** Two separate users can create accounts and
authenticate.

## Phase 3 --- Socket infrastructure and private rooms

-   Add Socket.io server and client.
-   Authenticate socket connections.
-   Implement room creation and joining.
-   Implement room authorization.
-   Build waiting room and room code copy/join UI.
-   Add room expiry and cancellation.

**Exit criteria:** Two users can join the same private room from
separate browsers.

## Phase 4 --- Tic-Tac-Toe vertical slice

-   Implement pure game engine.
-   Add server-side action validation.
-   Add state versioning.
-   Broadcast authoritative state.
-   Build responsive board and match UI.
-   Implement win/draw and result screen.
-   Persist match result.

**Exit criteria:** A complete 1v1 Tic-Tac-Toe match works across two
browsers.

## Phase 5 --- Random matchmaking

-   Add separate queues for each game.
-   Add duplicate queue prevention.
-   Add atomic pairing behavior.
-   Add cancellation and timeout.
-   Add active-match prevention.
-   Add matchmaking UI.

**Exit criteria:** Two users can be paired randomly for Tic-Tac-Toe
without a room code.

## Phase 6 --- Remaining games

-   Implement RPS engine and simultaneous choice reveal.
-   Implement best-of-five rounds and timers.
-   Implement Connect Four engine and win detection.
-   Reuse match lifecycle, socket gateway, and result UI.
-   Add comprehensive unit tests.

**Exit criteria:** All three games work through private rooms and random
matchmaking.

## Phase 7 --- Progression and social features

-   Implement XP ledger and idempotent rewards.
-   Implement level and rank calculations.
-   Implement player statistics.
-   Implement leaderboard.
-   Implement match history.
-   Implement match chat with authorization and rate limiting.
-   Add rematch flow.

**Exit criteria:** Completed matches update all progression and social
features correctly.

## Phase 8 --- Reliability and security

-   Add disconnect grace period.
-   Add reconnect and authoritative state restoration.
-   Add socket and API rate limits.
-   Review authentication, authorization, CORS, and input validation.
-   Test concurrency and duplicate events.
-   Add structured logging and health checks.

**Exit criteria:** Core edge cases are handled and security review is
complete.

## Phase 9 --- Deployment and documentation

-   Configure production environment variables.
-   Deploy MongoDB, backend, and frontend.
-   Configure CORS and cookie settings.
-   Verify WebSocket connectivity in production.
-   Run end-to-end smoke tests.
-   Write README and architecture documentation.
-   Prepare project demonstration script.

**Exit criteria:** Public deployment works and another person can follow
the setup guide.

------------------------------------------------------------------------

# 15. Environment Variables

Create `.env.example` files. Do not commit actual secrets.

## Server `.env.example`

``` env
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/duelzone
JWT_SECRET=replace_with_long_random_secret
COOKIE_SECRET=replace_with_long_random_secret
SESSION_TTL=...
ROOM_TTL_MINUTES=...
MATCH_RECONNECT_GRACE_SECONDS=30
RPS_ROUND_SECONDS=...
CHAT_MAX_LENGTH=500
```

Adapt variables to the actual authentication implementation. Do not add
unused variables.

## Client `.env.example`

``` env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Only expose values that are safe to include in a browser bundle. Never
place database credentials or signing secrets in client variables.

------------------------------------------------------------------------

# 16. Local Development and Scripts

Provide root-level commands where practical:

``` bash
npm install
npm run dev
npm run build
npm run test
npm run lint
```

The root scripts may use npm workspaces or a documented concurrent
runner.

Also provide individual client/server scripts:

``` bash
# Client
npm run dev
npm run build
npm run preview

# Server
npm run dev
npm start
npm test
```

Document MongoDB setup, environment configuration, and expected local
URLs.

------------------------------------------------------------------------

# 17. Deployment Plan

## Frontend

-   Deploy the client to Vercel or an equivalent static frontend host.
-   Set `VITE_API_BASE_URL` and `VITE_SOCKET_URL`.
-   Ensure SPA route fallback is configured.
-   Verify production HTTPS and WebSocket connectivity.

## Backend

-   Deploy to a host that supports persistent Node.js processes and
    WebSockets.
-   Set production environment variables.
-   Restrict CORS to the deployed frontend origin.
-   Configure health checks.
-   Use secure cookies and proxy settings appropriate to the host.
-   Ensure the process does not rely on local filesystem persistence.

## Database

-   Use MongoDB Atlas or an equivalent managed MongoDB service.
-   Restrict database network access.
-   Use a dedicated database user with least privilege.
-   Configure backups appropriate to the project.
-   Create indexes during deployment or application initialization in a
    controlled way.

## Scaling note

The initial in-memory matchmaking and presence implementation supports a
single backend process only. Before running multiple backend instances,
move queue and presence coordination to Redis and configure the
Socket.io Redis adapter. Do not claim multi-instance matchmaking support
until this is implemented and tested.

------------------------------------------------------------------------

# 18. Documentation Deliverables

The coding agent must create and maintain:

-   `README.md` --- project overview, prerequisites, setup, scripts,
    environment, deployment.
-   `docs/HLD.md` --- architecture, components, data flow, deployment
    topology.
-   `docs/LLD.md` --- modules, models, game state, services, algorithms.
-   `docs/API.md` --- REST endpoints, request/response examples, errors.
-   `docs/SOCKET_EVENTS.md` --- socket events, payload schemas,
    authorization.
-   `docs/TESTING.md` --- test strategy, commands, test cases, results.
-   `docs/SECURITY.md` --- authentication, authorization, validation,
    rate limits, known risks.
-   `docs/DEPLOYMENT.md` --- production configuration and deployment
    steps.
-   `docs/PROJECT_PLAN.md` --- phases, tasks, and completion status.

Keep documentation synchronized with the actual implementation. Do not
document planned features as completed features.

------------------------------------------------------------------------

# 19. Acceptance Criteria

The following are mandatory release checks:

  -----------------------------------------------------------------------
  ID                                  Acceptance criterion
  ----------------------------------- -----------------------------------
  AC-01                               Two users can register and log in
                                      independently.

  AC-02                               Users can create and join a private
                                      room.

  AC-03                               Random matchmaking pairs two
                                      eligible users for the same game.

  AC-04                               All three games are playable end to
                                      end.

  AC-05                               Invalid moves and out-of-turn
                                      actions are rejected server-side.

  AC-06                               Both clients receive consistent
                                      authoritative game state.

  AC-07                               A match result is stored once.

  AC-08                               XP and statistics are updated once
                                      per completed match.

  AC-09                               Leaderboard reflects updated XP and
                                      ranking.

  AC-10                               Match history displays completed
                                      games correctly.

  AC-11                               In-game chat is restricted to match
                                      participants.

  AC-12                               Reconnection restores the current
                                      match state within the grace
                                      period.

  AC-13                               The application is responsive and
                                      has loading/error/empty states.

  AC-14                               Setup, test, and deployment
                                      instructions work.

  AC-15                               No known critical authentication,
                                      authorization, or game-state
                                      integrity issue remains.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 20. Required Coding Agent Workflow

Follow this exact order:

1.  **Inspect:** Examine the repository, package files, existing code,
    and current git state.
2.  **Plan:** Create a task checklist and identify dependencies.
3.  **Design:** Finalize HLD, LLD, database schema, REST API, and
    Socket.io contracts.
4.  **Scaffold:** Create the client/server structure and development
    scripts.
5.  **Build vertical slices:** Complete authentication, then
    private-room Tic-Tac-Toe, then random matchmaking, then the other
    games.
6.  **Integrate:** Add progression, leaderboard, history, chat, and
    rematch.
7.  **Harden:** Add reconnect handling, validation, rate limits,
    concurrency protection, and logging.
8.  **Test:** Run unit, integration, and browser end-to-end tests.
9.  **Document:** Update all project documentation to match the actual
    implementation.
10. **Deploy-ready:** Verify production build and provide deployment
    instructions.

After each phase:

-   Run relevant tests.
-   Run lint/type checks if configured.
-   Fix regressions before proceeding.
-   Update the task checklist.
-   Summarize files changed and commands executed.
-   Identify blockers honestly.

If a requirement is ambiguous, choose the simplest secure implementation
consistent with this document and record the decision in
`docs/PROJECT_DECISIONS.md`. Ask the user only when a decision
materially affects product behavior, security, cost, or irreversible
data changes.

## Final instruction

Build DuelZone as a complete, maintainable, end-to-end application---not
a static UI mockup. Prioritize a working, secure multiplayer vertical
slice over superficial breadth. The server must remain authoritative for
matchmaking, game rules, results, and XP. Every visible feature must
have a working implementation or be clearly marked as not yet
implemented.

At completion, report:

1.  What was implemented.
2.  How to run the project locally.
3.  Required environment variables.
4.  Tests run and their actual results.
5.  Deployment steps.
6.  Known limitations and future improvements.
7.  A checklist mapping the acceptance criteria to implementation and
    tests.
