
import { Context } from "./interfaces/context";
import { Request, Response } from 'express';
import { v4 as uuid } from 'node-uuid';
import { users, User } from "./db";
import { clock } from "./utils/clock";

const USERID_COOKIE_NAME = 'braid-user-id';

export class UserManager {

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

  async onWebsocketEvent(context: Context, ws: any, request: Request): Promise<void> {
    const userId = request.cookies[USERID_COOKIE_NAME];
    if (userId) {
      context.user = await users.findById(context, userId);
    }
  }
}

const userManager = new UserManager();

export { userManager };
