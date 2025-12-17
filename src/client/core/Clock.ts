const timeElement = document.getElementById("time") as HTMLDivElement;
const turnElement = document.getElementById("turn") as HTMLDivElement;

/**
 * Clock - Client-side display-only clock
 * Time is managed by the server, this just displays it
 */
export class Clock {
  private time: number;

  constructor(initialTime: number = 6) {
    this.time = initialTime;
  }

  isNight(): boolean {
    return !this.isDay();
  }

  isDay(): boolean {
    return this.time % 24 >= 6 && this.time % 24 < 18;
  }

  toString(): string {
    const hours = this.time % 24;
    const hoursString = hours.toString().padStart(2, "0");
    return `${hoursString}:00 ${this.isDay() ? "(day)" : "(night)"}`;
  }

  render(currentPlayer?: "day" | "night", myPlayer?: "day" | "night"): void {
    if (timeElement) {
      timeElement.textContent = this.toString();
    }

    if (turnElement && currentPlayer) {
      const isMyTurn = myPlayer ? currentPlayer === myPlayer : false;
      turnElement.textContent = isMyTurn
        ? "It's your turn!"
        : `${currentPlayer.toUpperCase()} player's turn`;
    }
  }
}
