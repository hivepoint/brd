class EmailCard extends Polymer.Element {
  static get is() { return 'email-card'; }
  static get properties() {
    return {
      data: {
        type: Object,
        observer: 'onData'
      },
      fromDisplay: String,
      toDisplay: String
    };
  }
  onData() {
    if (this.data) {
      // set From
      if (this._isMe(this.data.details.from.address)) {
        this.set("fromDisplay", "Me");
      } else {
        this.set("fromDisplay", this.data.details.from.name);
      }

      // set To
      var toYou = false;
      var toList = [];
      if (this.data.details.to) {
        for (var to of this.data.details.to) {
          if (this._isMe(to.address)) {
            toYou = true;
          } else {
            toList.push(to.name || to.address.toLowerCase());
          }
        }
      }
      if (this.data.details.cc) {
        for (var cc of this.data.details.cc) {
          if (this._isMe(cc.address)) {
            toYou = true;
          } else {
            toList.push(cc.name || cc.address.toLowerCase());
          }
        }
      }
      var toDisplay = "To ";
      if (toYou) {
        toDisplay += "you";
        if (toList.length) {
          if (toList.length == 2) {
            toDisplay += ", 2 others";
          } else {
            toDisplay += ", " + toList[0];
            if (toList.length > 2) {
              toDisplay += ", " + (toList.length - 1) + " others";
            }
          }
        }
      } else {
        switch (toList.length) {
          case 0:
            toDisplay = "";
            break;
          case 1:
            toDisplay += toList[0];
            break;
          default:
            toDisplay += toList.length + " others";
            break;
        }
      }
      this.set("toDisplay", toDisplay);
    }
  }

  _isMe(address) {
    if ($service.providers && this.data) {
      for (var i = 0; i < $service.providers.length; i++) {
        var p = $service.providers[i];
        if (p.descriptor.id === this.data.providerId) {
          for (var j = 0; j < p.accounts.length; j++) {
            var email = p.accounts[j].profile.accountName.toLowerCase();
            if (email === address.toLowerCase()) {
              return true;
            }
          }
          break;
        }
      }
    }
    return false;
  }
}
window.customElements.define(EmailCard.is, EmailCard);