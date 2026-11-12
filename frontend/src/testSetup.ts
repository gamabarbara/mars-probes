// jsdom exposes HTMLDialogElement but does not implement its modal methods.
HTMLDialogElement.prototype.showModal ??= function () {
  this.open = true;
};

HTMLDialogElement.prototype.close ??= function () {
  this.open = false;
};
