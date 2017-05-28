
export class TimerEntry {
  handler: () => void;
  delay: number;
  started: number;
  timer: any;
  lastStart: number;

  constructor(handler: () => void, delay: number, started: number) {
    this.handler = handler;
    this.delay = delay;
    this.started = started;
    this.lastStart = started;
  }
}

export class Clock {
  private running = true;
  private timeouts: TimerEntry[] = [];
  private intervals: TimerEntry[] = [];
  private timestamp = 0;
  private lastReference = 0;

  get isRunning(): boolean {
    return this.running;
  }
  now(): number {
    if (this.timestamp) {
      if (this.running) {
        return this.timestamp + Date.now() - this.lastReference;
      } else {
        return this.timestamp;
      }
    } else {
      return Date.now();
    }
  }

  setNow(timestamp: number): void {
    this.timestamp = timestamp;
    this.lastReference = Date.now();
    this.resetIntervals();
    this.processTimeouts();
    this.processIntervals();
  }

  incrementNow(incrementBy: number) {
    // if (this.running) {
    //   throw new Error("You can't increment time when clock is running");
    // }
    this.timestamp = this.now();
    this.timestamp += incrementBy;
    this.lastReference = Date.now();
    this.processTimeouts();
    this.processIntervals();
  }

  reset() {
    delete this.timestamp;
    this.resetIntervals();
    this.running = true;
  }

  private resetIntervals() {
    for (const interval of this.intervals) {
      if (interval.lastStart > clock.now()) {
        interval.lastStart = clock.now();
      }
    }
  }

  setRunning(isRunning: boolean) {
    if (this.running !== isRunning) {
      if (isRunning) {
        for (const timeout of this.timeouts) {
          timeout.timer = setTimeout(() => {
            this.handleTimeout(timeout);
          }, timeout.delay);
        }
        for (const entry of this.intervals) {
          entry.timer = setInterval(() => {
            this.handleInterval(entry);
          }, entry.delay);
        }
      } else {
        this.timestamp = this.now();
        this.lastReference = this.timestamp;
        for (const timeout of this.timeouts) {
          if (timeout.timer) {
            clearTimeout(timeout.timer);
          }
        }
        for (const entry of this.intervals) {
          if (entry.timer) {
            clearInterval(entry.timer);
          }
        }
      }
      this.running = isRunning;
    }
  }

  setTimeout(handler: () => void, delay: number): TimerEntry {
    const entry = new TimerEntry(handler, delay, this.now());
    if (this.running) {
      entry.timer = setTimeout(() => {
        this.handleTimeout(entry);
      }, delay);
    }
    this.timeouts.push(entry);
    return entry;
  }

  clearTimeout(timeout: any) {
    this.timeouts.splice(this.timeouts.indexOf(timeout), 1);
  }

  setInterval(handler: () => void, interval: number): TimerEntry {
    const entry = new TimerEntry(handler, interval, this.now());
    if (this.running) {
      entry.timer = setInterval(() => {
        this.handleInterval(entry);
      }, interval);
    }
    this.intervals.push(entry);
    return entry;
  }

  clearInterval(entry: TimerEntry) {
    this.intervals.splice(this.intervals.indexOf(entry), 1);
  }

  private processTimeouts() {
    const toProcess: TimerEntry[] = [];
    for (const timeout of this.timeouts) {
      if (this.now() < timeout.started || this.now() - timeout.started > timeout.delay) {
        toProcess.push(timeout);
      }
    }
    for (const item of toProcess) {
      this.handleTimeout(item);
    }
  }

  private processIntervals() {
    const toProcess: TimerEntry[] = [];
    for (const entry of this.intervals) {
      if (this.now() - entry.lastStart > entry.delay) {
        toProcess.push(entry);
      }
    }
    console.log("Clock.processIntervals " + toProcess.length);
    for (const item of toProcess) {
      this.handleInterval(item);
    }
  }

  private handleTimeout(timeout: TimerEntry) {
    const index = this.timeouts.indexOf(timeout);
    if (index >= 0) {
      this.timeouts.splice(index, 1);
      timeout.handler();
    }
  }

  private handleInterval(interval: TimerEntry) {
    const index = this.intervals.indexOf(interval);
    if (index >= 0) {
      interval.lastStart = this.now();
      interval.handler();
    }
  }
}

const clock = new Clock();
export { clock };
