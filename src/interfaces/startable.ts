import { Context } from "./context";

export interface Startable {
  start(context: Context): Promise<void>;
}
