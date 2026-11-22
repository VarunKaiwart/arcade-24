import type { ChatMessageDto } from '../../shared/types.ts';
import type { AppConfig } from '../config/env.ts';
import type { DuelZoneDatabase } from '../repositories/database.ts';
import { generateId } from '../utils/crypto.ts';
import { AppError } from '../utils/errors.ts';
import { SlidingWindowLimiter } from '../utils/rateLimiter.ts';

interface ChatRow {
  id: string;
  match_id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string;
  message: string;
  created_at: string;
}

function mapChatRow(row: ChatRow): ChatMessageDto {
  return {
    id: row.id,
    matchId: row.match_id,
    senderId: row.sender_id,
    senderUsername: row.sender_username,
    senderAvatar: row.sender_avatar,
    message: row.message,
    createdAt: row.created_at,
  };
}

export class ChatService {
  private readonly database: DuelZoneDatabase;
  private readonly config: AppConfig;
  // Max 6 messages per 10 seconds per user (FR-CHAT-05)
  private readonly limiter = new SlidingWindowLimiter(6, 10_000);

  constructor(database: DuelZoneDatabase, config: AppConfig) {
    this.database = database;
    this.config = config;
  }

  private assertParticipant(matchId: string, userId: string): void {
    const match = this.database.db
      .prepare('SELECT player1_user_id, player2_user_id FROM matches WHERE id = ?')
      .get(matchId) as { player1_user_id: string; player2_user_id: string } | undefined;

    if (!match) {
      throw new AppError(404, 'MATCH_NOT_FOUND', 'Match not found.');
    }
    if (match.player1_user_id !== userId && match.player2_user_id !== userId) {
      throw new AppError(403, 'FORBIDDEN_MATCH_CHAT', 'Only participants of this match can access its chat.');
    }
  }

  public sendMessage(params: {
    matchId: string;
    senderId: string;
    senderUsername: string;
    senderAvatar: string;
    message: string;
  }): ChatMessageDto {
    this.assertParticipant(params.matchId, params.senderId);

    const rate = this.limiter.consume(`${params.matchId}:${params.senderId}`);
    if (!rate.allowed) {
      throw new AppError(429, 'CHAT_RATE_LIMITED', 'You are sending messages too fast. Please slow down.');
    }

    const trimmed = params.message.trim();
    if (!trimmed) {
      throw new AppError(400, 'EMPTY_MESSAGE', 'Message cannot be empty.');
    }
    if (trimmed.length > this.config.chatMaxLength) {
      throw new AppError(
        400,
        'MESSAGE_TOO_LONG',
        `Message cannot exceed ${this.config.chatMaxLength} characters.`
      );
    }

    const id = generateId();
    const now = new Date().toISOString();

    this.database.db
      .prepare(
        `INSERT INTO chat_messages (id, match_id, sender_id, sender_username, sender_avatar, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, params.matchId, params.senderId, params.senderUsername, params.senderAvatar, trimmed, now);

    return {
      id,
      matchId: params.matchId,
      senderId: params.senderId,
      senderUsername: params.senderUsername,
      senderAvatar: params.senderAvatar,
      message: trimmed,
      createdAt: now,
    };
  }

  public getMatchMessages(matchId: string, requesterUserId: string, limit = 100): ChatMessageDto[] {
    this.assertParticipant(matchId, requesterUserId);

    const rows = this.database.db
      .prepare(
        `SELECT id, match_id, sender_id, sender_username, sender_avatar, message, created_at
         FROM chat_messages
         WHERE match_id = ?
         ORDER BY created_at ASC
         LIMIT ?`
      )
      .all(matchId, limit) as ChatRow[];

    return rows.map(mapChatRow);
  }
}
