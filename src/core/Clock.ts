const timeElement = document.getElementById("time") as HTMLDivElement;

export class Clock {
  private time: number;

  constructor() {
    this.time = 6;
  }

  tick() {
    this.time = this.time + 1;
  }

  isNight() {
    return !this.isDay();
  }

  isDay() {
    return this.time % 24 >= 6 && this.time % 24 < 18;
  }

  toString() {
    // should display the time in 24 hour format
    const hours = this.time % 24;
    const minutes = 0;
    const hoursString = hours.toString().padStart(2, "0");
    const minutesString = minutes.toString().padStart(2, "0");
    return `${hoursString}:${minutesString} ${this.isDay() ? "(day)" : "(night)"}`;
  }

  render() {
    timeElement.textContent = this.toString();
  }
}
