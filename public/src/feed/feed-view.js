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
      this.set("items", []);
      this.$.loading.style.display = "";
      $service.getFeed().then((response) => {
        this.$.loading.style.display = "none";
        this.set("items", response.items || []);
        this.$.none.style.display = this.items.length ? "none" : "";
      }).catch((err) => {
        this.$.loading.style.display = "none";
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