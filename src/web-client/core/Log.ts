export class Log {
  messages: string[] = [];

  add(message: string) {
    this.messages.push(message);
    this.render();
  }

  render() {
    const logElement = document.getElementById("log") as HTMLUListElement;

    logElement.innerHTML = "";

    this.messages.forEach((message) => {
      const li = document.createElement("li");
      li.textContent = message;
      logElement.appendChild(li);
    });
  }
}
