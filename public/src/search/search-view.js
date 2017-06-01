class SearchView extends Polymer.Element {
  static get is() { return 'search-view'; }

  static get properties() {
    return {
      data: {
        type: Object,
        observer: 'onData'
      },
      items: Array
    };
  }

  search(query) {
    $service.search(query).then((response) => {
      this.set("data", response);
    }).catch((err) => {
      console.error("Error searching: ", err);
    });
  }

  onData() {
    var items = [];
    if (this.data && this.data.serviceResults) {
      for (var result of this.data.serviceResults) {
        if (result.searchResults && result.searchResults.matches && result.searchResults.matches.length) {
          for (var m of result.searchResults.matches) {
            items.push(m);
          }
        }
      }
    }
    items.sort((a, b) => {
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
    this.set("items", items);
  }
}

window.customElements.define(SearchView.is, SearchView);