class HomePage extends Polymer.Element {
  static get is() { return "home-page"; }

  static get properties() {
    return {
      errorMessage: {
        type: String,
        observer: 'onErrorMessage'
      },
      progressMessage: String
    };
  }

  connectedCallback() {
    super.connectedCallback();
    window.$service = this.$.service;
  }

  onSubmit() {
    this.clearError();
    const email = (this.$.txtEmail.value || "").trim();
    if (email) {
      this.set("progressMessage", "Adding your address...");
      this.$.submiting.style.display = "";
      $service.addToWaitingList(email).then(() => {
        this.set("progressMessage", "Thanks for your interest!");
      }).catch((err) => {
        this.$.submiting.style.display = "none";
        this.set("errorMessage", err.message || err);
      });
    }
  }

  clearError() {
    this.set("errorMessage", "");
  }

  onErrorMessage() {
    this.$.error.style.opacity = this.errorMessage ? 1 : 0;
  }
}
window.customElements.define(HomePage.is, HomePage);