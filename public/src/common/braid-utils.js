class BraidUtils {
  friendlyTime(time) {
    return moment(time).calendar(null, {
      sameDay: 'h:mm a',
      nextDay: '[Tomorrow]',
      nextWeek: 'dddd',
      lastWeek: '[Last] dddd',
      sameElse: 'M/D/YYYY'
    });
  }

  unescapeHtml(input) {
    var txt = document.createElement("textarea");
    txt.innerHTML = input;
    return txt.value;
  }
}

window.$utils = new BraidUtils();