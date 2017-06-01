class ProviderPanel extends Polymer.Element {
  static get is() { return "provider-panel"; }

  static get properties() {
    return {
      data: {
        type: Object,
        observer: 'onData'
      },
      accountCount: String,
      linkText: String,
      linkUrl: String,
      accountChevron: String
    };
  }

  onData() {
    if (this.data) {
      var ac = this.data.accounts.length || 0;
      switch (ac) {
        case 0:
          this.set("accountCount", "No linked accounts");
          break;
        case 1:
          this.set("accountCount", "1 linked account");
          break;
        default:
          this.set("accountCount", ac + " linked accounts");
          break;
      }
      this.set("linkText", ac > 0 ? "Link another account" : "Link account");
      this.set("linkUrl", $service.createProviderLinkUrl(this.data.descriptor));
      this.$.accountLabel.style.display = ac ? "" : "none";
      this.hideAccounts();
    }
  }

  toggleAccounts() {
    if (!this.accountsVisible) {
      this.showAccounts();
    } else {
      this.hideAccounts();
    }
  }

  showAccounts() {
    this.$.accountsPanel.style.height = this.$.accountsContent.offsetHeight + "px";
    this.set("accountChevron", "▼");
    this.accountsVisible = true;
  }

  hideAccounts() {
    this.$.accountsPanel.style.height = "0px";
    this.set("accountChevron", "▶");
    this.accountsVisible = false;
  }
}
window.customElements.define(ProviderPanel.is, ProviderPanel);