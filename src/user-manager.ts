
import { Context } from "./interfaces/context";
import { Request, Response } from 'express';
import { v4 as uuid } from 'node-uuid';
import { users, User } from "./db";
import { clock } from "./utils/clock";
import WebSocket = require('ws');

const USERID_COOKIE_NAME = 'braid-user-id';

export interface UserSignoutHandler {
  onUserSignedOut(context: Context, userId: string): Promise<void>;
}
export class UserManager {
  private signoutHandlers: UserSignoutHandler[] = [];

  registerSignoutHandler(context: Context, handler: UserSignoutHandler): void {
    this.signoutHandlers.push(handler);
  }
  async initializeHttpContext(context: Context, request: Request, response: Response): Promise<void> {
    const userId = request.cookies[USERID_COOKIE_NAME];
    if (userId) {
      context.user = await users.findById(context, userId);
    }
  }
  async getOrCreateUser(context: Context, request: Request, response: Response): Promise<User> {
    if (context.user) {
      return context.user;
    }
    const userId = 'u-' + uuid();
    context.user = await users.upsertRecord(context, userId);
    this.setUserCookie(context, userId, request, response);
    return context.user;
  }

  private setUserCookie(context: Context, userId: string, request: Request, response: Response): void {
    if (request.cookies[USERID_COOKIE_NAME] !== userId) {
      response.cookie(USERID_COOKIE_NAME, userId, {
        maxAge: 86400000000
      });
    }
  }

  async updateCaughtUp(context: Context): Promise<void> {
    if (context.user) {
      await users.updateCaughtUp(context, context.user, clock.now());
    }
  }

  async onWebsocketEvent(context: Context, ws: WebSocket, request: Request): Promise<void> {
    const extensions = ws.extensions as any;
    if (extensions.braidUserId) {
      context.user = await users.findById(context, extensions.braidUserId);
    }
  }
  async onWebsocketOpenRequest(context: Context, ws: WebSocket, userId: string): Promise<void> {
    const extensions = ws.extensions as any;
    context.user = await users.findById(context, userId);
    if (context.user) {
      extensions.braidUserId = context.user.id;
    }
  }

  async onSignout(context: Context, request: Request, response: Response): Promise<void> {
    response.clearCookie(USERID_COOKIE_NAME);
    if (context.user) {
      const userId = context.user.id;
      await users.delete(context, userId);
      for (const handler of this.signoutHandlers) {
        await handler.onUserSignedOut(context, userId);
      }
    }
  }
}

const userManager = new UserManager();

export { userManager };
