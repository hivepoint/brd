import { Context } from "./context";

export interface Initializable {
  initialize(context: Context): Promise<void>;
}
