class FeedView extends Polymer.Element {
  static get is() { return 'feed-view'; }

  static get properties() {
    return {
      items: Array
    };
  }

  refresh(dummy = false) {
    if (dummy) {
      this.createDummyItems();
    }
  }

  createDummyItems() {
    var items = [];
    for (var i = 0; i < 3; i++) {
      items.push({
        cardType: "dummy"
      });
    }
    this.set("items", items);
  }
}

window.customElements.define(FeedView.is, FeedView);