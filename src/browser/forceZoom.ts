/**
 * "Force zoom": lets the user pinch-zoom pages that turn zooming off in their viewport tag
 * (user-scalable=no, maximum-scale=1), like Chrome's accessibility option.
 */
export const FORCE_ZOOM_SCRIPT = `(function () {
  var tags = document.querySelectorAll('meta[name="viewport"]');
  for (var i = 0; i < tags.length; i++) {
    var parts = (tags[i].getAttribute('content') || '').split(',').map(function (p) { return p.trim(); })
      .filter(function (p) { return p && !/^(maximum-scale|minimum-scale|user-scalable)\\s*=/i.test(p); });
    parts.push('user-scalable=yes', 'maximum-scale=10');
    tags[i].setAttribute('content', parts.join(', '));
  }
})(); true;`;
