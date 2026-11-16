// Lokanta: a brand-free demo restaurant for recording Qutai videos. No network requests, no storage: the cart lives
// in memory for the visit. Turkish by default, English with ?lang=en. Nothing is ever ordered or paid.
const EN = new URLSearchParams(location.search).get('lang') === 'en';
document.documentElement.lang = EN ? 'en' : 'tr';

const T = {
  banner: ['Bu bir demo sitedir: sipariş alınmaz, ödeme yapılmaz.', 'This is a demo site: no orders are taken, nothing is paid.'],
  cart: ['Sepet', 'Cart'],
  menuTitle: ['Menü', 'Menu'],
  search: ['Menüde ara', 'Search the menu'],
  searchPh: ['Yemek, içerik ya da “glutensiz”', 'Dish, ingredient or “gluten-free”'],
  gfOnly: ['Yalnızca glutensiz', 'Gluten-free only'],
  gf: ['Glutensiz', 'Gluten-free'],
  add: ['Sepete ekle', 'Add to cart'],
  added: ['Sepete eklendi: ', 'Added to cart: '],
  none: ['Aramanızla eşleşen yemek yok.', 'No dishes match your search.'],
  cartTitle: ['Sepetiniz', 'Your cart'],
  cartEmpty: ['Sepetiniz boş.', 'Your cart is empty.'],
  total: ['Toplam', 'Total'],
  toCheckout: ['Teslimat bilgilerine geç', 'Continue to delivery'],
  deliveryTitle: ['Teslimat bilgileri', 'Delivery details'],
  name: ['Ad soyad', 'Full name'],
  address: ['Teslimat adresi', 'Delivery address'],
  phone: ['Telefon', 'Phone'],
  note: ['Sipariş notu (isteğe bağlı)', 'Order note (optional)'],
  toPayment: ['Ödemeye geç', 'Continue to payment'],
  required: ['Lütfen ad, adres ve telefonu doldurun.', 'Please fill in name, address and phone.'],
  paymentTitle: ['Ödeme', 'Payment'],
  card: ['Kart numarası', 'Card number'],
  expiry: ['Son kullanma tarihi', 'Expiry date'],
  cvc: ['Güvenlik kodu', 'Security code'],
  pay: ['Siparişi tamamla', 'Place order'],
  demoPay: ['Demo site: ödeme alınmaz, sipariş verilmez.', 'Demo site: no payment is taken and no order is placed.'],
  deliverTo: ['Teslimat: ', 'Deliver to: '],
};
const t = (k) => T[k][EN ? 1 : 0];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);

const MENU = [
  { id: 1, tr: ['Mercimek çorbası', 'Kırmızı mercimek, havuç, kimyon'], en: ['Lentil soup', 'Red lentils, carrot, cumin'], price: 120, gf: true },
  { id: 2, tr: ['Lahmacun', 'İnce hamur, kıymalı harç'], en: ['Lahmacun', 'Thin dough, minced meat topping'], price: 140, gf: false },
  { id: 3, tr: ['Tavuk şiş, pilav', 'Izgara tavuk, tereyağlı pirinç pilavı'], en: ['Chicken skewer with rice', 'Grilled chicken, buttered rice pilaf'], price: 290, gf: true },
  { id: 4, tr: ['Kıymalı pide', 'Fırında pide, kıymalı'], en: ['Minced meat pide', 'Oven-baked flatbread with minced meat'], price: 260, gf: false },
  { id: 5, tr: ['Patlıcan kebabı, pilav', 'Közde patlıcan, köfte, pirinç pilavı (ekmek kırıntısız)'], en: ['Aubergine kebab with rice', 'Grilled aubergine and meatballs without breadcrumbs, rice pilaf'], price: 320, gf: true },
  { id: 6, tr: ['Mantı', 'Yoğurtlu, tereyağı soslu'], en: ['Mantı', 'Dumplings with yoghurt and butter sauce'], price: 270, gf: false },
  { id: 7, tr: ['Zeytinyağlı enginar', 'Enginar, bezelye, dereotu'], en: ['Artichokes in olive oil', 'Artichoke, peas, dill'], price: 180, gf: true },
  { id: 8, tr: ['Mevsim salatası', 'Domates, salatalık, nar ekşisi'], en: ['Seasonal salad', 'Tomato, cucumber, pomegranate molasses'], price: 110, gf: true },
  { id: 9, tr: ['Fırın sütlaç', 'Pirinç, süt, tarçın'], en: ['Baked rice pudding', 'Rice, milk, cinnamon'], price: 100, gf: true },
  { id: 10, tr: ['Baklava', 'Fıstıklı, dört dilim'], en: ['Baklava', 'Pistachio, four pieces'], price: 160, gf: false },
];
const label = (m) => m[EN ? 'en' : 'tr'];
const tl = (n) => (EN ? `TRY ${n}` : `${n} TL`);

const state = { q: '', gfOnly: false, cart: new Map(), delivery: null };
const app = document.getElementById('app');
const count = document.getElementById('cart-count');

