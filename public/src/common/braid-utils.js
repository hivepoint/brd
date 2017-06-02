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
}

window.$utils = new BraidUtils();