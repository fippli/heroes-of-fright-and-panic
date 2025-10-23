export class Clock {
  time: number;

  constructor() {
    this.time = 6;
  }

  tick() {
    this.time = this.time + 1;
  }

  isNight() {
    return this.time % 24 >= 18 || this.time % 24 < 6;
  }

  isDay() {
    return this.time % 24 >= 6 && this.time % 24 < 18;
  }
}
