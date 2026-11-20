/**
 * Page commands for run_script (docs/page-customisation.md › Scripts), added to the page script's commands by the
 * installer (browser/agentScript.ts), once per document:
 *
 * - scriptFacts(): what makes the page sensitive (a password, one-time code or payment card field in the main frame).
 * - scriptSnapshot(max): the copy a read-only script runs on: the main frame's DOM without scripts, inline handlers,
 *   meta, base, frames, objects and embeds; field values copied in except secret ones (password, hidden, one-time
 *   code, payment card); elements the page hides marked `hidden`; links and images made absolute; same-site CSS
 *   inlined. Returns { head, body, title, cut } (body cut at `max` characters).
 *
 * ES5, as the page script.
 */
export const SCRIPT_PAGE_SCRIPT = String.raw`
(function () {
  var agent = __qutaiAgent;
  if (!agent || agent.scriptFacts) return;
  var OTP_WORDS = /otp|2fa|totp|mfa|one.?time|verification|verify|security.?code|sms.?code|auth.?code|dogrulama|doğrulama|onay.?kodu|tek.?kullanım/i;
  var CARD_WORDS = /card.?number|cardnumber|cc.?num|cvc|cvv|csc|security.?code|expir|iban|kart.?no|kart.?numara/i;

  function attrs(el) {
    return [el.name, el.id, el.getAttribute('aria-label'), el.getAttribute('placeholder')].join(' ');
  }
  function labelText(el) {
    var text = '';
    try { if (el.labels) for (var i = 0; i < el.labels.length; i++) text += ' ' + el.labels[i].textContent; } catch (e) {}
    return text;
  }
  function isOneTimeCode(el) {
    if (el.tagName !== 'INPUT') return false;
    var ac = String(el.getAttribute('autocomplete') || '').toLowerCase();
    if (ac.indexOf('one-time-code') >= 0) return true;
    var words = attrs(el) + labelText(el);
    if (!OTP_WORDS.test(words)) return false;
    var max = Number(el.getAttribute('maxlength') || 0);
    var mode = String(el.getAttribute('inputmode') || '').toLowerCase();
    return el.type === 'tel' || el.type === 'number' || mode === 'numeric' || (max > 0 && max <= 10) || /otp|2fa|totp|one.?time/i.test(words);
  }
  function isCard(el) {
    var ac = String(el.getAttribute('autocomplete') || '').toLowerCase();
    if (ac.indexOf('cc-') === 0) return true;
    return CARD_WORDS.test(attrs(el)) && !/search|coupon|gift/i.test(attrs(el));
  }
  function isSecret(el) {
    if (el.tagName === 'INPUT' && (el.type === 'password' || el.type === 'hidden')) return true;
    return isOneTimeCode(el) || isCard(el);
  }

  function scriptFacts() {
    var fields = document.querySelectorAll('input');
    var facts = { password: false, oneTimeCode: false, card: false };
    for (var i = 0; i < fields.length && i < 2000; i++) {
      var f = fields[i];
      if (f.type === 'password') facts.password = true;
      else if (isOneTimeCode(f)) facts.oneTimeCode = true;
      else if (f.type !== 'hidden' && isCard(f)) facts.card = true;
    }
    return facts;
  }

  var DROP = { SCRIPT: 1, NOSCRIPT: 1, IFRAME: 1, FRAME: 1, FRAMESET: 1, OBJECT: 1, EMBED: 1, META: 1, BASE: 1, LINK: 1, PORTAL: 1, APPLET: 1, TEMPLATE: 1, STYLE: 1 };

  function scriptSnapshot(max) {
    var root = document.documentElement;
    var clone = root.cloneNode(true);
    var live = root.getElementsByTagName('*');
    var copy = clone.getElementsByTagName('*');
    var count = Math.min(live.length, copy.length);
    var markHidden = count < 20000;
    var drop = [];
    for (var i = 0; i < count; i++) {
      var el = live[i];
      var c = copy[i];
      var tag = c.tagName;
      if (DROP[tag]) { drop.push(c); continue; }
      for (var a = c.attributes.length - 1; a >= 0; a--) {
        var name = c.attributes[a].name.toLowerCase();
        var value = String(c.attributes[a].value || '');
        if (name.indexOf('on') === 0 || name === 'srcdoc' || name === 'nonce' || /^\s*(java|vb)script:/i.test(value)) c.removeAttribute(c.attributes[a].name);
      }
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        var secret = isSecret(el);
        if (tag === 'TEXTAREA') c.textContent = secret ? '' : el.value;
        else if (tag === 'SELECT') {
          for (var o = 0; o < c.options.length; o++) c.options[o].toggleAttribute('selected', !secret && o === el.selectedIndex);
        } else if (el.type === 'checkbox' || el.type === 'radio') c.toggleAttribute('checked', !!el.checked);
        else if (secret) c.removeAttribute('value');
        else c.setAttribute('value', el.value);
      }
      if ((tag === 'A' || tag === 'AREA') && el.href) c.setAttribute('href', String(el.href));
      if (tag === 'IMG' && (el.currentSrc || el.src)) { c.setAttribute('src', String(el.currentSrc || el.src)); c.removeAttribute('srcset'); }
      if (tag === 'FORM' && el.action) c.setAttribute('action', String(el.action));
      if (markHidden && document.body && document.body.contains(el)) {
        try {
          var cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') c.setAttribute('hidden', '');
        } catch (e) {}
      }
    }
    for (var d = 0; d < drop.length; d++) if (drop[d].parentNode) drop[d].parentNode.removeChild(drop[d]);

    // Same-site stylesheets as text (cross-site ones can't be read and are left out).
    var css = '';
    for (var s = 0; s < document.styleSheets.length && css.length < 500000; s++) {
      try {
        var rules = document.styleSheets[s].cssRules;
        for (var r = 0; r < rules.length && css.length < 500000; r++) css += rules[r].cssText + '\n';
      } catch (e) {}
    }
    var head = clone.querySelector('head');
    var body = clone.querySelector('body');
    var headHtml = '<title></title>';
    if (head) {
      var title = head.querySelector('title');
      headHtml = title ? title.outerHTML : '<title></title>';
    }
    var bodyHtml = body ? body.outerHTML : '<body></body>';
    var cut = false;
    if (bodyHtml.length > max) { bodyHtml = bodyHtml.slice(0, max); cut = true; }
    return { head: headHtml, css: css.replace(/<\/style/gi, '<\\/style'), body: bodyHtml, title: document.title, cut: cut };
  }

  agent.scriptFacts = scriptFacts;
  agent.scriptSnapshot = scriptSnapshot;
})();
`;
