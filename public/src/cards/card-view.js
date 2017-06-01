class CardView extends Polymer.Element {
  static get is() { return 'card-view'; }

  static get properties() {
    return {
      data: {
        type: Object,
        observer: 'onData'
      }
    };
  }

  constructor() {
    super();
    this.cardMap = {
      "dummy": { node: "dummy-card", path: "dummy/dummy-card.html" }
    };
  }

  clearCard() {
    var node = this.$.container;
    while (node.hasChildNodes()) {
      node.removeChild(node.lastChild);
    }
  }

  onData() {
    this.clearCard();
    if (this.data) {
      var cardInfo = this.cardMap[this.data.cardType];
      if (cardInfo) {
        var el = document.createElement(cardInfo.node);
        Polymer.importHref(this.resolveUrl(cardInfo.path), () => {
          this.$.container.appendChild(el);
        });
      }
    }
  }
}

window.customElements.define(CardView.is, CardView);