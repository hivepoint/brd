class BraidApp extends Polymer.Element {
  static get is() { return 'braid-app'; }

  static get properties() {
    return {
      providers: Array
    }
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
      console.log("services", response);
      this.set("providers", response.providers)
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

      Polymer.importHref(this.resolveUrl('feed/feed-view.html'), () => {
        this.$.watermark.style.display = hasAccounts ? "none" : "";
        this.$.feed.refresh(!hasAccounts);
      });
    }).catch((err) => {
      console.error(err);
    });
  }
}

window.customElements.define(BraidApp.is, BraidApp);