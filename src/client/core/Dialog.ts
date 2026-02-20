export class Dialog {
  private readonly dialogElement: HTMLDivElement;
  private readonly dialogTitle: HTMLHeadingElement;
  private readonly dialogText: HTMLParagraphElement;

  constructor() {
    this.dialogElement = document.querySelector(
      ".dialog-wrapper",
    ) as HTMLDivElement;

    this.dialogTitle = document.querySelector(
      "#dialog-title",
    ) as HTMLHeadingElement;

    this.dialogText = document.querySelector(
      "#dialog-text",
    ) as HTMLParagraphElement;

    const dialogCloseButton = document.querySelector(
      "#close-dialog",
    ) as HTMLButtonElement;

    dialogCloseButton.addEventListener("click", () => this.close());
  }

  open({ title, content }: { title: string; content: string }) {
    this.dialogElement.style.display = "flex";
    this.dialogTitle.textContent = title;
    this.dialogText.textContent = content;
  }

  close() {
    this.dialogElement.style.display = "none";
    this.dialogTitle.textContent = "";
    this.dialogText.textContent = "";
  }
}
