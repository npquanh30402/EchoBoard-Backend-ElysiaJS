import { Queue } from "queue-typed";

export class CustomQueue extends Queue {
  constructor() {
    super();
  }

  process(callback: (arg0: any) => void) {
    while (!this.isEmpty()) {
      const item = this.shift();
      callback(item);
    }
  }
}
