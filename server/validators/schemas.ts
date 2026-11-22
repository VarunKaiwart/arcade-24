import { z } from 'zod';
import { VALID_AVATAR_IDS } from '../../shared/avatars.ts';

export const gameTypeSchema = z.enum(['TICTACTOE', 'RPS', 'CONNECT_FOUR']);

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username may only contain letters, numbers, underscores, and hyphens');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please enter a valid email address')
  .max(120, 'Email address is too long');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be at most 100 characters')
  .regex(/[A-Za-z]/, 'Password must include at least one letter')
  .regex(/[0-9]/, 'Password must include at least one number');

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  avatar: z
    .string()
    .refine((val) => VALID_AVATAR_IDS.has(val), 'Invalid avatar selection')
    .optional(),
});

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Email or username is required')
    .max(120, 'Identifier is too long'),
  password: z.string().min(1, 'Password is required').max(100, 'Password is too long'),
});

export const updateProfileSchema = z
  .object({
    username: usernameSchema.optional(),
    avatar: z
      .string()
      .refine((val) => VALID_AVATAR_IDS.has(val), 'Invalid avatar selection')
      .optional(),
    bio: z.string().trim().max(160, 'Bio must be at most 160 characters').optional(),
  })
  .refine(
    (data) => data.username !== undefined || data.avatar !== undefined || data.bio !== undefined,
    'At least one field must be provided'
  );

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(100),
  newPassword: passwordSchema,
});

export const createRoomSchema = z.object({
  gameType: gameTypeSchema,
});

export const joinRoomSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,10}$/, 'Room code must be 6–10 alphanumeric characters'),
});

export const cancelRoomSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required').max(80).optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,10}$/)
    .optional(),
});

export const matchmakingJoinSchema = z.object({
  gameType: gameTypeSchema,
});

export const matchmakingCancelSchema = z.object({
  gameType: gameTypeSchema.optional(),
});

export const gameActionPayloadSchema = z.object({
  matchId: z.string().min(1).max(80),
  actionId: z.string().min(1).max(100),
  action: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('PLACE_MARK'),
      index: z.number().int().min(0).max(8),
    }),
    z.object({
      type: z.literal('SUBMIT_CHOICE'),
      choice: z.enum(['ROCK', 'PAPER', 'SCISSORS']),
    }),
    z.object({
      type: z.literal('DROP_TOKEN'),
      column: z.number().int().min(0).max(6),
    }),
  ]),
});

export const rematchRequestSchema = z.object({
  matchId: z.string().min(1).max(80),
});

export const forfeitMatchSchema = z.object({
  matchId: z.string().min(1).max(80),
});

export const reconnectMatchSchema = z.object({
  matchId: z.string().min(1).max(80),
  lastKnownVersion: z.number().int().min(0).optional(),
});

export function createChatSendSchema(maxLength: number) {
  return z.object({
    matchId: z.string().min(1).max(80),
    message: z
      .string()
      .trim()
      .min(1, 'Message cannot be empty')
      .max(maxLength, `Message must be at most ${maxLength} characters`),
  });
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  gameType: z.enum(['ALL', 'TICTACTOE', 'RPS', 'CONNECT_FOUR']).optional().default('ALL'),
  outcome: z.enum(['ALL', 'WIN', 'LOSS', 'DRAW']).optional().default('ALL'),
});

export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0];
  return first ? first.message : 'Invalid input payload';
}
