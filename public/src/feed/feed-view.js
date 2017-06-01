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
    } else {
      $service.getFeed().then((response) => {
        this.set("items", response.items || []);
        console.log('Feed items: ', this.items);
      }).catch((err) => {
        console.error("Error fetching feed: ", err);
      });
    }
  }

  createDummyItems() {
    var items = [];
    for (var i = 0; i < 3; i++) {
      items.push({
        serviceId: "dummy"
      });
    }
    this.set("items", items);
  }
}

window.customElements.define(FeedView.is, FeedView);