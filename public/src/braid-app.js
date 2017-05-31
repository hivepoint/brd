class BraidApp extends Polymer.Element {
  static get is() { return 'braid-app'; }

  connectedCallback() {
    super.connectedCallback();
    window.$service = this.$.service;
    window.addEventListener("resize", () => {
      this.needsLayout();
    });
    Polymer.RenderStatus.beforeNextRender(this, () => {
      this.refreshLayout();
    });
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
  }

  showMenu() {
    this.$.glass.style.display = "";
    this.$.rightDrawer.style.right = 0;
  }

  closeMenu() {
    this.$.glass.style.display = "none";
    this.$.rightDrawer.style.right = "";
  }
}

window.customElements.define(BraidApp.is, BraidApp);