function matches(m) {
  const [name, desc] = label(m);
  const hay = `${name} ${desc} ${m.gf ? `${T.gf[0]} ${T.gf[1]} glutensiz gluten-free gluten free` : ''}`.toLocaleLowerCase(EN ? 'en' : 'tr');
  const words = state.q.toLocaleLowerCase(EN ? 'en' : 'tr').split(/\s+/).filter(Boolean);
  return (!state.gfOnly || m.gf) && words.every((w) => hay.includes(w));
}

function menuView() {
  app.innerHTML = `
    <h1>${t('menuTitle')}</h1>
    <form class="search" role="search" onsubmit="return false">
      <label>${t('search')}<input type="search" id="q" name="q" placeholder="${t('searchPh')}" value="${esc(state.q)}"></label>
      <label class="filter"><input type="checkbox" id="gf" ${state.gfOnly ? 'checked' : ''}> ${t('gfOnly')}</label>
    </form>
    <p id="status" role="status" class="empty"></p>
    <ul class="menu" id="list"></ul>`;
  const list = document.getElementById('list');
  const draw = () => {
    const shown = MENU.filter(matches);
    list.innerHTML = shown
      .map((m) => {
        const [name, desc] = label(m);
        return `<li class="item"><h2>${name}</h2><span class="price">${tl(m.price)}</span><p>${desc}${
          m.gf ? `<br><span class="tag">${t('gf')}</span>` : ''
        }</p><button class="add" data-id="${m.id}" aria-label="${t('add')}: ${name}">${t('add')}</button></li>`;
      })
      .join('');
    document.getElementById('status').textContent = shown.length ? '' : t('none');
  };
  draw();
  document.getElementById('q').addEventListener('input', (e) => {
    state.q = e.target.value;
    draw();
  });
  document.getElementById('gf').addEventListener('change', (e) => {
    state.gfOnly = e.target.checked;
    draw();
  });
  list.addEventListener('click', (e) => {
    const id = Number(e.target.closest('button')?.dataset.id);
    if (!id) return;
    state.cart.set(id, (state.cart.get(id) ?? 0) + 1);
    updateCount();
    document.getElementById('status').textContent = t('added') + label(MENU.find((m) => m.id === id))[0];
  });
}

function lines() {
  let total = 0;
  const rows = [...state.cart].map(([id, n]) => {
    const m = MENU.find((x) => x.id === id);
    total += m.price * n;
    return `<li><span>${n} × ${label(m)[0]}</span><span>${tl(m.price * n)}</span></li>`;
  });
  return { html: `<ul class="lines">${rows.join('')}</ul><p class="total">${t('total')}: ${tl(total)}</p>`, total };
}

function cartView() {
  if (!state.cart.size) {
    app.innerHTML = `<h1>${t('cartTitle')}</h1><p class="empty">${t('cartEmpty')}</p>`;
    return;
  }
  app.innerHTML = `<h1>${t('cartTitle')}</h1>${lines().html}<a href="#delivery"><button class="primary">${t('toCheckout')}</button></a>`;
}

function deliveryView() {
  const d = state.delivery ?? {};
  app.innerHTML = `
    <h1>${t('deliveryTitle')}</h1>
    <form id="delivery" novalidate>
      <label>${t('name')}<input name="name" autocomplete="name" required value="${esc(d.name)}"></label>
      <label>${t('address')}<textarea name="address" autocomplete="street-address" rows="3" required>${esc(d.address)}</textarea></label>
      <label>${t('phone')}<input name="phone" type="tel" autocomplete="tel" required value="${esc(d.phone)}"></label>
      <label>${t('note')}<textarea name="note" rows="2">${esc(d.note)}</textarea></label>
      <p id="err" role="alert"></p>
      <button class="primary" type="submit">${t('toPayment')}</button>
    </form>`;
  document.getElementById('delivery').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    if (!f.name.trim() || !f.address.trim() || !f.phone.trim()) {
      document.getElementById('err').textContent = t('required');
      return;
    }
    state.delivery = f;
    location.hash = '#payment';
  });
}

function paymentView() {
  if (!state.delivery) {
    location.hash = '#delivery';
    return;
  }
  app.innerHTML = `
    <h1>${t('paymentTitle')}</h1>
    ${lines().html}
    <p>${t('deliverTo')}${esc(state.delivery.name)}, ${esc(state.delivery.address)}</p>
    <form id="pay" novalidate>
      <label>${t('card')}<input name="cc-number" autocomplete="cc-number" inputmode="numeric"></label>
      <label>${t('expiry')}<input name="cc-exp" autocomplete="cc-exp" placeholder="AA/YY"></label>
      <label>${t('cvc')}<input name="cc-csc" autocomplete="cc-csc" inputmode="numeric"></label>
      <button class="primary" type="submit">${t('pay')}</button>
      <p id="paynote" role="status"></p>
    </form>`;
  document.getElementById('pay').addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('paynote').innerHTML = `<span class="note">${t('demoPay')}</span>`;
  });
}

function updateCount() {
  count.textContent = [...state.cart.values()].reduce((a, b) => a + b, 0);
}

function route() {
  const view = { '#cart': cartView, '#delivery': deliveryView, '#payment': paymentView }[location.hash] ?? menuView;
  view();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
route();
