import { connect } from "mongoose";

export default class MongoOperator {
  private static instance?: MongoOperator;
  static getInstance = () => this.instance || (this.instance = new this());

  private constructor() {
    connect(process.env.MONGODB_URI ?? "").catch((error) =>
      console.error(error)
    );
  }
}
