const dialogElement = document.querySelector(
  ".dialog-wrapper",
) as HTMLDivElement;

const dialogCloseButton = document.querySelector(
  "#close-dialog",
) as HTMLButtonElement;

const dialogTitle = document.querySelector(
  "#dialog-title",
) as HTMLHeadingElement;

const dialogText = document.querySelector(
  "#dialog-text",
) as HTMLParagraphElement;

export class Dialog {
  constructor() {
    dialogCloseButton.addEventListener("click", () => this.close());
  }

  open({ title, content }: { title: string; content: string }) {
    dialogElement.style.display = "flex";
    dialogTitle.textContent = title;
    dialogText.textContent = content;
  }

  close() {
    dialogElement.style.display = "none";
    dialogTitle.textContent = "";
    dialogText.textContent = "";
  }
}
