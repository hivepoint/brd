class BraidApp extends Polymer.Element {
  static get is() { return 'braid-app'; }

  static get properties() {
    return {
      providers: Array,
      sIcon: {
        type: String,
        value: 'braid:search'
      }
    }
  }

  constructor() {
    super();
    this.pageMap = {
      feed: 'feed/feed-view.html',
      search: 'search/search-view.html'
    };
  }

  connectedCallback() {
    super.connectedCallback();
    window.$service = this.$.service;
    window.addEventListener("resize", () => {
      this.needsLayout();
    });
    Polymer.RenderStatus.beforeNextRender(this, () => {
      this.refreshLayout();
    });

    this.refreshServices();
  }

  onScroll() {
    this.refreshScrollPosition();
  }

  needsLayout() {
    if (this.layoutPending) {
      return;
    }
    if (this.layoutDebouncing) {
      this.layoutPending = true;
      return;
    }
    this.refreshLayout();
    this.layoutDebouncing = true;
    setTimeout(() => {
      this.layoutDebouncing = false;
      if (this.layoutPending) {
        this.refreshLayout();
      }
      this.layoutPending = false;
    }, 600);
  }

  refreshLayout() {
    this.$.topBuffer.style.height = this.$.toolbar.offsetHeight + "px";
    this.closeMenu();
    this.refreshScrollPosition();
  }

  refreshScrollPosition() {
    var offsetHeight = this.$.toolbarSubContent.offsetHeight || 0;
    var ht = Math.max(offsetHeight - this.$.scrollPanel.scrollTop, 0);
    if (this._prevBarHeight != ht) {
      this.$.toolbarSub.style.height = ht + "px";
      this.$.toolbarSub.style.opacity = ht / offsetHeight;
      this._prevBarHeight = ht;
    }
    var bshadow = this.$.scrollPanel.scrollTop > 5;
    if (this.bshadow != bshadow) {
      this.$.toolbar.style.boxShadow = bshadow ? "0 3px 5px -1px rgba(0, 0, 0, 0.4)" : "none";
      this.bshadow = bshadow;
    }
  }

  showMenu() {
    this.$.glass.style.display = "";
    this.$.rightDrawer.style.right = 0;
  }

  closeMenu() {
    this.$.glass.style.display = "none";
    this.$.rightDrawer.style.right = "";
  }

  refreshServices() {
    $service.getServices().then((response) => {
      this.set("providers", response.providers)
      $service.providers = response.providers;
      Polymer.importHref(this.resolveUrl('provider/provider-panel.html'), () => {
        this.$.drawerContentPanel.style.opacity = 1;
      }, () => {
        this.$.drawerContentPanel.style.opacity = 1;
      });

      var hasAccounts = false;
      if (response.providers && response.providers.length) {
        for (var i = 0; i < response.providers.length; i++) {
          if (response.providers[i].accounts && response.providers[i].accounts.length) {
            hasAccounts = true;
            break;
          }
        }
      }

      this.$.signoutPanel.style.display = hasAccounts ? "" : "none";
      this.$.watermark.style.display = hasAccounts ? "none" : "";
      this.$.btnSearch.style.display = hasAccounts ? "" : "none";
      this.hasAccounts = hasAccounts;
      this._feed();
    }).catch((err) => {
      console.error(err);
    });
  }

  _feed() {
    this.gotoPage("feed", () => {
      this.$.feedView.refresh(!this.hasAccounts);
    });
  }

  _search(text) {
    this.set('sIcon', 'braid:clear');
    this.gotoPage("search", () => {
      this.$.searchView.search(text);
    });
  }

  onSearchInput() {
    this.set('sIcon', 'braid:search');
  }

  onSearchKeydown(event) {
    if (event.keyCode === 13) {
      setTimeout(() => {
        var txt = (this.$.txtSearch.value || "").trim();
        if (txt) {
          this._search(txt);
        }
      }, 10);
    }
  }

  gotoPage(hash, callback) {
    this.activePage = hash;
    this.$.feedView.style.display = "none";
    this.$.searchView.style.display = "none";
    switch (hash) {
      case "feed":
        this.$.feedView.style.display = "";
        break;
      case "search":
        this.$.searchView.style.display = "";
        break;
      default:
        break;
    }

    var url = this.pageMap[hash];
    if (url) {
      Polymer.importHref(this.resolveUrl(url), () => {
        callback();
      });
    } else {
      callback();
    }
  }

  onSearch() {
    if (this.searchMode) {
      var clear = this.sIcon == "braid:clear";
      if (!clear) {
        var txt = (this.$.txtSearch.value || "").trim();
        if (txt) {
          this._search(txt);
        } else {
          clear = true;
        }
      }

      if (clear) {
        this.set('sIcon', "braid:search");
        this.$.txtSearch.value = "";
        this._setSearchMode(false);
        if (this.activePage === "search") {
          this._feed();
        }
      }
    } else {
      this._setSearchMode(true);
    }
  }

  _setSearchMode(searchMode) {
    this.searchMode = searchMode;
    if (searchMode) {
      this.$.barBuffer.style.display = "none";
      this.$.searchTextPanel.style.display = "";
      this.$.btnSearch.style.background = "white";
      this.$.searchIcon.style.color = "#000";
      setTimeout(() => {
        this.$.txtSearch.focus();
        this.$.txtSearch.style.padding = "0 0 0 8px";
        this.$.txtSearch.style.width = "100%";
      }, 50);
    } else {
      this.$.txtSearch.style.padding = "0px";
      this.$.txtSearch.style.width = "0%";
      setTimeout(() => {
        this.$.barBuffer.style.display = "";
        this.$.searchTextPanel.style.display = "none";
        this.$.btnSearch.style.background = "";
        this.$.searchIcon.style.color = "";
      }, 500);
    }
  }

  signOut() {
    $service.signOut().then(() => {
      this.refreshServices();
    }).catch(() => {
      this.refreshServices();
    });
  }

}

window.customElements.define(BraidApp.is, BraidApp);