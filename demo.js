/* Livance — single-file demo. Everything runs in your browser and is saved in this
   browser only (localStorage). Payments, Zoho Books and email are simulated.
   The real website is the Node app in this folder; this file mirrors its screens and rules. */
(function () {
  'use strict';
  var KEY = 'livance-demo-v3';
  // Exact source UI; network bridge is provided by its React parent.
  var BRIDGE = window.parent && window.parent !== window && window.parent.LIVANCE_BRIDGE;
  var CONNECTED = !!(BRIDGE && BRIDGE.enabled);
  var liveReady = false, liveRole = null, liveTimer = null, liveSaving = false, liveDirty = false;
  function liveFail(e) { toast('Sync error: ' + (e && e.message || e)); if (window.parent) window.parent.dispatchEvent(new CustomEvent('livance-live-error', {detail: e && e.message || String(e)})); }
  function setIdentity(u) {
    db.session = null; liveRole = u && u.role || null;
    if (!u) return;
    var id = BRIDGE.numericId(u.id);
    var saved = (db.users || []).filter(function (v) { return v.auth_id === u.id; })[0];
    if (!saved) { saved = {id:id,auth_id:u.id,email:u.email,name:u.name||u.email.split('@')[0],phone:u.phone||'',role:u.role}; db.users.push(saved); }
    saved.id = id; saved.auth_id = u.id; saved.email=u.email; saved.role=u.role; saved.name=u.name||saved.name; delete saved.password;
    db.session=id;
  }
  function refreshLive(next) {
    BRIDGE.bootstrap(db).then(function (r) { db=r.data; if (typeof migrateDemo === 'function') migrateDemo(); setIdentity(r.identity); persistedBookingStatuses={}; (db.bookings||[]).forEach(function(b){if(b.external_id)persistedBookingStatuses[b.external_id]=b.status;}); liveReady=true; if(next) go(next); else if(window.LIVANCE_START && r.identity?.role==='admin')go('/admin'); else render(); })
      .catch(function (e) { db.session=null; liveRole=null; liveReady=true; liveFail(e); go('/login?next='+(encodeURIComponent(window.LIVANCE_START||'/dashboard'))); });
  }
  function livePersist() {
    if (!liveReady || !CONNECTED || liveRole !== 'admin') return;
    liveDirty=true; clearTimeout(liveTimer);
    liveTimer=setTimeout(function run() {
      if(liveSaving){liveTimer=setTimeout(run,500);return;}
      if(!liveDirty)return;
      liveDirty=false;liveSaving=true;
      BRIDGE.persist(db).then(function(){liveSaving=false;if(liveDirty)liveTimer=setTimeout(run,200);})
        .catch(function(e){liveSaving=false;liveFail(e);});
    },350);
  }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var app = $('#app');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var rs = function (p) { return '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 }); };
  var rs0 = function (p) { return '₹' + Math.round(p / 100).toLocaleString('en-IN'); };
  var hh = function (h) { return (h < 10 ? '0' : '') + h + ':00'; };
  var INR = function (r) { return Math.round(r * 100); };

  /* ---------------- time (IST) ---------------- */
  function ist() { var d = new Date(Date.now() + 330 * 6e4); return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() }; }
  function addDays(date, n) { var d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dow(date) { return new Date(date + 'T00:00:00Z').getUTCDay(); }
  function fmtDay(date) { return new Date(date + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); }
  function epoch(date, hour) { return Date.parse(date + 'T00:00:00Z') + hour * 36e5 - 330 * 6e4; }
  var OPEN = 9, CLOSE = 19;

  /* ---------------- catalogue (same rules as the real site) ---------------- */
  var STATES = [['Delhi', '07', 'DL'], ['Haryana', '06', 'HR'], ['Karnataka', '29', 'KA'], ['Maharashtra', '27', 'MH'], ['Uttar Pradesh', '09', 'UP'], ['Tamil Nadu', '33', 'TN'], ['Telangana', '36', 'TS'], ['Gujarat', '24', 'GJ'], ['Rajasthan', '08', 'RJ'], ['West Bengal', '19', 'WB'], ['Punjab', '03', 'PB'], ['Kerala', '32', 'KL'], ['Madhya Pradesh', '23', 'MP'], ['Chandigarh', '04', 'CH']];
  var STATE_CODE = {}; STATES.forEach(function (s) { STATE_CODE[s[0]] = s[1]; });
  var PLANS = {
    address: { key: 'address', name: 'Business Address', short: 'BA', price: INR(12000), desc: 'Mailing and correspondence address', includes: ['Leave & licence agreement', 'Mail and courier handling (15 items a month)', 'Use on website and letterhead'] },
    gst: { key: 'gst', name: 'GST Registration', short: 'GST', price: INR(15000), desc: 'Add this centre as your GST place of business', featured: true, includes: ['Leave & licence agreement', 'NOC with GST consent', 'Owners\' NOC, utility bill and property tax receipt', 'Support during officer verification'] },
    company: { key: 'company', name: 'Company Registration', short: 'CR', price: INR(15000), desc: 'Registered office for MCA, GST and bank account', includes: ['Leave & licence agreement', 'NOC with MCA consent (registered office)', 'Owners\' NOC, utility bill and property tax receipt', 'Use for GST and bank account too'] },
  };
  var AGREEMENT_TERM = '11 months and 27 days';
  var TERMS = [{ months: 12, label: '12 months', pct: 0 }, { months: 24, label: '24 months', pct: 10 }];
  var ADDONS = [
    { key: 'sign_a4', group: 'signage', name: 'A4 sheet signage', perYear: true, pos: 'property', sac: '997212', price: function () { return INR(3000); }, desc: function () { return 'Business name on A4 in an acrylic holder at reception.'; } },
    { key: 'sign_sunboard', group: 'signage', name: 'Permanent sunboard signage', perYear: true, pos: 'property', sac: '997212', tag: 'Recommended for GST', price: function () { return INR(6000); }, desc: function () { return 'Wall-mounted sunboard with your name and logo.'; } },
    { key: 'sign_metal', group: 'signage', name: 'Permanent metallic signage', perYear: true, pos: 'property', sac: '997212', tag: 'Premium', price: function () { return INR(12000); }, desc: function () { return 'Brushed steel, laser-etched name plate.'; } },
    { key: 'ca', name: 'CA assistance', perYear: false, pos: 'recipient', sac: '998232', price: function (p) { return { gst: INR(2999), company: INR(9999), address: INR(1499) }[p]; },
      desc: function (p) { return { gst: 'A CA files your GST registration and answers officer queries until your GSTIN is issued.', company: 'A CA files your incorporation, including DSC, DIN and name approval.', address: 'A CA reviews your setup and advises on GST and company registration.' }[p]; } },
    { key: 'mail', name: 'Mail scan and forwarding', perYear: true, pos: 'recipient', sac: '998599', price: function () { return INR(1800); }, desc: function () { return 'Letters scanned the day they arrive, originals couriered monthly.'; } },
  ];
  var SIGNS = {
    sign_a4: { style: 'a4', title: 'Standard', material: 'Printed A4 sheet in a clear acrylic holder', size: 'A4 · 297 × 210 mm', where: 'Reception name directory', best: 'Correspondence and business address' },
    sign_sunboard: { style: 'sunboard', title: 'Permanent · Sunboard', material: '5 mm sunboard, full-colour print with your name and logo', size: '18 × 12 in · 457 × 305 mm', where: 'Wall-mounted at the centre', best: 'GST and MCA physical verification' },
    sign_metal: { style: 'metal', title: 'Permanent · Metallic', material: 'Brushed stainless steel plate, laser-etched, stand-off mounted', size: '12 × 8 in · 305 × 203 mm', where: 'Wall-mounted at the centre entrance', best: 'A premium, lasting brand presence' },
  };
  var SIGN_INCLUDES = ['Installed within 3 working days of KYC approval', 'Photo of your installed board added to your dashboard, ready for GST verification', 'Stays up for your full term and is replaced free if damaged'];
  var TAGS = { reception: 'Reception', lounge: 'Lounge', workspace: 'Open seats', cabin: 'Cabin', meeting: 'Meeting room', pantry: 'Pantry', signage: 'Signage', exterior: 'Building' };
  var IMG = window.LIVANCE_IMG || {};
  function P(f, caption, tag) { return { src: 'img:' + f, caption: caption, tag: tag }; }
  function imgSrc(p) { if (!p) return null; var s2 = p.src || ''; return s2.indexOf('img:') === 0 ? (IMG[s2.slice(4)] || null) : s2; }
  function photo(p, cls, tone) {
    var src = imgSrc(p), label = (p && p.caption) || 'Livance';
    return src ? '<figure class="photo ' + (cls || '') + '"><img src="' + src + '" alt="' + esc(label) + '" loading="lazy"></figure>'
      : '<figure class="photo ' + (cls || '') + '"><div class="ph t' + (tone || 1) + '" role="img" aria-label="' + esc(label) + '"></div><figcaption>' + esc(label) + '</figcaption></figure>';
  }
  function gallery(photos, variant, max) {
    photos = (photos || []).filter(function (p) { return imgSrc(p); }).slice(0, max || 3); if (!photos.length) return '';
    var v = variant || '';
    return '<div class="gallery ' + (photos.length === 1 ? 'one' : v) + '">' + photos.map(function (p, i) { return '<button type="button" class="' + (i === 0 && v !== 'strip' ? 'main' : 'side') + '" data-lightbox="' + i + '" data-src="' + imgSrc(p) + '" data-caption="' + esc(p.caption) + '">' + photo(p) + '</button>'; }).join('') + '</div>';
  }
  function byTag(k) { var tags = [].slice.call(arguments, 1), c = centre(k); return c ? (c.photos || []).filter(function (p) { return tags.indexOf(p.tag) > -1; }) : []; }
  function signCards(mode, name) {
    return '<div class="signs">' + Object.keys(SIGNS).map(function (k) {
      var s2 = SIGNS[k], a = ADDONS.filter(function (x) { return x.key === k; })[0], tag = mode === 'pick' ? 'label' : 'div';
      return '<' + tag + ' class="sign-card"' + (mode === 'pick' ? '' : ' style="cursor:default"') + '><div class="sign-stage"><div class="sign ' + s2.style + '"><div><b data-sign-name>' + esc(name || 'Your Business Pvt Ltd') + '</b><small>Registered office</small></div></div></div>' +
        '<div class="sc-body"><div class="between"><span class="row" style="gap:10px">' + (mode === 'pick' ? '<input type="checkbox" value="' + k + '" data-signage>' : '') + '<b>' + s2.title + '</b></span>' + (a.tag ? '<span class="pill or">' + a.tag + '</span>' : '') + '</div>' +
        '<div class="price"><b class="mono" style="font-size:1.35rem">' + rs0(a.price()) + '</b><span>/ year + GST</span></div><dl class="spec"><dt>Material</dt><dd>' + s2.material + '</dd><dt>Size</dt><dd>' + s2.size + '</dd><dt>Where</dt><dd>' + s2.where + '</dd><dt>Best for</dt><dd>' + s2.best + '</dd></dl></div></' + tag + '>';
    }).join('') + '</div>';
  }
  var KYC = { company: ['PAN card', 'Aadhaar or passport', 'Passport-size photo'], gst: ['PAN card', 'Aadhaar or passport', 'Board resolution or authorisation letter'], address: ['PAN card', 'Aadhaar or passport'] };

  /* ---------------- data ---------------- */
  var db;
  function seed() {
    var t = ist().date;
    db = {
      seq: 100, users: [
        { id: 1, email: 'demo@livance.co.in', password: 'demo12345', name: 'Aarav Mehta', phone: '9876543210', role: 'member' },
        { id: 2, email: 'admin@livance.co.in', password: 'admin12345', name: 'Shwetaansh Gaur', phone: '9999999999', role: 'admin' },
        { id: 3, email: 'riya@example.com', password: 'x', name: 'Riya Kapoor', phone: '9811111111', role: 'member' }],
      session: null,
      centres: [
        { key: 'gurugram', name: 'Cyber City, Gurugram', short: 'Gurugram', city: 'Gurugram', state: 'Haryana', slug: 'cyber-city-gurugram', voSlug: 'gurugram',
          photos: [P('cc-open-desks.jpg', 'Open desks', 'workspace'), P('cc-meeting-room-b.jpg', 'Meeting Room B', 'meeting'), P('cc-cabin.jpg', 'Private cabin', 'cabin'), P('cc-meeting-room-a.jpg', 'Meeting Room A', 'meeting')],
          address: 'First Floor, Livance – Enkay Tower (formerly Coca-Cola Building), Plot No. B & B1, Vanijya Nikunj, Udyog Vihar Phase V, Gurugram, Haryana 122016', transit: 'Near Cyber City and the Rapid Metro',
          blurb: 'A bright, plant-filled desk floor at Enkay Tower, Udyog Vihar Phase V, a short walk from Cyber City.', gstin: '06AAJCL1234M1Z5', zoho: '2389059000000312001', totalSeats: 30, deskFrom: INR(7000), active: true,
          amenities: ['Dedicated desks', 'Two 4-seat meeting rooms', 'Reception and mail handling', 'High-speed Wi-Fi and power backup', 'Pantry'] },
        { key: 'ghitorni', name: 'Ghitorni, New Delhi', short: 'Delhi', city: 'New Delhi', state: 'Delhi', slug: 'ghitorni-delhi', voSlug: 'delhi',
          photos: [P('gh-reception.jpg', 'Reception and lounge', 'reception'), P('gh-lounge.jpg', 'Lounge', 'lounge'), P('gh-workspace.jpg', 'Open workspace', 'workspace'), P('gh-boardroom.jpg', 'Boardroom', 'meeting'), P('gh-huddle-room.jpg', 'Huddle Room', 'meeting'), P('gh-cabin.jpg', 'Private cabin', 'cabin'), P('gh-pantry.jpg', 'Pantry', 'pantry')],
          address: 'Third Floor, House No. 170, Khasra No. 393, Village Ghitorni, near 100 Feet Road, New Delhi 110030', transit: 'Near Ghitorni Metro, Yellow Line',
          blurb: 'Private cabins, a boardroom and a skyline lounge in South Delhi.', gstin: '07AAJCL1234M1Z3', zoho: '2389059000000312009', totalSeats: 40, deskFrom: null, active: true,
          amenities: ['Private cabins', '6-seat and 10-seat meeting rooms', 'Executive lounge', 'Dining and breakout area', 'Reception and mail handling'] }],
      rooms: [
        { id: 'ggn-a', centre: 'gurugram', name: 'Meeting Room A', seats: 4, features: ['TV screen', 'Whiteboard'], active: true, photos: [P('cc-meeting-room-a.jpg', 'Meeting Room A', 'meeting')] },
        { id: 'ggn-b', centre: 'gurugram', name: 'Meeting Room B', seats: 4, features: ['Round table', 'Natural light'], active: true, photos: [P('cc-meeting-room-b.jpg', 'Meeting Room B', 'meeting')] },
        { id: 'dl-huddle', centre: 'ghitorni', name: 'Huddle Room', seats: 6, features: ['TV screen', 'Video calls'], active: true, photos: [P('gh-huddle-room.jpg', 'Huddle Room', 'meeting')] },
        { id: 'dl-board', centre: 'ghitorni', name: 'Boardroom', seats: 10, features: ['Large display', 'Video calls', 'Whiteboard'], active: true, photos: [P('gh-boardroom.jpg', 'Boardroom', 'meeting')] }],
      reservations: [],
      bookings: [], orders: [], invoices: [], vos: [], leads: [],
      deskClients: [{ id: 1, centre: 'gurugram', name: 'Northwind Labs', seats: 8, start: addDays(t, -30), end: null }, { id: 2, centre: 'ghitorni', name: 'Kestrel Advisory', seats: 6, start: addDays(t, -10), end: null }],
      overrides: {},
      coupons: [{ code: 'LIVANCE10', kind: 'percent', value: 10, min: 0, products: '*', desc: '10% off your first booking', featured: true, active: true, used: 0 },
        { code: 'FOUNDER2K', kind: 'flat', value: INR(2000), min: INR(15000), products: 'virtual_office', desc: '₹2,000 off virtual office orders above ₹15,000', featured: false, active: true, used: 0 }],
      zoho: { orgId: '60038792874', taxIntra: '2389059000000171249', taxInter: '2389059000000171089', account: '', mode: 'Bank Transfer' },
    };
    // A few bookings by other members, so availability looks real.
    var d = t; var n = 0;
    while (n < 4) { d = addDays(d, 1); if (dow(d) === 0) continue; n++;
      db.bookings.push({ id: ++db.seq, userId: 3, kind: 'meeting_room', centre: 'ghitorni', roomId: 'dl-board', date: d, start: 11 + (n % 3), end: 13 + (n % 3), status: 'confirmed' });
      db.bookings.push({ id: ++db.seq, userId: 3, kind: 'meeting_room', centre: 'gurugram', roomId: 'ggn-a', date: d, start: 14, end: 16, status: 'confirmed' }); }
    if (typeof seedMore === 'function') seedMore();
    save();
  }
  var persistedBookingStatuses={};
  function syncBookingStatus(){if(!CONNECTED||!liveReady||liveRole!=='admin')return;
    (db.bookings||[]).forEach(function(b){if(!b.external_id)return;var previous=persistedBookingStatuses[b.external_id];
      if(previous===undefined){persistedBookingStatuses[b.external_id]=b.status;return;}
      if(previous!==b.status){persistedBookingStatuses[b.external_id]=b.status;
        BRIDGE.updateBooking(b.external_id,b.status).catch(function(e){b.status=previous;persistedBookingStatuses[b.external_id]=previous;liveFail(e);render();});
      }
    });
  }
  function save() { if(CONNECTED){syncBookingStatus();livePersist();return;} store(KEY, JSON.stringify(db)); }
  function store(k, v) { try { if (v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }

  var me = function () { return db.users.filter(function (u) { return u.id === db.session; })[0] || null; };
  var centres = function () { return db.centres.filter(function (c) { return c.active; }); };
  var centre = function (k) { return db.centres.filter(function (c) { return c.key === k; })[0]; };
  var room = function (id) { return db.rooms.filter(function (r) { return r.id === id; })[0]; };
  var roomsAt = function (k) { return db.rooms.filter(function (r) { return r.centre === k && r.active; }); };
  var hourly = function (r) { return r.seats * INR(100); };
  function cities() { var m = {}; centres().forEach(function (c) { (m[c.city] = m[c.city] || []).push(c); }); return Object.keys(m).map(function (k) { return { city: k, centres: m[k] }; }); }

  /* ---------------- rules: availability, capacity, pricing ---------------- */
  function dateError(date) {
    var t = ist().date;
    if (date < t) return 'That date has passed.';
    if (date > addDays(t, 60)) return 'Bookings open up to 60 days ahead.';
    if (dow(date) === 0) return 'Our centres are closed on Sundays.';
    return null;
  }
  function firstHour(date) { var t = ist(); return date === t.date ? Math.max(OPEN, t.hour + 1) : OPEN; }
  function reservationOn(roomId, date) { return (db.reservations || []).filter(function (r) { return r.roomId === roomId && !r.ended && r.start <= date && r.end >= date && dow(date) !== 0; })[0]; }
  function taken(roomId, date) {
    var s = {}; db.bookings.forEach(function (b) { if (b.roomId === roomId && b.date === date && (b.status === 'confirmed' || b.status === 'blocked')) for (var h = b.start; h < b.end; h++) s[h] = b; });
    var rv = reservationOn(roomId, date); if (rv) for (var h = rv.sh; h < rv.eh; h++) s[h] = { kind: 'reserved', client: rv.client, userId: null };
    return s;
  }
  function availability(roomId, date) {
    var rv = reservationOn(roomId, date), closed = dateError(date) || (rv && rv.sh <= OPEN && rv.eh >= CLOSE ? 'This room is reserved for a long-term client until ' + fmtDay(rv.end) + '. Try another room or date.' : null), tk = taken(roomId, date), f = firstHour(date), out = [];
    for (var h = OPEN; h < CLOSE; h++) out.push({ hour: h, status: closed ? 'closed' : h < f ? 'past' : tk[h] ? 'booked' : 'free' });
    return { closed: closed, hours: out };
  }
  function occupied(k, date) { return db.deskClients.filter(function (c) { return c.centre === k && c.start <= date && (!c.end || c.end >= date); }).reduce(function (n, c) { return n + c.seats; }, 0); }
  function capacity(k, date) { var o = db.overrides[k + '|' + date]; if (o !== undefined) return o; var c = centre(k); return Math.max(0, c.totalSeats - occupied(k, date)); }
  function passesSold(k, date) { return db.bookings.filter(function (b) { return b.kind === 'day_pass' && b.centre === k && b.date === date && b.status === 'confirmed'; }).reduce(function (n, b) { return n + b.qty; }, 0); }
  function passesLeft(k, date) { return Math.max(0, capacity(k, date) - passesSold(k, date)); }
  function passDays(k) { var out = [], d = ist().date; if (firstHour(d) >= CLOSE - 2) d = addDays(d, 1); while (out.length < 14) { if (dow(d) !== 0) out.push({ date: d, left: passesLeft(k, d) }); d = addDays(d, 1); } return out; }

  function lines(product, p) {
    if (product === 'meeting_room') { var r = room(p.roomId); return [{ desc: r.name + ' (' + r.seats + ' seats), ' + centre(r.centre).short, sac: '997212', pos: 'property', qty: p.hours, unit: hourly(r), amount: hourly(r) * p.hours }]; }
    if (product === 'day_pass') return [{ desc: 'Day pass, ' + centre(p.centre).name, sac: '997212', pos: 'property', qty: p.qty, unit: INR(500), amount: INR(500) * p.qty }];
    var plan = PLANS[p.plan], years = p.months / 12, term = TERMS.filter(function (t) { return t.months === p.months; })[0];
    var gross = plan.price * years, td = Math.round(gross * term.pct / 100);
    var out = [{ desc: 'Virtual office: ' + plan.name + ', ' + centre(p.centre).name + ', ' + p.months + ' months', sac: '997212', pos: 'property', qty: years, unit: plan.price, amount: gross - td, termSaving: td }];
    ADDONS.forEach(function (a) { if (p.addons.indexOf(a.key) > -1) { var u = a.price(p.plan), q = a.perYear ? years : 1; out.push({ desc: a.name, sac: a.sac, pos: a.pos, qty: q, unit: u, amount: u * q }); } });
    return out;
  }
  function findCoupon(code, product, subtotal) {
    var c = db.coupons.filter(function (x) { return x.code === String(code || '').trim().toUpperCase(); })[0];
    if (!c || !c.active) return { error: '"' + esc(code) + '" isn\'t a valid code.' };
    if (c.products !== '*' && c.products !== product) return { error: 'This code does not apply to this product.' };
    if (subtotal < c.min) return { error: 'This code needs an order of at least ' + rs0(c.min) + ' before GST.' };
    return { coupon: c };
  }
  function quote(product, p, code, billState) {
    var ls = lines(product, p), sub = ls.reduce(function (n, l) { return n + l.amount; }, 0), cp = null, cErr = null;
    if (code) { var f = findCoupon(code, product, sub); if (f.coupon) cp = f.coupon; else cErr = f.error; }
    if (cp) { var total = cp.kind === 'percent' ? Math.round(sub * cp.value / 100) : Math.min(cp.value, sub), left = total;
      ls.forEach(function (l, i) { var sh = i === ls.length - 1 ? left : Math.round(total * l.amount / sub); l.discount = Math.min(sh, l.amount); left -= l.discount; }); }
    var cKey = p.centre || room(p.roomId).centre, cState = centre(cKey).state, bs = billState || cState;
    var q = { lines: ls, subtotal: sub, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, coupon: cp, couponError: cErr, centre: cKey, termSaving: 0 };
    ls.forEach(function (l) {
      l.discount = l.discount || 0; l.taxable = l.amount - l.discount;
      l.pos = l.pos === 'property' ? cState : bs; var intra = l.pos === cState;
      l.cgst = intra ? Math.round(l.taxable * 9 / 100) : 0; l.sgst = l.cgst; l.igst = intra ? 0 : Math.round(l.taxable * 18 / 100);
      q.discount += l.discount; q.taxable += l.taxable; q.cgst += l.cgst; q.sgst += l.sgst; q.igst += l.igst; q.termSaving += l.termSaving || 0;
    });
    q.total = q.taxable + q.cgst + q.sgst + q.igst;
    return q;
  }
  function refundPct(b) { var h = (epoch(b.date, b.kind === 'day_pass' ? OPEN : b.start) - Date.now()) / 36e5; return h >= 24 ? 100 : h >= 12 ? 50 : 0; }

  /* ---------------- "Zoho Books" (simulated) ---------------- */
  function raiseDocs(order, kind, pct, refOf) {
    var groups = {};
    order.quote.lines.forEach(function (l) { (groups[l.pos] = groups[l.pos] || []).push(l); });
    var made = [];
    Object.keys(groups).forEach(function (pos) {
      if (refOf && refOf.indexOf(pos) < 0) return;
      var f = function (n) { return Math.round(n * (pct || 100) / 100); };
      var ls = groups[pos].map(function (l) { return { desc: l.desc, sac: l.sac, qty: kind === 'invoice' ? l.qty : 1, unit: kind === 'invoice' ? l.unit : f(l.taxable), discount: kind === 'invoice' ? l.discount : 0, taxable: f(l.taxable), cgst: f(l.cgst), sgst: f(l.sgst), igst: f(l.igst) }; });
      var t = ls.reduce(function (a, l) { return { taxable: a.taxable + l.taxable, cgst: a.cgst + l.cgst, sgst: a.sgst + l.sgst, igst: a.igst + l.igst }; }, { taxable: 0, cgst: 0, sgst: 0, igst: 0 });
      var n = ++db.seq;
      var doc = { id: n, kind: kind, orderId: order.id, userId: order.userId, number: (kind === 'invoice' ? 'INV-' : 'CN-') + String(n).padStart(6, '0'), pos: pos, lines: ls,
        taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, igst: t.igst, total: t.taxable + t.cgst + t.sgst + t.igst, issued: ist().date, centre: order.centre, billing: order.billing };
      db.invoices.push(doc); made.push(doc);
    });
    return made;
  }

  // Forms are driven by click/Enter handlers instead of real submission, because some
  // preview windows (sandboxed frames) block form submission entirely.
  function onSubmit(form, fn) {
    if (!form) return;
    var run = function () { fn({ preventDefault: function () {}, target: form }); };
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    $$('button:not([type]), button[type=submit]', form).forEach(function (b) { b.type = 'button'; b.addEventListener('click', run); });
    $$('input', form).forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } }); });
  }

  /* ---------------- toast ---------------- */
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 3200); }

  /* ---------------- routing ---------------- */
  var current = (function () { try { var h = location.hash.slice(1); return h.charAt(0) === '/' ? h : '/'; } catch (e) { return '/'; } })();
  function parse() { var h = current || '/'; var i = h.indexOf('?'); var path = i < 0 ? h : h.slice(0, i); var q = {}; if (i > -1) h.slice(i + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); }); return { path: path, q: q }; }
  function go(path) { current = path; render(); }
  function link(path) { return '#' + path; }
  var routes = {};
  function render() {
    var r = parse(); var fn = routes[r.path];
    if (typeof redirectFor === 'function') { var rd = redirectFor(r.path); if (rd) { current = rd; return render(); } }
    var m = r.path.match(/^\/locations\/(.+)$/); if (!fn && m) { fn = routes['/location']; r.q.slug = m[1]; }
    m = r.path.match(/^\/dashboard\/vo\/(\d+)$/); if (!fn && m) { fn = routes['/dashboard/vo']; r.q.id = m[1]; }
    m = r.path.match(/^\/admin\/rooms\/(.+)$/); if (!fn && m) { fn = routes['/admin/room']; r.q.id = m[1]; }
    m = r.path.match(/^\/admin\/centres\/(.+)$/); if (!fn && m) { fn = routes['/admin/centre']; r.q.key = m[1]; }
    m = r.path.match(/^\/success\/(\d+)$/); if (!fn && m) { fn = routes['/success']; r.q.id = m[1]; }
    if (!fn) fn = routes['/'];
    var out = fn(r.q, r.path);
    if (out === undefined || r.path !== parse().path) return;
    app.innerHTML = header(r.path) + '<main>' + out.html + '</main>' + footer();
    window.scrollTo(0, 0);
    bindChrome();
    if (out.init) out.init();
    if(CONNECTED){var payButton=$('#pay-btn');if(payButton&&parse().path.indexOf('/checkout')===0)payButton.textContent='Request booking — no payment taken';}
    if (typeof afterRender === 'function') afterRender(r.path, out);
  }
  // Every in-page link is handled here, so navigation works even where the
  // browser or a preview window blocks changes to the address bar.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (!a) return;
    e.preventDefault();
    go(a.getAttribute('href').slice(1));
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-lightbox]'); if (!b) return;
    var box = document.createElement('div'); box.className = 'lightbox';
    box.innerHTML = '<button type="button" class="btn btn-ghost btn-sm">Close</button><figure style="margin:0"><img alt=""><p></p></figure>';
    box.querySelector('img').src = b.dataset.src; box.querySelector('p').textContent = b.dataset.caption || '';
    box.addEventListener('click', function (k) { if (k.target === box || k.target.tagName === 'BUTTON') box.remove(); });
    document.body.appendChild(box);
  });
  // Typed or bookmarked #/… addresses still work where the browser allows them.
  window.addEventListener('hashchange', function () { try { var h = location.hash.slice(1); if (h.charAt(0) === '/' && h !== current) go(h); } catch (e) { /* ignore */ } });

  /* ---------------- chrome ---------------- */
  function header(path) {
    var u = me();
    var cityMenu = cities().map(function (c) { return '<span class="city">' + esc(c.city) + '</span>' + c.centres.map(function (x) { return '<a href="' + link('/locations/' + x.slug) + '"><b>' + esc(x.name) + '</b><span>' + esc(x.transit) + '</span></a>'; }).join(''); }).join('');
    return '<div class="demo-bar"><div class="wrap">Demo · runs in your browser · <b>demo@livance.co.in</b> / demo12345 · admin: <b>admin@livance.co.in</b> / admin12345 <button type="button" class="link" id="reset">Reset demo</button></div></div>' +
      '<header class="site-header"><div class="wrap"><a class="logo" href="#/"><b>Livance<i>.</i></b><span>Coworking</span></a>' +
      '<nav class="nav" aria-label="Main"><div class="menu"><button type="button">Workspaces</button><div class="panel">' +
      '<a href="#/day-pass"><b>Day pass</b><span>₹500 a day, walk in and work</span></a><a href="#/meeting-rooms"><b>Meeting rooms</b><span>₹100 per seat per hour, booked online</span></a>' +
      '<a href="#/dedicated-desk"><b>Dedicated desk</b><span>Your own desk, monthly</span></a><a href="#/virtual-office"><b>Virtual office</b><span>Address for GST and company registration</span></a></div></div>' +
      '<div class="menu"><button type="button">Locations</button><div class="panel">' + cityMenu + '<a href="#/locations" style="border-top:1px solid var(--line);margin-top:6px"><b>All locations</b></a></div></div>' +
      '<a href="#/virtual-office">Virtual Office</a><a href="#/contact">Contact</a></nav>' +
      '<div class="hdr-actions">' + (u ? '<a class="btn btn-ghost hide-m" href="' + (u.role === 'admin' ? '#/admin' : '#/dashboard') + '">' + (u.role === 'admin' ? 'Admin' : 'Dashboard') + '</a>' : '<a class="btn btn-ghost hide-m" href="#/login">Log in</a>') +
      '<a class="btn btn-primary" href="#/" data-book>Book now</a><button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><span></span></button></div></div>' +
      '<div class="mnav" id="mnav" hidden><div class="wrap"><a href="#/day-pass">Day pass</a><a href="#/meeting-rooms">Meeting rooms</a><a href="#/dedicated-desk">Dedicated desk</a><a href="#/virtual-office">Virtual office</a><a href="#/locations">Locations</a><a href="#/contact">Contact</a>' +
      (u ? '<a href="' + (u.role === 'admin' ? '#/admin' : '#/dashboard') + '">' + (u.role === 'admin' ? 'Admin' : 'Dashboard') + '</a>' : '<a href="#/login">Log in</a>') + '</div></div></header>';
  }
  function footer() {
    return '<footer class="site-footer"><div class="wrap"><div class="fgrid"><div class="col"><a class="logo" href="#/"><b>Livance<i style="color:var(--orange);font-style:normal">.</i></b></a><p>Virtual offices, day passes and meeting rooms at centres we run ourselves.</p><p class="xs">Livance Management Private Limited<br>CIN U63119HR2025PTC136252</p></div>' +
      '<div class="col"><h6>Workspaces</h6><a href="#/day-pass">Day pass · ₹500</a><a href="#/meeting-rooms">Meeting rooms</a><a href="#/dedicated-desk">Dedicated desk</a><a href="#/virtual-office">Virtual office</a></div>' +
      '<div class="col"><h6>Centres</h6>' + centres().map(function (c) { return '<a href="' + link('/locations/' + c.slug) + '">' + esc(c.name) + '</a>'; }).join('') + '</div>' +
      '<div class="col"><h6>Company</h6><a href="#/contact">Contact</a><a href="#/login">Member login</a><span class="xs">+91 87961 61489<br>hello@livance.co.in</span></div></div>' +
      '<div class="fbase"><span>© 2026 Livance Management Private Limited</span><span>Preview theme: <button class="link" data-theme-set="auto">Device</button> · <button class="link" data-theme-set="light">Light</button> · <button class="link" data-theme-set="dark">Dark</button></span></div></div></footer>';
  }
  function bindChrome() {
    var b = $('#burger'), m = $('#mnav');
    if (b) b.onclick = function () { m.hidden = !m.hidden; b.setAttribute('aria-expanded', String(!m.hidden)); };
    var resetButton=$('#reset'); if(resetButton){if(CONNECTED)resetButton.hidden=true;else resetButton.onclick=function(){store(KEY);seed();toast('Demo reset');go('/');};}
    var bk = $('[data-book]'); if (bk) bk.onclick = function (e) { e.preventDefault(); e.stopPropagation(); if (parse().path !== '/') go('/'); var f = $('#book'); if (f) f.scrollIntoView({ behavior: 'smooth' }); };
    $$('[data-theme-set]').forEach(function (x) { x.onclick = function () { var v = x.dataset.themeSet; if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v); }; });
  }
  function phOld(label, tone) { return '<figure class="photo wide"><div class="ph t' + (tone || 1) + '" role="img" aria-label="' + esc(label) + '"></div><figcaption>' + esc(label) + '</figcaption></figure>'; }
  function seg(items, current, base) { return '<nav class="seg">' + items.map(function (c) { return '<a href="' + link(base + c.key) + '" aria-current="' + (c.key === current) + '">' + esc(c.name) + '</a>'; }).join('') + '</nav>'; }
  function faq(list) { return '<div class="faq">' + list.map(function (f) { return '<details><summary>' + f[0] + '</summary><p>' + f[1] + '</p></details>'; }).join('') + '</div>'; }
  function pageHead(crumb, h1, lede, extra) { return '<section class="page-head"><div class="wrap"><div class="crumbs"><a href="#/">Home</a><span>›</span><span>' + crumb + '</span></div><h1>' + h1 + '</h1>' + (lede ? '<p class="lede">' + lede + '</p>' : '') + (extra || '') + '</div></section>'; }

  /* ---------------- public pages ---------------- */
  routes['/'] = function () {
    var cs = centres(), t = ist().date, opts = cs.map(function (c) { return '<option value="' + c.key + '">' + esc(c.name) + '</option>'; }).join('');
    var offers = db.coupons.filter(function (c) { return c.featured && c.active; }).slice(0, 2);
    var cityNames = cities().map(function (c) { return c.city.replace('New Delhi', 'Delhi'); });
    var hero = IMG['gh-reception.jpg'];
    var prods = [['flex', '/meeting-rooms', 'By the hour', 'Meeting rooms', '4 to 10 seats with a screen. Blocked the moment you pay.', 'from ₹400/hr', 'cc-meeting-room-b.jpg'], ['flex', '/day-pass', 'By the day', 'Day pass', 'Walk in, sit down, get to work. Wi-Fi and coffee included.', '₹500/day', 'cc-open-desks.jpg'],
      ['own', '/dedicated-desk', 'Monthly', 'Dedicated desk', 'The same desk every day, with meeting room hours.', 'from ₹7,000/mo', 'gh-workspace.jpg'], ['own', '/dedicated-desk', 'Monthly', 'Private cabin', 'A lockable glass cabin for your team.', 'On enquiry', 'gh-cabin.jpg'],
      ['biz', '/virtual-office', 'Yearly', 'Virtual office', 'A verifiable address with agreement, NOC and proofs.', 'from ₹12,000/yr', 'gh-lounge.jpg'], ['biz', '/virtual-office?plan=company', 'With CA assistance', 'Company or GST registration', 'Address plus a CA who files it for you.', 'from ₹15,000/yr', 'gh-boardroom.jpg']];
    var html = '<section class="hero2"><div class="wrap"><div class="hero-media">' + (hero ? '<img src="' + hero + '" alt="Reception at Livance Ghitorni">' : '<div class="ph-hero"></div>') + '<div class="hero-copy"><div class="eyebrow">' + esc(cities().map(function (c) { return c.city; }).join(' · ')) + '</div>' +
      '<h1>Coworking, meeting rooms and virtual offices in ' + esc(cityNames.length > 1 ? cityNames.slice(0, -1).join(', ') + ' and ' + cityNames[cityNames.length - 1] : cityNames[0]) + '</h1><p>Book a room by the hour, a desk for the day, or a GST-ready business address. Paid online, invoiced instantly.</p></div></div>' +
      '<div class="finder" id="book" data-tabs><div class="finder-tabs" role="tablist"><button role="tab" aria-selected="true" aria-controls="f-room">Meeting room</button><button role="tab" aria-selected="false" aria-controls="f-day">Day pass</button><button role="tab" aria-selected="false" aria-controls="f-vo">Virtual office</button><button role="tab" aria-selected="false" aria-controls="f-desk">Dedicated desk</button></div>' +
      '<form id="f-room" data-go="/meeting-rooms"><div class="field"><label>Centre</label><select name="centre">' + opts + '</select></div><div class="field"><label>Date</label><input type="date" name="date" min="' + t + '" value="' + t + '"></div><button class="btn btn-primary">See free slots</button><p class="note">₹100 per seat per hour · rooms from 4 to 10 seats</p></form>' +
      '<form id="f-day" data-go="/day-pass" hidden><div class="field"><label>Centre</label><select name="centre">' + opts + '</select></div><div class="field"><label>Date</label><input type="date" name="date" min="' + t + '" value="' + t + '"></div><button class="btn btn-primary">Book a day pass</button><p class="note">₹500 a day · Monday to Saturday, 9 AM to 7 PM</p></form>' +
      '<form id="f-vo" data-go="/virtual-office" hidden><div class="field"><label>Centre</label><select name="centre">' + opts + '</select></div><div class="field"><label>I need it for</label><select name="plan"><option value="address">Business Address</option><option value="gst" selected>GST Registration</option><option value="company">Company Registration</option></select></div><button class="btn btn-primary">See plans</button><p class="note">From ₹12,000 a year</p></form>' +
      '<form id="f-desk" data-go="/dedicated-desk" hidden><div class="field"><label>Centre</label><select name="centre">' + opts + '</select></div><button class="btn btn-primary">Book a tour</button><p class="note">Your own desk every day, monthly plans</p></form></div></div></section>' +
      '<section class="band"><div class="wrap"><div class="sec-head"><h2>Workspace for every way you work.</h2></div><div class="chips" data-filter><button type="button" aria-pressed="true" data-f="all">All</button><button type="button" aria-pressed="false" data-f="flex">By the hour or day</button><button type="button" aria-pressed="false" data-f="own">Your own space</button><button type="button" aria-pressed="false" data-f="biz">Business address</button></div><div class="g3">' +
      prods.map(function (p) { return '<a class="prod" data-cat="' + p[0] + '" href="' + link(p[1]) + '">' + photo(P(p[6], p[3])) + '<div class="prod-body"><span class="pill">' + p[2] + '</span><h3>' + p[3] + '</h3><p class="muted small">' + p[4] + '</p><span class="from">' + p[5] + '</span></div></a>'; }).join('') + '</div></div></section>' +
      '<section class="band alt"><div class="wrap"><div class="sec-head"><h2>Choose your city.</h2></div><div class="g' + Math.min(Math.max(cities().length, 2), 4) + '">' +
      cities().map(function (c, i) { return '<a class="city-tile" href="' + link(c.centres.length === 1 ? '/locations/' + c.centres[0].slug : '/locations') + '">' + photo((c.centres[0].photos || [])[0], '', i % 3 + 1) + '<div><b>' + esc(c.city) + '</b><span>' + c.centres.length + ' centre' + (c.centres.length > 1 ? 's' : '') + ' · ' + esc(c.centres.map(function (x) { return x.name.split(',')[0]; }).join(', ')) + '</span></div></a>'; }).join('') +
      '</div><div class="stats"><div><b>' + cs.length + '</b><span>Centres we run</span></div><div><b>' + cities().length + '</b><span>Cities</span></div><div><b>' + db.rooms.filter(function (r) { return r.active && centre(r.centre).active; }).length + '</b><span>Meeting rooms to book</span></div><div><b>' + cs.reduce(function (n, c) { return n + c.totalSeats; }, 0) + '</b><span>Open seats</span></div></div></div></section>' +
      (offers.length ? '<section class="band-sm"><div class="wrap ' + (offers.length > 1 ? 'g2' : 'narrow') + '">' + offers.map(function (o) { return '<div class="offer"><span class="eyebrow">Offer</span><h3>' + esc(o.desc) + '</h3><p class="small muted">Use code <code>' + o.code + '</code> at checkout.</p></div>'; }).join('') + '</div></section>' : '') +
      '<section class="band"><div class="wrap"><div class="sec-head"><h2>Why teams book Livance.</h2></div><div class="g4">' +
      [['Book any time', 'See live availability and book in under a minute.'], ['GST invoice instantly', 'Raised in Zoho Books and emailed the moment you pay.'], ['Run by us', 'Every centre is operated by Livance. No middlemen.'], ['Documents that verify', 'Real address, real NOC, checked by our own team.']]
        .map(function (v) { return '<div class="vp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg><h4>' + v[0] + '</h4><p>' + v[1] + '</p></div>'; }).join('') + '</div></div></section>' +
      '<section class="band alt"><div class="wrap narrow" style="text-align:center;display:grid;gap:18px;justify-items:center"><p style="color:var(--orange);letter-spacing:3px">★★★★★</p><p style="font:500 clamp(1.3rem,2.4vw,1.75rem)/1.4 var(--f-display)">“Clean interiors, premium setup, and excellent support from the management team.”</p><p class="muted small">Lucky Kumari · Google review</p></div></section>' +
      '<section class="band"><div class="wrap"><div class="sec-head"><h2>Questions.</h2></div>' + faq([['Can I book a meeting room if I am not a member?', 'Yes. Anyone can book online. Create an account at checkout, pay, and the room is blocked for you immediately.'], ['How is meeting room pricing worked out?', '₹100 per seat per hour plus GST. A 4-seat room is ₹400 an hour; a 10-seat boardroom is ₹1,000.'], ['Where do I find my invoice?', 'It is raised in Zoho Books, emailed to you, and kept in your dashboard.']]) + '</div></section>' +
      '<section class="band" style="padding-top:0"><div class="wrap"><div class="cta-photo">' + (IMG['gh-lounge.jpg'] ? '<img src="' + IMG['gh-lounge.jpg'] + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,15,28,.82),rgba(10,15,28,.35))"></div>' : '<div class="ph-hero"></div>') + '<div><h2>See it before you sign.</h2><p style="color:rgba(255,255,255,.85)">Book a free tour of any centre, or reserve a meeting room right now.</p><div class="row"><a class="btn btn-primary" href="#/dedicated-desk">Book a tour</a><a class="btn btn-ghost" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.4)" href="#/meeting-rooms">Book a room</a></div></div></div></div></section>';
    return { html: html, init: function () {
      var tabs = $$('.finder [role=tab]'); tabs.forEach(function (t) { t.onclick = function () { tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); document.getElementById(x.getAttribute('aria-controls')).hidden = x !== t; }); }; });
      $$('.finder form').forEach(function (f) { onSubmit(f, function () { var q = $$('select,input', f).map(function (i) { return i.name + '=' + encodeURIComponent(i.value); }).join('&'); go(f.dataset.go + '?' + q); }); });
      var bar = $('[data-filter]'); $$('button', bar).forEach(function (b) { b.onclick = function () { $$('button', bar).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); $$('[data-cat]').forEach(function (it) { it.hidden = b.dataset.f !== 'all' && it.dataset.cat !== b.dataset.f; }); }; });
    } };
  };

  routes['/meeting-rooms'] = function (q) {
    var ck = centre(q.centre) && centre(q.centre).active ? q.centre : centres()[0].key, rooms = roomsAt(ck);
    var st = { room: (rooms.filter(function (r) { return r.id === q.room; })[0] || rooms[0] || {}).id, date: q.date && !dateError(q.date) ? q.date : null, start: null, end: null };
    if (!st.date) { st.date = ist().date; while (dateError(st.date) || firstHour(st.date) >= CLOSE) st.date = addDays(st.date, 1); }
    var html = pageHead('Meeting rooms', 'Meeting rooms', '₹100 per seat per hour. Book online and the hours are blocked for you the moment you pay.', seg(centres(), ck, '/meeting-rooms?centre=')) +
      (rooms.length ? '<section class="band-sm" style="padding-top:8px"><div class="wrap split"><div class="stack-lg"><div class="stack"><h3>1. Choose a room</h3><div class="rooms">' +
        rooms.map(function (r) { var dots = '', rv = (db.reservations || []).filter(function (x) { return x.roomId === r.id && !x.ended && x.end >= ist().date; })[0], cover = imgSrc((r.photos || [])[0]); for (var i = 0; i < Math.min(r.seats, 12); i++) dots += '<i></i>';
          return '<button type="button" class="room" data-room="' + r.id + '" aria-pressed="' + (r.id === st.room) + '"><span class="room-ph">' + (cover ? '<img src="' + cover + '" alt="' + esc(r.name) + '">' : '') + '</span><span class="room-body"><span class="between"><b>' + esc(r.name) + '</b><span class="mono small">' + rs0(hourly(r)) + '/hr</span></span><span class="seats">' + dots + '</span><span class="small muted">' + r.seats + ' seats · ' + esc(r.features.join(', ')) + '</span>' + (rv ? '<span class="res">Reserved ' + (rv.start > ist().date ? 'from ' + fmtDay(rv.start) + ' ' : '') + 'until ' + fmtDay(rv.end) + '</span>' : '') + '</span></button>'; }).join('') +
        '</div></div><div id="mr-gallery"></div><div class="stack"><h3>2. Pick a date</h3><div class="field" style="max-width:260px"><input type="date" id="mr-date" value="' + st.date + '" min="' + ist().date + '" max="' + addDays(ist().date, 60) + '"></div><p class="small muted">Open Monday to Saturday, 9 AM to 7 PM.</p></div>' +
        '<div class="stack"><div class="between"><h3>3. Pick your time</h3><button type="button" class="link small" id="mr-clear" hidden>Clear</button></div><p class="small muted" id="mr-hint"></p><div class="alert info" id="mr-closed" hidden></div><div class="slots" id="mr-slots"></div><div class="legend"><span><i></i>Free</span><span><i class="l-sel"></i>Your booking</span><span><i class="l-off"></i>Booked or past</span></div></div></div>' +
        '<aside class="card summary"><span class="eyebrow">Your booking</span><div class="stack" style="gap:4px"><b id="s-room" style="font-size:1.08rem"></b><span class="small muted" id="s-when"></span></div><div class="sum-rows"><div><span id="s-calc"></span><span id="s-sub">—</span></div><div><span>GST 18%</span><span id="s-gst">—</span></div></div><div class="sum-total"><span>Total</span><b id="s-total">—</b></div><button class="btn btn-primary btn-block" id="mr-go" disabled>Continue</button><p class="xs muted">Free cancellation up to 24 hours before. 50% refund between 12 and 24 hours.</p></aside></div></section>'
        : '<section class="band-sm"><div class="wrap"><div class="card flat"><p class="muted">Meeting rooms at this centre open soon.</p></div></div></section>');
    return { html: html, init: function () {
      if (!rooms.length) return;
      function draw() {
        var a = availability(st.room, st.date), r = room(st.room), g = $('#mr-gallery');
        if (g.dataset.room !== r.id) { g.dataset.room = r.id; g.innerHTML = gallery(r.photos, '', 3); }
        $('#mr-closed').hidden = !a.closed; $('#mr-closed').textContent = a.closed || '';
        $('#mr-slots').innerHTML = a.hours.map(function (h) { var cls = 'slot' + (st.start !== null && h.hour >= st.start && h.hour <= st.end ? (h.hour === st.start || h.hour === st.end ? ' sel' : ' in') : ''); return '<button type="button" class="' + cls + '" data-h="' + h.hour + '"' + (h.status !== 'free' ? ' disabled' : '') + '>' + hh(h.hour) + '</button>'; }).join('');
        $('#s-room').textContent = r.name + ' · ' + r.seats + ' seats';
        $('#mr-clear').hidden = st.start === null;
        if (st.start === null) { $('#s-when').textContent = fmtDay(st.date) + ' · pick a time'; $('#s-calc').textContent = rs0(hourly(r)) + ' per hour'; ['#s-sub', '#s-gst', '#s-total'].forEach(function (x) { $(x).textContent = '—'; }); $('#mr-go').disabled = true; $('#mr-hint').textContent = 'Tap a start time, then tap the hour you want to finish in.'; }
        else { var n = st.end - st.start + 1, sub = hourly(r) * n, gg = Math.round(sub * .09) * 2; $('#s-when').textContent = fmtDay(st.date) + ' · ' + hh(st.start) + '–' + hh(st.end + 1); $('#s-calc').textContent = n + ' hr × ' + rs0(hourly(r)); $('#s-sub').textContent = rs(sub); $('#s-gst').textContent = rs(gg); $('#s-total').textContent = rs(sub + gg); $('#mr-go').disabled = false; $('#mr-hint').textContent = 'Tap a later hour to book longer.'; }
        st.a = a;
      }
      $('#mr-slots').onclick = function (e) {
        var b = e.target.closest('.slot'); if (!b || b.disabled) return; var h = +b.dataset.h;
        var free = function (f, t) { return st.a.hours.every(function (x) { return x.hour < f || x.hour > t || x.status === 'free'; }); };
        if (st.start === null || h < st.start || (st.start !== st.end && h !== st.end && h <= st.end)) st.start = st.end = h;
        else if (h === st.start && st.start === st.end) st.start = st.end = null;
        else if (free(st.start, h)) st.end = h; else st.start = st.end = h;
        draw();
      };
      $$('.room').forEach(function (b) { b.onclick = function () { $$('.room').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); st.room = b.dataset.room; st.start = st.end = null; draw(); }; });
      $('#mr-date').onchange = function (e) { if (e.target.value) { st.date = e.target.value; st.start = st.end = null; draw(); } };
      $('#mr-clear').onclick = function () { st.start = st.end = null; draw(); };
      $('#mr-go').onclick = function () { go('/checkout?product=meeting_room&roomId=' + st.room + '&date=' + st.date + '&start=' + st.start + '&hours=' + (st.end - st.start + 1)); };
      draw();
    } };
  };

  routes['/day-pass'] = function (q) {
    var ck = centre(q.centre) && centre(q.centre).active ? q.centre : centres()[0].key, days = passDays(ck);
    var sel = (days.filter(function (d) { return d.date === q.date && d.left; })[0] || days.filter(function (d) { return d.left; })[0] || {}).date, qty = 1;
    var html = pageHead('Day pass', 'Day pass', '₹500 for a full day, 9 AM to 7 PM. Wi-Fi, power backup, tea and coffee included.', seg(centres(), ck, '/day-pass?centre=')) +
      '<section class="band-sm" style="padding-top:8px"><div class="wrap split"><div class="stack-lg"><div class="stack"><h3>1. Choose a day</h3><div class="days">' +
      days.map(function (d) { var dt = new Date(d.date + 'T00:00:00Z'); return '<button type="button" class="day" data-date="' + d.date + '" data-left="' + d.left + '" aria-pressed="' + (d.date === sel) + '"' + (d.left ? '' : ' disabled') + '><span>' + dt.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }) + '</span><b>' + dt.getUTCDate() + '</b><span>' + dt.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }) + ' · ' + (d.left ? (d.left <= 3 ? d.left + ' left' : d.left + ' seats') : 'Full') + '</span></button>'; }).join('') +
      '</div></div><div class="stack"><h3>2. How many people?</h3><div class="qty"><button type="button" id="dp-m">−</button><output id="dp-q">1</output><button type="button" id="dp-p">+</button></div><p class="small muted">Seats shown are open seats minus desks held by monthly clients that day.</p></div>' +
      '<div class="stack"><h3>Where you\'ll sit</h3>' + gallery(byTag(ck, 'workspace', 'lounge', 'reception', 'pantry'), 'strip', 4) + '</div></div>' +
      '<aside class="card summary"><span class="eyebrow">Your day pass</span><div class="stack" style="gap:4px"><b>' + esc(centre(ck).name) + '</b><span class="small muted" id="dp-when"></span></div><div class="sum-rows"><div><span id="dp-c"></span><span id="dp-s"></span></div><div><span>GST 18%</span><span id="dp-g"></span></div></div><div class="sum-total"><span>Total</span><b id="dp-t"></b></div><button class="btn btn-primary btn-block" id="dp-go">Continue</button></aside></div></section>';
    return { html: html, init: function () {
      function draw() { var left = sel ? +$('.day[data-date="' + sel + '"]').dataset.left : 0; qty = Math.max(1, Math.min(qty, 5, left || 1)); $('#dp-q').textContent = qty; var sub = INR(500) * qty, g = Math.round(sub * .09) * 2; $('#dp-c').textContent = qty + ' × ₹500'; $('#dp-s').textContent = rs(sub); $('#dp-g').textContent = rs(g); $('#dp-t').textContent = rs(sub + g); $('#dp-when').textContent = sel ? fmtDay(sel) + ' · 9 AM – 7 PM' : 'Pick a day'; $('#dp-go').disabled = !sel; $('#dp-p').disabled = qty >= Math.min(5, left); $('#dp-m').disabled = qty <= 1; }
      $$('.day').forEach(function (b) { b.onclick = function () { $$('.day').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); sel = b.dataset.date; draw(); }; });
      $('#dp-p').onclick = function () { qty++; draw(); }; $('#dp-m').onclick = function () { qty--; draw(); };
      $('#dp-go').onclick = function () { go('/checkout?product=day_pass&centre=' + ck + '&date=' + sel + '&qty=' + qty); };
      draw();
    } };
  };

  function docsHtml(ck, plan) {
    return '<div class="docs" id="docs"><div class="stack"><div class="doc-tabs" role="tablist">' +
      [['lla', 'Leave & Licence Agreement', '11 months · e-signed'], ['noc', 'No Objection Certificate', 'GST / MCA consent'], ['bill', 'Utility Bill', 'Latest, under 2 months old'], ['tax', 'Property Tax Receipt', 'Current assessment year']].map(function (d, i) { return '<button class="doc-tab" role="tab" aria-selected="' + (i === 0) + '" data-doc="' + d[0] + '"><i class="ic"></i><b>' + d[1] + '</b><span>' + d[2] + '</span></button>'; }).join('') +
      '</div><div class="card flat form" style="padding:18px"><div class="field"><label>Your company or proposed name</label><input id="doc-co" value="Brightline Tech Private Limited" maxlength="120"></div><div class="field"><label>Plan</label><select id="doc-plan">' + Object.keys(PLANS).map(function (k) { return '<option value="' + k + '"' + (k === plan ? ' selected' : '') + '>' + PLANS[k].name + '</option>'; }).join('') + '</select></div></div></div><div class="viewer"><div class="page" id="doc-page"></div></div></div>';
  }
  function bindDocs(ck) {
    var c = centre(ck), cur = 'lla';
    var power = { Haryana: 'Dakshin Haryana Bijli Vitran Nigam (DHBVN)', Delhi: 'BSES Rajdhani Power Ltd' }[c.state] || c.state + ' electricity board';
    var civic = { Gurugram: 'Municipal Corporation Gurugram', 'New Delhi': 'Municipal Corporation of Delhi' }[c.city] || 'Municipal Corporation ' + c.city;
    var d0 = new Date(Date.now() + 330 * 6e4).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), CO = 'Livance Management Private Limited';
    var F = function (t) { return '<span class="fld">' + esc(t) + '</span>'; };
    var lh = '<div class="lh"><div><b>Livance<i>.</i></b><br>' + CO + '<br>CIN U63119HR2025PTC136252</div><div style="text-align:right">' + esc(c.name) + '<br>hello@livance.co.in</div></div>';
    function draw() {
      var co = esc($('#doc-co').value.trim() || 'Your Company Private Limited'), plan = $('#doc-plan').value, D = {
        lla: lh + '<h4>Leave and Licence Agreement</h4><div class="sub">Draft · Term 11 months</div><p>This Agreement is made on ' + F(d0) + ' between <b>' + CO + '</b> (the "Licensor") and ' + F(co) + ' (the "Licensee").</p><p><b>1. Premises.</b> The Licensor grants the Licensee a licence to use the premises at ' + F(c.address) + ' as its business address' + (plan === 'address' ? '.' : ' and principal place of business.') + '</p><p><b>2. Term.</b> 11 months from the date of activation, renewable by mutual consent.</p><p><b>3. Use.</b> ' + (plan === 'company' ? 'Registered office for incorporation under the Companies Act, 2013, and GST registration.' : plan === 'gst' ? 'Principal place of business for GST registration and correspondence.' : 'Correspondence and business address.') + ' No tenancy is created.</p><div class="sig"><div>For Licensor<br><b style="color:#1B2238">' + CO + '</b></div><div>For Licensee<br><b style="color:#1B2238">' + co + '</b></div></div>',
        noc: lh + '<h4>No Objection Certificate</h4><div class="sub">Draft · To whomsoever it may concern</div><p>We, <b>' + CO + '</b>, the lawful licensor of the premises at ' + F(c.address) + ', have no objection to ' + F(co) + ' using the premises as its ' + F(plan === 'company' ? 'registered office under the Companies Act, 2013' : 'principal place of business for GST registration') + '.</p><p>This consent is given under the Leave and Licence Agreement and remains valid for its term. The latest electricity bill and property tax receipt are enclosed.</p><div class="sig"><div>Authorised signatory<br><b style="color:#1B2238">' + CO + '</b></div><div>Place<br><b style="color:#1B2238">' + esc(c.city) + '</b></div></div>',
        bill: '<div class="lh"><div><b style="font-size:.95rem">' + esc(power) + '</b><br>Electricity bill · Non-domestic</div><div style="text-align:right">Latest month<br>Under 2 months old</div></div><h4>Electricity Bill</h4><div class="sub">Sample layout</div><table><tr><th>Consumer</th><td>' + CO + '</td></tr><tr><th>Supply address</th><td>' + esc(c.address) + '</td></tr><tr><th>Status</th><td>Paid</td></tr></table><p class="small" style="color:#55607A">Provided as address proof for ' + F(co) + '.</p>',
        tax: '<div class="lh"><div><b style="font-size:.95rem">' + esc(civic) + '</b><br>Property tax e-receipt</div><div style="text-align:right">Current assessment year</div></div><h4>Property Tax Receipt</h4><div class="sub">Sample layout</div><table><tr><th>Property address</th><td>' + esc(c.address) + '</td></tr><tr><th>Category</th><td>Commercial</td></tr><tr><th>Status</th><td>Paid in full</td></tr></table><p class="small" style="color:#55607A">Supports the NOC issued to ' + F(co) + '.</p>' };
      if (plan === 'address' && cur !== 'lla') D[cur] = '<div style="text-align:center;padding:40px 10px"><h4>Not included in Business Address</h4><p>The NOC, utility bill and tax receipt come with the GST Registration and Company Registration plans.</p></div>';
      $('#doc-page').innerHTML = D[cur];
      $$('.doc-tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.doc === cur)); });
    }
    $$('.doc-tab').forEach(function (t) { t.onclick = function () { cur = t.dataset.doc; draw(); }; });
    $('#doc-co').oninput = draw; $('#doc-plan').onchange = draw; draw();
  }

  routes['/virtual-office'] = function (q) {
    var ck = centre(q.centre) && centre(q.centre).active ? q.centre : centres()[0].key, plan = PLANS[q.plan] ? q.plan : 'gst', c = centre(ck);
    var cmpRows = [['Leave & licence agreement (11 months)', [1, 1, 1]], ['NOC with GST consent', [0, 1, 1]], ['NOC with MCA consent (registered office)', [0, 0, 1]], ['Latest utility bill (under 2 months old)', [0, 1, 1]], ['Property tax receipt', [0, 1, 1]], ['Support during GST officer verification', [0, 1, 1]], ['Mail and courier handling', [1, 1, 1]], ['Signage (A4, sunboard or metallic)', ['Add-on', 'Add-on', 'Add-on']], ['CA assistance', ['Add-on', 'Add-on', 'Add-on']]];
    var html = pageHead('Virtual office', 'Virtual office in ' + esc(c.city.replace('New Delhi', 'Delhi')) + '.', 'A verifiable business address for GST, company registration or correspondence. Same price at every centre.', seg(centres(), ck, '/virtual-office?plan=' + plan + '&centre=') + '<p class="small muted">' + esc(c.address) + '</p>') +
      '<section class="band-sm" style="padding-top:0"><div class="wrap">' + gallery(byTag(ck, 'reception', 'lounge', 'workspace').concat(byTag(ck, 'meeting')), '', 3) + '</div></section>' +
      '<section class="band-sm"><div class="wrap"><div class="sec-head"><h2>Choose your plan.</h2><p class="muted">Annual, on an 11-month agreement. GST shown before you pay.</p></div><div class="g3">' + Object.keys(PLANS).map(function (k) { var p = PLANS[k]; return '<article class="card" style="' + (k === plan ? 'border:2px solid var(--orange)' : '') + '"><div class="between"><h3>' + p.name + '</h3>' + (p.featured ? '<span class="pill or">Most chosen</span>' : '') + '</div><p class="muted small">' + p.desc + '</p><div class="price"><b class="mono">' + rs0(p.price) + '</b><span>/ year + GST</span></div><ul class="checks small">' + p.includes.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul><a class="btn ' + (k === plan ? 'btn-primary' : 'btn-ghost') + ' btn-block" href="' + link('/checkout-vo?centre=' + ck + '&plan=' + k) + '">Choose ' + p.name + '</a></article>'; }).join('') + '</div></div></section>' +
      '<section class="band alt"><div class="wrap"><div class="sec-head"><h2>Compare plans.</h2></div><div class="tbl"><table class="cmp" style="min-width:640px"><thead><tr><th>Included</th>' + Object.keys(PLANS).map(function (k) { return '<th class="c">' + PLANS[k].name + '</th>'; }).join('') + '</tr></thead><tbody>' +
        cmpRows.map(function (r) { return '<tr><td>' + r[0] + '</td>' + r[1].map(function (x) { return '<td class="c ' + (x === 1 ? 'y' : x === 0 ? 'n' : 'small muted') + '">' + (x === 1 ? '✓' : x === 0 ? '–' : x) + '</td>'; }).join('') + '</tr>'; }).join('') +
        '<tr class="row-price"><td>Price per year (+ GST)</td>' + Object.keys(PLANS).map(function (k) { return '<td class="c mono">' + rs0(PLANS[k].price) + '</td>'; }).join('') + '</tr></tbody></table></div></div></section>' +
      '<section class="band"><div class="wrap"><div class="sec-head"><h2>Preview your documents.</h2><p class="muted">Type your company name to see the drafts filled in. Your real documents are issued after KYC, signed and stamped.</p></div>' + docsHtml(ck, plan) + '</div></section>' +
      '<section class="band alt"><div class="wrap"><div class="sec-head"><h2>Your name on the wall.</h2><p class="muted">Add signage at checkout. GST officers often look for a name board during physical verification.</p></div><div class="field" style="max-width:380px;margin-bottom:22px"><label for="sign-name">See it with your name</label><input id="sign-name" placeholder="Your Business Pvt Ltd" maxlength="60"></div>' + signCards('show') +
        '<div class="card flat" style="margin-top:22px"><h3>What you get after paying</h3><ul class="checks">' + SIGN_INCLUDES.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></div></div></section>' +
      '<section class="band dark"><div class="wrap between"><h2>Your address, set up this week.</h2><a class="btn btn-primary" href="' + link('/checkout-vo?centre=' + ck + '&plan=' + plan) + '">Get started</a></div></section>';
    return { html: html, init: function () { bindDocs(ck); $('#sign-name').oninput = function () { var v = this.value.trim() || 'Your Business Pvt Ltd'; $$('[data-sign-name]').forEach(function (el) { el.textContent = v; }); }; } };
  };

  routes['/dedicated-desk'] = function (q) {
    var pics = []; centres().forEach(function (c) { pics = pics.concat(byTag(c.key, 'workspace', 'cabin')); });
    var html = pageHead('Dedicated desk', 'A desk that\'s yours, every day.', 'From ₹7,000 a month in Cyber City, Gurugram. Cabins and open seats at Ghitorni on enquiry.') +
      '<section class="band-sm" style="padding-top:0"><div class="wrap">' + gallery(pics, 'strip', 4) + '</div></section>' +
      '<section class="band-sm"><div class="wrap g2" style="align-items:start"><div class="stack"><h2>Book a tour.</h2><p class="muted">We\'ll confirm a time on WhatsApp within working hours.</p></div>' +
      '<form class="card form" id="lead"><div class="f2"><div class="field"><label>Full name</label><input name="name" required></div><div class="field"><label>Mobile</label><input name="phone" required></div></div><div class="field"><label>Centre</label><select name="centre">' + centres().map(function (c) { return '<option value="' + c.key + '"' + (c.key === q.centre ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div><button class="btn btn-primary btn-block">Request a tour</button><span class="err" id="lead-err" hidden></span></form></div></section>';
    return { html: html, init: function () { onSubmit($('#lead'), function (e) { var f = e.target; if (f.name.value.trim().length < 2 || !/^[6-9]\d{9}$/.test(f.phone.value.replace(/\D/g, '').slice(-10))) { $('#lead-err').hidden = false; $('#lead-err').textContent = 'Enter your name and a 10-digit mobile number.'; return; } db.leads.push({ name: f.name.value, phone: f.phone.value, centre: f.centre.value, at: ist().date }); save(); f.outerHTML = '<div class="card"><span class="pill gr">Request received</span><h3>Thanks. We\'ll message you shortly.</h3></div>'; }); } };
  };

  routes['/locations'] = function () {
    return { html: pageHead('Locations', 'Pick your centre.', 'Run by us, open Monday to Saturday, 9 AM to 7 PM.') + '<section class="band-sm" style="padding-top:8px"><div class="wrap g2">' + centres().map(function (c, i) { return '<article class="card" style="padding:0;overflow:hidden;gap:0">' + photo((c.photos || [])[0], 'wide', i % 3 + 1).replace('class="photo wide"', 'class="photo wide" style="border-radius:0"') + '<div class="stack" style="padding:26px"><h3>' + esc(c.name) + '</h3><p class="small muted">' + esc(c.address) + '</p><a class="btn btn-ghost" style="width:fit-content" href="' + link('/locations/' + c.slug) + '">View centre</a></div></article>'; }).join('') + '</div></section>' };
  };
  routes['/location'] = function (q) {
    var c = centres().filter(function (x) { return x.slug === q.slug; })[0]; if (!c) { go('/locations'); return; }
    return { html: pageHead(esc(c.name), 'Livance ' + esc(c.name.split(',')[0]), esc(c.blurb), '<div class="row"><a class="btn btn-primary" href="' + link('/meeting-rooms?centre=' + c.key) + '">Book a meeting room</a><a class="btn btn-ghost" href="' + link('/day-pass?centre=' + c.key) + '">Day pass · ₹500</a></div>') +
      '<section class="band-sm" style="padding-top:0"><div class="wrap stack-lg">' + gallery(c.photos, '', 3) + ((c.photos || []).length > 3 ? gallery(c.photos.slice(3), 'strip', 4) : '') + '</div></section>' +
      '<section class="band alt"><div class="wrap g2" style="align-items:start"><div class="stack"><h2>What\'s here.</h2><ul class="checks">' + c.amenities.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div><div class="card"><h3>Address and hours</h3><p class="muted small">' + esc(c.address) + '</p><div class="sum-rows"><div><span>Hours</span><span>Mon–Sat, 9–7</span></div><div><span>GST state</span><span style="font-family:inherit">' + esc(c.state) + '</span></div></div></div></div></section>' +
      '<section class="band"><div class="wrap"><div class="sec-head"><h2>Book here.</h2></div><div class="g3">' + roomsAt(c.key).map(function (r) { return '<a class="card card-link" style="padding:0;overflow:hidden;gap:0" href="' + link('/meeting-rooms?centre=' + c.key + '&room=' + r.id) + '">' + photo((r.photos || [])[0]).replace('class="photo ', 'style="border-radius:0" class="photo ') + '<div class="stack" style="padding:20px;gap:8px"><span class="pill">' + r.seats + ' seats</span><h3>' + esc(r.name) + '</h3><div class="price"><b class="mono" style="font-size:1.5rem">' + rs0(hourly(r)) + '</b><span>/ hour + GST</span></div></div></a>'; }).join('') + '</div></div></section>' };
  };
  routes['/contact'] = function () { return { html: pageHead('Contact', 'Talk to us.', 'Call or WhatsApp +91 87961 61489, or email hello@livance.co.in. We reply within working hours.') }; };

  /* ---------------- auth ---------------- */
  routes['/login'] = function (q) {
    var mode = q.mode === 'signup' ? 'signup' : 'login', next = q.next || '/dashboard';
    var html = '<section class="band-sm"><div class="wrap" style="max-width:480px"><div class="card" style="padding:clamp(26px,4vw,40px)"><nav class="seg"><a href="' + link('/login?next=' + encodeURIComponent(next)) + '" aria-current="' + (mode === 'login') + '">Log in</a><a href="' + link('/login?mode=signup&next=' + encodeURIComponent(next)) + '" aria-current="' + (mode === 'signup') + '">Create account</a></nav>' +
      (next.indexOf('/checkout') === 0 ? '<p class="alert info">Log in or create an account to finish booking. Your invoice and bookings will live in your dashboard.</p>' : '') + '<p class="alert error" id="a-err" hidden></p>' +
      (mode === 'login' ? '<form class="form" id="a-form"><div class="field"><label>Email</label><input type="email" name="email" placeholder="you@company.com"></div><div class="field"><label>Password</label><input type="password" name="password" placeholder="Enter password"></div><button class="btn btn-primary btn-block">Log in</button></form>'
        : '<form class="form" id="a-form"><div class="field"><label>Full name</label><input name="name"></div><div class="field"><label>Email</label><input type="email" name="email"><span class="hint">Invoices are sent here.</span></div><div class="field"><label>Mobile</label><input name="phone" placeholder="10-digit mobile"></div><div class="field"><label>Password</label><input type="password" name="password"><span class="hint">At least 10 characters.</span></div><button class="btn btn-primary btn-block">Create account</button></form>') + '</div></div></section>';
    return { html: html, init: function () {
      onSubmit($('#a-form'), function (e) {
        var f = e.target, err = $('#a-err'), email = f.email.value.trim().toLowerCase();
        if (CONNECTED) {
          if(mode==='signup' && (f.name.value.trim().length<2 || !/^[6-9]\d{9}$/.test(f.phone.value.replace(/\D/g,'').slice(-10)) || f.password.value.length<10)){err.hidden=false;err.textContent='Enter your name, valid 10-digit phone, and at least 10-character password.';return;}
          var submit=f.querySelector('button');submit.disabled=true;err.hidden=true;
          var promise = mode === 'login' ? BRIDGE.signIn(email,f.password.value) : BRIDGE.signUp({name:f.name.value.trim(),email:email,phone:f.phone.value,password:f.password.value});
          promise.then(function(result){
            if(result && result.needsVerification){err.hidden=false;err.className='alert info';err.textContent='Account created. Please verify your email, then log in.';return;}
            refreshLive(result?.role==='admin' && next==='/dashboard'?'/admin':next);
          }).catch(function(e){err.hidden=false;err.textContent=e.message||'Authentication failed';})
          .finally(function(){submit.disabled=false;});
          return;
        }
        var fail = function (m) { err.hidden = false; err.textContent = m; };
        if (mode === 'login') { var u = db.users.filter(function (x) { return x.email === email && x.password === f.password.value; })[0]; if (!u) return fail('That email and password don\'t match.'); db.session = u.id; }
        else {
          if (f.name.value.trim().length < 2) return fail('Enter your full name.');
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('Enter a valid email address.');
          if (!/^[6-9]\d{9}$/.test(f.phone.value.replace(/\D/g, '').slice(-10))) return fail('Enter a 10-digit Indian mobile number.');
          if (f.password.value.length < 10) return fail('Use at least 10 characters for your password.');
          if (db.users.some(function (x) { return x.email === email; })) return fail('An account with this email already exists. Log in instead.');
          var id = ++db.seq; db.users.push({ id: id, email: email, password: f.password.value, name: f.name.value.trim(), phone: f.phone.value, role: 'member' }); db.session = id;
        }
        save(); go(me().role === 'admin' && next === '/dashboard' ? '/admin' : next);
      });
    } };
  };
  function needUser(path) { if (!me()) { go('/login?next=' + encodeURIComponent(path)); return true; } return false; }
  function needAdmin() { if (!me() || me().role !== 'admin' || (CONNECTED && liveRole !== 'admin')) { go('/login?next=%2Fadmin'); toast('Sign in with your authorized Supabase administrator account'); return true; } return false; }

  /* ---------------- checkout (shared summary) ---------------- */
  function summaryHtml() {
    return '<aside class="card summary"><span class="eyebrow">Order summary</span><div class="sum-rows" id="q-rows"></div><div class="stack" style="gap:8px"><div class="coupon-row" id="cp-form"><input type="text" id="cp" placeholder="Discount code"><button class="btn btn-ghost btn-sm" type="button" id="cp-apply">Apply</button></div><div class="coupon-on" id="cp-on" hidden><span><b id="cp-code"></b></span><button type="button" class="link" id="cp-remove">Remove</button></div><span class="err" id="cp-err" hidden></span><span class="xs muted">Try LIVANCE10' + ' or FOUNDER2K</span></div><div class="sum-total"><span>Total</span><b id="q-total">—</b></div><button class="btn btn-primary btn-block" type="button" id="pay-btn">Pay</button><span class="err" id="pay-err" hidden></span><div class="secure"><i class="lock"></i>Razorpay in the live site. GST invoice raised in Zoho Books.</div></aside>';
  }
  // No state is asked: place of supply is the centre's state; with a GSTIN, its first two digits give the client's state.
  function gstinState(g) { g = String(g || '').toUpperCase(); if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return null; var s = STATES.filter(function (x) { return x[1] === g.slice(0, 2); })[0]; return s ? s[0] : null; }
  function billState() { var g = $('#b-gstin'); return g ? gstinState(g.value) : null; }
  function billingHtml(cState) {
    return '<div class="q" id="billing-wrap"><h3>Invoice details</h3><div class="f2"><div class="field"><label>Name on invoice</label><input id="b-name" value="' + esc(me().name) + '"><span class="hint">Your name or your company\'s legal name.</span></div><div class="field"><label>GSTIN <span class="soft">(optional, for input tax credit)</span></label><input id="b-gstin" maxlength="15" placeholder="06AAAAA0000A1Z5" style="text-transform:uppercase"></div></div><div class="field" id="b-addr-wrap" hidden><label>Registered address (as on your GST certificate)</label><textarea id="b-addr" rows="2" maxlength="300"></textarea></div><p class="small muted pos-note" id="b-pos">Place of supply: <b>' + esc(cState) + '</b>, where the centre is. GST is charged as CGST + SGST.</p><span class="err" id="b-err" hidden></span></div>';
  }
  function Summary(get) {
    var self = this; self.code = null; self.get = get;
    $('#cp-apply').onclick = function () { var c = $('#cp').value.trim().toUpperCase(); var o = get(); var qt = quote(o.product, o.params, c, billState()); if (qt.couponError) { $('#cp-err').hidden = false; $('#cp-err').innerHTML = qt.couponError; } else { self.code = c; $('#cp-err').hidden = true; } self.draw(); };
    $('#cp-remove').onclick = function () { self.code = null; $('#cp').value = ''; self.draw(); };
    var g = $('#b-gstin'); if (g) g.oninput = function () { g.value = g.value.toUpperCase().replace(/\s/g, ''); $('#b-addr-wrap').hidden = !g.value; if (g.value.length === 15 || !g.value) self.draw(); };
  }
  Summary.prototype.quote = function () { var o = this.get(); var q = quote(o.product, o.params, this.code, billState()); if (q.couponError) { this.code = null; q = quote(o.product, o.params, null, billState()); } return q; };
  Summary.prototype.draw = function () {
    var q = this.quote(), rows = q.lines.map(function (l) { return '<div><span>' + esc(l.desc) + '</span><span>' + rs(l.amount) + '</span></div>'; });
    if (q.termSaving) rows.push('<div class="neg"><span>Included multi-year saving</span><span>' + rs(q.termSaving) + '</span></div>');
    if (q.discount) rows.push('<div class="neg"><span>Code ' + q.coupon.code + '</span><span>− ' + rs(q.discount) + '</span></div>');
    rows.push('<div class="sep"><span>Taxable value</span><span>' + rs(q.taxable) + '</span></div>');
    if (q.cgst) rows.push('<div><span>CGST 9%</span><span>' + rs(q.cgst) + '</span></div><div><span>SGST 9%</span><span>' + rs(q.sgst) + '</span></div>');
    if (q.igst) rows.push('<div><span>IGST 18% (customer\'s state)</span><span>' + rs(q.igst) + '</span></div>');
    $('#q-rows').innerHTML = rows.join(''); $('#q-total').textContent = rs(q.total);
    $('#cp-form').hidden = !!q.coupon; $('#cp-on').hidden = !q.coupon; if (q.coupon) $('#cp-code').textContent = q.coupon.code + ' · ' + q.coupon.desc;
    var pos = $('#b-pos'); if (pos) pos.innerHTML = 'Place of supply: <b>' + esc(centre(q.centre).state) + '</b>, where the centre is. ' + (q.igst ? 'CA and mail services are billed to your GSTIN\'s state with IGST, on a separate invoice.' : 'GST is charged as CGST + SGST.');
    if (this.onDraw) this.onDraw(q);
    return q;
  };
  function billingOk() {
    var g = $('#b-gstin').value.trim().toUpperCase(), e = $('#b-err');
    if ($('#b-name').value.trim().length < 2) { e.hidden = false; e.textContent = 'Enter the name for the invoice.'; return null; }
    if (g && !gstinState(g)) { e.hidden = false; e.textContent = 'That GSTIN doesn\'t look right. It has 15 characters, like 06AAAAA0000A1Z5.'; return null; }
    if (g && !$('#b-addr').value.trim()) { e.hidden = false; e.textContent = 'A billing address is required on GST invoices.'; return null; }
    e.hidden = true; return { name: $('#b-name').value.trim(), state: gstinState(g) || null, gstin: g || null };
  }
  function pay(amount, done) {
    var m = $('#mock'); $('#mock-amt').textContent = rs(amount); m.hidden = false;
    if(CONNECTED) {
      var title=$('#mock-t');if(title)title.textContent='Request a booking — no payment is taken';
      $('#mock-pay').textContent='Send booking request';
    }
    $('#mock-pay').onclick = function () { m.hidden = true; done(); }; $('#mock-cancel').onclick = function () { m.hidden = true; };
  }
  function placeOrder(product, params, q, billing, extra) {
    if (product === 'meeting_room') { var a = availability(params.roomId, params.date); for (var h = params.start; h < params.start + params.hours; h++) { var s = a.hours.filter(function (x) { return x.hour === h; })[0]; if (!s || s.status !== 'free') { toast('Someone just booked one of those hours. Pick another slot.'); return null; } } }
    if (product === 'day_pass' && passesLeft(params.centre, params.date) < params.qty) { toast('Not enough day passes left for that date.'); return null; }
    if (CONNECTED) {
      BRIDGE.submitBooking({kind:product,params:params,centre:q.centre,total:q.total,billing:billing||{},business:extra&&extra.business}).then(function(result){
        db.bookings.unshift({id:BRIDGE.numericId(result.id),external_id:result.id,kind:product,centre:q.centre,roomId:params.roomId||null,date:params.date||null,start:params.start||null,end:params.start+params.hours||null,qty:params.qty||null,userId:me().id,status:'pending'});
        toast('Booking request saved. No payment has been taken.');go('/dashboard');
      }).catch(function(e){toast('Booking request failed: '+e.message);});
      return null;
    }
    if (billing && !billing.state) billing.state = centre(q.centre).state;
    var id = ++db.seq, o = { id: id, publicId: 'LV' + ist().date.slice(2).replace(/-/g, '') + '-' + String(id).padStart(5, '0'), userId: me().id, product: product, centre: q.centre, params: params, quote: q, total: q.total, status: 'paid', paidAt: ist().date, billing: billing, extra: extra || {} };
    db.orders.push(o);
    if (product === 'meeting_room') db.bookings.push({ id: ++db.seq, orderId: id, userId: me().id, kind: 'meeting_room', centre: q.centre, roomId: params.roomId, date: params.date, start: params.start, end: params.start + params.hours, status: 'confirmed' });
    if (product === 'day_pass') db.bookings.push({ id: ++db.seq, orderId: id, userId: me().id, kind: 'day_pass', centre: params.centre, date: params.date, qty: params.qty, status: 'confirmed', passCode: 'DP-' + Math.random().toString(36).slice(2, 8).toUpperCase() });
    if (product === 'virtual_office') db.vos.push({ id: ++db.seq, orderId: id, userId: me().id, centre: params.centre, plan: params.plan, months: params.months, business: extra.business, status: 'awaiting_kyc', kyc: {} });
    if (q.coupon) q.coupon.used++;
    raiseDocs(o, 'invoice');
    if (typeof afterOrder === 'function') afterOrder(o);
    save(); return o;
  }

  routes['/checkout'] = function (q, path) {
    if (needUser(current)) return;
    var product = q.product, params = product === 'meeting_room' ? { roomId: q.roomId, date: q.date, start: +q.start, hours: +q.hours } : { centre: q.centre, date: q.date, qty: +q.qty };
    var ck = params.centre || room(params.roomId).centre, r = params.roomId && room(params.roomId);
    var shot = r ? (r.photos || [])[0] : byTag(ck, 'workspace')[0];
    var html = '<section class="band-sm"><div class="wrap"><div class="stack" style="gap:8px;margin-bottom:28px"><h1 style="font-size:clamp(1.8rem,3.2vw,2.4rem)">Confirm and pay.</h1></div><div class="split"><div class="card" style="padding:clamp(22px,3vw,34px)"><div class="q"><h3>Your booking</h3>' + (imgSrc(shot) ? '<div style="border-radius:12px;overflow:hidden;max-height:240px">' + photo(shot, 'wide') + '</div>' : '') + '<div class="review">' +
      (r ? '<b>' + esc(r.name) + ' · ' + r.seats + ' seats</b><span class="muted">' + esc(centre(ck).name) + '</span><span>' + fmtDay(params.date) + ', ' + hh(params.start) + ' – ' + hh(params.start + params.hours) + ' (' + params.hours + ' hour' + (params.hours > 1 ? 's' : '') + ')</span>'
        : '<b>' + params.qty + ' day pass' + (params.qty > 1 ? 'es' : '') + '</b><span class="muted">' + esc(centre(ck).name) + '</span><span>' + fmtDay(params.date) + ', 9 AM – 7 PM</span>') +
      '</div></div>' + billingHtml(centre(ck).state) + '<div class="q"><label class="check"><input type="checkbox" id="agree"><span>I agree to the Terms and Refund Policy: 100% refund 24+ hours before, 50% at 12–24 hours, none after.</span></label><span class="err" id="agree-err" hidden>Accept the terms to continue.</span></div></div>' + summaryHtml() + '</div></div></section>';
    return { html: html, init: function () {
      var sm = new Summary(function () { return { product: product, params: params }; });
      sm.onDraw = function (qq) { $('#pay-btn').textContent = 'Pay ' + rs(qq.total) + ' securely'; };
      sm.draw();
      $('#agree').onchange = function () { $('#agree-err').hidden = true; };
      $('#pay-btn').onclick = function () { var b = billingOk(); if (!b) return; if (!$('#agree').checked) { $('#agree-err').hidden = false; return; } var qq = sm.quote(); pay(qq.total, function () { var o = placeOrder(product, params, qq, b); if (o) go('/success/' + o.id); }); };
    } };
  };

  routes['/checkout-vo'] = function (q) {
    if (needUser(current)) return;
    var step = 1, status = 'new';
    var html = '<section class="band-sm"><div class="wrap"><div class="between" style="margin-bottom:28px;align-items:flex-end"><h1 style="font-size:clamp(1.8rem,3.2vw,2.4rem)">Set up your virtual office.</h1><div class="stepper" id="stp"><span data-s="1"><i>1</i>Plan</span><span data-s="2"><i>2</i>Add-ons</span><span data-s="3"><i>3</i>Details</span><span data-s="4"><i>4</i>Pay</span></div></div><div class="split"><div class="card" style="padding:clamp(22px,3vw,34px)" id="vo">' +
      '<div data-step="1"><div class="q"><h3>Which centre?</h3><div class="choices two">' + centres().map(function (c) { return '<label class="choice"><input type="radio" name="centre" value="' + c.key + '"' + (c.key === (q.centre || centres()[0].key) ? ' checked' : '') + '><b>' + esc(c.name) + '</b><span class="amt">' + esc(c.state) + '</span><span class="d">' + esc(c.transit) + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="q"><h3>What\'s the address for?</h3><div class="choices">' + Object.keys(PLANS).map(function (k) { var p = PLANS[k]; return '<label class="choice"><input type="radio" name="plan" value="' + k + '"' + (k === (q.plan || 'gst') ? ' checked' : '') + '><b>' + p.name + '</b><span class="amt">' + rs0(p.price) + '/yr</span><span class="d">' + p.desc + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="q"><h3>How long?</h3><div class="choices two">' + TERMS.map(function (t) { return '<label class="choice"><input type="radio" name="months" value="' + t.months + '"' + (t.months === 12 ? ' checked' : '') + '><b>' + t.label + '</b><span class="amt" data-term="' + t.months + '"></span><span class="d">' + (t.pct ? 'Save ' + t.pct + '%, price locked for 2 years' : 'Standard term') + '</span></label>'; }).join('') + '</div></div></div>' +
      '<div data-step="2" hidden><div class="q"><div class="between"><h3>Signage</h3><button type="button" class="link small" id="sign-clear">No signage</button></div><p class="small muted">Pick one. The preview uses the business name you enter in the next step.</p>' + signCards('pick') + '<ul class="checks small">' + SIGN_INCLUDES.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></div><div class="q"><h3>Other add-ons</h3><div class="choices" id="adds"></div></div></div>' +
      '<div data-step="3" hidden><div class="q"><h3>Your business</h3><div class="seg" id="vst"><button type="button" data-v="new" aria-pressed="true">New business</button><button type="button" data-v="existing" aria-pressed="false">Already registered</button></div><div class="f2"><div class="field"><label id="vn-l">Proposed business name</label><input id="vn"></div><div class="field"><label>Entity type</label><select id="vt"><option>Private Limited</option><option>LLP</option><option>OPC</option><option>Partnership</option><option>Proprietorship</option></select></div></div><div class="field"><label>Name for signage and reception</label><input id="vs" placeholder="Same as business name"></div><span class="err" id="vn-err" hidden></span></div>' + billingHtml(centre(q.centre || centres()[0].key).state) + '</div>' +
      '<div data-step="4" hidden><div class="q"><h3>Review</h3><div class="stack" id="rv"></div></div><div class="q"><h3>After payment, keep these ready</h3><ul class="checks small" id="kyc"></ul></div><div class="q"><label class="check"><input type="checkbox" id="agree"><span>I agree to the Terms and Refund Policy, including the 24-hour cancellation window.</span></label><span class="err" id="agree-err" hidden>Accept the terms to continue.</span></div></div>' +
      '<div class="row" style="margin-top:8px"><button type="button" class="btn btn-ghost" id="back" hidden>Back</button><button type="button" class="btn btn-dark" id="next">Continue</button></div></div>' + summaryHtml() + '</div></div></section>';
    return { html: html, init: function () {
      var val = function (n) { var e = $('input[name="' + n + '"]:checked'); return e ? e.value : null; };
      var adds = function () { return $$('#adds input:checked, [data-signage]:checked').map(function (i) { return i.value; }); };
      var params = function () { return { centre: val('centre'), plan: val('plan'), months: +val('months'), addons: adds() }; };
      var sm = new Summary(function () { return { product: 'virtual_office', params: params() }; });
      sm.onDraw = function (qq) { $('#pay-btn').textContent = step < 4 ? 'Continue' : 'Pay ' + rs(qq.total) + ' securely'; };
      var first = true;
      function drawAdds() { var p = val('plan'), keep = adds(); $('#adds').innerHTML = ADDONS.filter(function (a) { return !a.group; }).map(function (a) { var on = !first && keep.indexOf(a.key) > -1; return '<label class="addon"><input type="checkbox" value="' + a.key + '"' + (on ? ' checked' : '') + '><div class="stack" style="gap:6px"><div class="row"><b>' + a.name + '</b>' + (a.tag ? '<span class="pill or">' + a.tag + '</span>' : '') + '</div><span class="small muted">' + a.desc(p) + '</span></div><div class="ap"><b class="mono">' + rs0(a.price(p)) + '</b><span>' + (a.perYear ? 'per year' : 'one-time') + '</span></div></label>'; }).join(''); first = false; }
      function drawTerms() { var p = PLANS[val('plan')]; $$('[data-term]').forEach(function (el) { var t = TERMS.filter(function (x) { return x.months === +el.dataset.term; })[0]; el.textContent = rs0(p.price * t.months / 12 * (100 - t.pct) / 100); }); }
      function show(n) { step = n; $$('#vo [data-step]').forEach(function (s) { s.hidden = +s.dataset.step !== n; }); $$('#stp span').forEach(function (s) { var i = +s.dataset.s; s.className = i < n ? 'done' : i === n ? 'cur' : ''; }); $('#back').hidden = n === 1; $('#next').hidden = n === 4; if (n === 4) review(); sm.draw(); }
      function review() { var p = params(), c = centre(p.centre), b = { name: $('#b-name').value, g: $('#b-gstin').value };
        $('#rv').innerHTML = '<div class="review"><b>' + PLANS[p.plan].name + ' · ' + p.months + ' months</b><span class="muted small">' + esc(c.address) + '</span></div><div class="review"><b>Add-ons</b><span class="muted small">' + (ADDONS.filter(function (a) { return p.addons.indexOf(a.key) > -1; }).map(function (a) { return a.name; }).join(', ') || 'None') + '</span></div><div class="review"><b>' + esc($('#vn').value) + ' · ' + esc($('#vt').value) + '</b><span class="muted small">Invoice to ' + esc(b.name) + (b.g ? ' · GSTIN ' + esc(b.g.toUpperCase()) : '') + '</span></div>';
        $('#kyc').innerHTML = KYC[p.plan].map(function (k) { return '<li>' + k + '</li>'; }).join(''); }
      function next() { if (step === 3) { if ($('#vn').value.trim().length < 2) { $('#vn-err').hidden = false; $('#vn-err').textContent = 'Enter the business name to print on your documents.'; return; } $('#vn-err').hidden = true; if (!billingOk()) return; } if (step < 4) show(step + 1); }
      $('#next').onclick = next; $('#back').onclick = function () { show(step - 1); };
      $$('#vst button').forEach(function (b) { b.onclick = function () { status = b.dataset.v; $$('#vst button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); $('#vn-l').textContent = status === 'new' ? 'Proposed business name' : 'Registered business name'; }; });
      $$('[data-signage]').forEach(function (cb) { cb.addEventListener('change', function () { if (cb.checked) $$('[data-signage]').forEach(function (o) { if (o !== cb) o.checked = false; }); }); });
      $('#sign-clear').onclick = function () { $$('[data-signage]').forEach(function (o) { o.checked = false; }); sm.draw(); };
      var signName = function () { var n = ($('#vs').value || $('#vn').value || '').trim() || 'Your Business Pvt Ltd'; $$('[data-sign-name]').forEach(function (el) { el.textContent = n; }); };
      $('#vn').oninput = signName; $('#vs').oninput = signName;
      $('#vo').onchange = function (e) { if (e.target.name === 'plan') { drawAdds(); drawTerms(); } sm.draw(); };
      $('#pay-btn').onclick = function () { if (step < 4) return next(); if (!$('#agree').checked) { $('#agree-err').hidden = false; return; } var b = billingOk(); if (!b) return show(3); var qq = sm.quote(); pay(qq.total, function () { var o = placeOrder('virtual_office', params(), qq, b, { business: $('#vn').value.trim(), entity: $('#vt').value, status: status }); if (o) go('/success/' + o.id); }); };
      drawAdds(); drawTerms(); show(1);
    } };
  };

  routes['/success'] = function (q) {
    var o = db.orders.filter(function (x) { return x.id === +q.id && me() && x.userId === me().id; })[0]; if (!o) { go('/dashboard'); return; }
    var b = db.bookings.filter(function (x) { return x.orderId === o.id; })[0], invs = db.invoices.filter(function (i) { return i.orderId === o.id && i.kind === 'invoice'; }), vo = db.vos.filter(function (v) { return v.orderId === o.id; })[0];
    var body = o.product === 'day_pass' ? '<div class="stack" style="gap:4px"><span class="eyebrow">Pass code</span><span class="pass">' + b.passCode + '</span></div><p class="muted small">Show this at reception on ' + fmtDay(b.date) + '.</p>'
      : o.product === 'meeting_room' ? '<div class="stack" style="gap:4px"><span class="eyebrow">Your room is blocked</span><b style="font-size:1.2rem">' + esc(room(b.roomId).name) + ' · ' + fmtDay(b.date) + ' · ' + hh(b.start) + '–' + hh(b.end) + '</b></div>'
        : '<div class="stack" style="gap:4px"><span class="eyebrow">Next step</span><b style="font-size:1.2rem">Upload your KYC documents</b></div><a class="btn btn-primary" style="width:fit-content" href="' + link('/dashboard/vo/' + vo.id) + '">Upload documents</a>';
    return { html: '<section class="band-sm"><div class="wrap" style="max-width:820px;display:grid;gap:26px"><div class="stack" style="gap:12px"><span class="pill gr">Payment received</span><h1 style="font-size:clamp(1.9rem,3.6vw,2.6rem)">You\'re booked, ' + esc(me().name.split(' ')[0]) + '.</h1></div><div class="card">' + body +
      '<div class="sum-rows" style="border-top:1px solid var(--line);padding-top:14px"><div><span>Order</span><span>' + o.publicId + '</span></div><div><span>Amount paid</span><span>' + rs(o.total) + '</span></div><div><span>Invoice emailed to</span><span style="font-family:inherit">' + esc(me().email) + '</span></div></div><div class="row">' +
      invs.map(function (i) { return '<button class="btn btn-ghost btn-sm" data-inv="' + i.id + '">Invoice ' + i.number + '</button>'; }).join('') + '<a class="btn btn-dark btn-sm" href="#/dashboard">Go to dashboard</a></div></div>' + (invs.length > 1 ? '<p class="small muted">Two invoices: workspace services are taxed in the centre\'s state, CA and mail services in your state.</p>' : '') + '</div></section>', init: bindInvoiceButtons };
  };

  /* ---------------- invoice viewer (stands in for the Zoho Books PDF) ---------------- */
  function invoiceHtml(d) {
    var c = centre(d.centre), intra = d.pos === c.state;
    return '<div class="zinv"><div class="between"><b style="font:700 1.3rem var(--f-display)">Livance<span style="color:#D9692A">.</span></b><div style="text-align:right"><b>' + (d.kind === 'invoice' ? 'TAX INVOICE' : 'CREDIT NOTE') + '</b><br><span class="mono">' + d.number + '</span></div></div>' +
      '<p class="small">Livance Management Private Limited · GSTIN <b class="mono">' + esc(c.gstin) + '</b><br>' + esc(c.address) + '</p>' +
      '<p class="small">Bill to: <b>' + esc(d.billing.name) + '</b>' + (d.billing.gstin ? ' · GSTIN ' + d.billing.gstin : ' · Unregistered') + ' · ' + esc(d.billing.state) + '<br>Date ' + d.issued + ' · Place of supply <b>' + esc(d.pos) + ' (' + STATE_CODE[d.pos] + ')</b></p>' +
      '<table><thead><tr><th>Item</th><th>SAC</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Taxable</th></tr></thead><tbody>' + d.lines.map(function (l) { return '<tr><td>' + esc(l.desc) + (l.discount ? '<br><span class="xs muted">Discount ' + rs(l.discount) + '</span>' : '') + '</td><td>' + l.sac + '</td><td class="num">' + l.qty + '</td><td class="num">' + rs(l.unit) + '</td><td class="num">' + rs(l.taxable) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="sum-rows" style="max-width:320px;margin-left:auto">' + (intra ? '<div><span>CGST 9%</span><span>' + rs(d.cgst) + '</span></div><div><span>SGST 9%</span><span>' + rs(d.sgst) + '</span></div>' : '<div><span>IGST 18%</span><span>' + rs(d.igst) + '</span></div>') + '<div class="sep"><span><b>Total</b></span><span><b>' + rs(d.total) + '</b></span></div></div>' +
      '<p class="xs muted">In the live site this document is created in Zoho Books (organisation and location set in Admin) and its PDF is emailed and saved to the dashboard.</p></div>';
  }
  function bindInvoiceButtons() { $$('[data-inv]').forEach(function (b) { b.onclick = function () { var d = db.invoices.filter(function (i) { return i.id === +b.dataset.inv; })[0]; $('#inv-body').innerHTML = invoiceHtml(d); $('#inv').hidden = false; }; }); }

  /* ---------------- dashboard ---------------- */
  function dash(tab, inner) {
    return '<div class="wrap dash"><nav class="dash-nav"><a href="#/dashboard" class="' + (tab === 'o' ? 'on' : '') + '">Overview</a><a href="#/dashboard/bookings" class="' + (tab === 'b' ? 'on' : '') + '">Bookings</a><a href="#/dashboard/invoices" class="' + (tab === 'i' ? 'on' : '') + '">Invoices</a><button class="link small" id="logout" style="padding:11px 14px;color:var(--muted);text-align:left">Log out</button></nav><div class="stack-lg" style="min-width:0">' + inner + '</div></div>';
  }
  function bindDash() { $('#logout').onclick = function () { db.session = null; if (CONNECTED) { liveRole=null; BRIDGE.signOut().catch(liveFail); } save(); go('/'); }; bindInvoiceButtons();
    $$('[data-cancel]').forEach(function (b) { b.onclick = function () { cancel(+b.dataset.cancel); }; }); }
  function bookingRow(b, cancellable) {
    var dt = new Date(b.date + 'T00:00:00Z'), up = b.status === 'confirmed' && epoch(b.date, b.kind === 'day_pass' ? OPEN : b.start) > Date.now(), r = b.roomId && room(b.roomId), pct = up ? refundPct(b) : 0;
    return '<div class="bk"><div class="date"><span>' + dt.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }) + '</span><b>' + dt.getUTCDate() + '</b><span>' + dt.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }) + '</span></div><div class="stack" style="gap:3px"><b>' + (r ? esc(r.name) + ' · ' + r.seats + ' seats' : b.qty + ' day pass' + (b.qty > 1 ? 'es' : '')) + '</b><span class="small muted">' + esc(centre(b.centre).name) + ' · ' + (r ? hh(b.start) + '–' + hh(b.end) : '9 AM – 7 PM') + '</span>' + (b.passCode && b.status === 'confirmed' ? '<span class="small">Pass code <b class="mono">' + b.passCode + '</b></span>' : '') + '</div>' +
      '<div class="act row" style="justify-content:flex-end">' + (b.status === 'cancelled' ? '<span class="pill rd">Cancelled</span>' : up ? (cancellable ? '<button class="btn btn-danger btn-sm" data-cancel="' + b.id + '" title="' + (pct === 100 ? 'Full refund' : pct === 50 ? '50% refund' : 'No refund') + '">Cancel · ' + pct + '% refund</button>' : '') + '<span class="pill gr">Confirmed</span>' : '<span class="pill">Completed</span>') + '</div></div>';
  }
  function cancel(id) {
    var b = db.bookings.filter(function (x) { return x.id === id; })[0], o = db.orders.filter(function (x) { return x.id === b.orderId; })[0], pct = refundPct(b);
    $('#confirm-text').textContent = pct === 100 ? 'Cancel this booking? You\'ll get a full refund of ' + rs(o.total) + ' and a credit note.' : pct === 50 ? 'Cancel this booking? It starts within 24 hours, so you\'ll get 50% back (' + rs(Math.round(o.total / 2)) + ').' : 'Cancel this booking? It starts within 12 hours, so no refund applies.';
    $('#confirm').hidden = false;
    $('#confirm-yes').onclick = function () { $('#confirm').hidden = true; b.status = 'cancelled'; o.status = pct === 100 ? 'refunded' : pct ? 'partially_refunded' : 'cancelled'; if (pct) raiseDocs(o, 'credit_note', pct); save(); toast(pct ? 'Cancelled. Refund of ' + rs(Math.round(o.total * pct / 100)) + ' started; credit note raised.' : 'Cancelled.'); render(); };
    $('#confirm-no').onclick = function () { $('#confirm').hidden = true; };
  }
  routes['/dashboard'] = function () {
    if (needUser('/dashboard')) return; var u = me(); if (u.role === 'admin') { go('/admin'); return; }
    var up = db.bookings.filter(function (b) { return b.userId === u.id && b.status === 'confirmed' && b.date >= ist().date; }).sort(function (a, b) { return (a.date + a.start) > (b.date + b.start) ? 1 : -1; });
    var vos = db.vos.filter(function (v) { return v.userId === u.id; }), invs = db.invoices.filter(function (i) { return i.userId === u.id; }).slice(-4).reverse();
    var steps = ['Paid', 'KYC uploaded', 'KYC approved', 'Agreement signed', 'Documents issued'], idx = { awaiting_kyc: 1, kyc_review: 2, documents_pending: 3, active: 5 };
    return { html: dash('o', '<div class="between"><h1 style="font-size:clamp(1.7rem,3vw,2.2rem)">Hi, ' + esc(u.name.split(' ')[0]) + '.</h1><div class="row"><a class="btn btn-ghost btn-sm" href="#/day-pass">Day pass</a><a class="btn btn-primary btn-sm" href="#/meeting-rooms">Book a room</a></div></div>' +
      vos.map(function (v) { var s = idx[v.status]; return '<a class="card card-link" href="' + link('/dashboard/vo/' + v.id) + '"><div class="between"><div class="stack" style="gap:2px"><span class="eyebrow">Virtual office</span><b style="font-size:1.1rem">' + esc(v.business) + '</b><span class="small muted">' + PLANS[v.plan].name + ' · ' + esc(centre(v.centre).name) + '</span></div><span class="pill ' + (v.status === 'awaiting_kyc' ? 'or' : v.status === 'active' ? 'gr' : 'am') + '">' + (v.status === 'awaiting_kyc' ? 'Upload KYC' : v.status === 'active' ? 'Active' : 'In progress') + '</span></div><div class="track">' + steps.map(function (x, i) { return '<div class="' + (i < s ? 'done' : i === s ? 'cur' : '') + '">' + x + '</div>'; }).join('') + '</div></a>'; }).join('') +
      '<div class="stack"><div class="between"><h3>Upcoming</h3><a class="link small" href="#/dashboard/bookings">All bookings</a></div>' + (up.length ? up.slice(0, 4).map(function (b) { return bookingRow(b, false); }).join('') : '<div class="card flat"><p class="muted">No upcoming bookings. Rooms start at ₹400 an hour, day passes at ₹500.</p></div>') + '</div>' +
      '<div class="stack"><div class="between"><h3>Recent invoices</h3><a class="link small" href="#/dashboard/invoices">All invoices</a></div>' + (invs.length ? '<div class="tbl"><table><tbody>' + invs.map(function (i) { return '<tr><td><b class="mono">' + i.number + '</b><br><span class="xs muted">' + (i.kind === 'invoice' ? 'Tax invoice' : 'Credit note') + ' · Zoho Books</span></td><td class="num">' + rs(i.total) + '</td><td class="num"><button class="link" data-inv="' + i.id + '">View</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="card flat"><p class="muted">Invoices appear here after your first payment.</p></div>') + '</div>'), init: bindDash };
  };
  routes['/dashboard/bookings'] = function () {
    if (needUser('/dashboard/bookings')) return; var u = me(), all = db.bookings.filter(function (b) { return b.userId === u.id; });
    var up = all.filter(function (b) { return b.status === 'confirmed' && b.date >= ist().date; }), past = all.filter(function (b) { return up.indexOf(b) < 0; });
    return { html: dash('b', '<h1 style="font-size:clamp(1.7rem,3vw,2.2rem)">Bookings</h1><div class="stack"><h3>Upcoming</h3>' + (up.length ? up.map(function (b) { return bookingRow(b, true); }).join('') : '<div class="card flat"><p class="muted">Nothing booked yet.</p></div>') + '</div>' + (past.length ? '<div class="stack"><h3>Past and cancelled</h3>' + past.map(function (b) { return bookingRow(b, false); }).join('') + '</div>' : '')), init: bindDash };
  };
  routes['/dashboard/invoices'] = function () {
    if (needUser('/dashboard/invoices')) return; var u = me(), invs = db.invoices.filter(function (i) { return i.userId === u.id; }).reverse();
    return { html: dash('i', '<h1 style="font-size:clamp(1.7rem,3vw,2.2rem)">Invoices</h1><p class="muted">Raised in Zoho Books and emailed to <b>' + esc(u.email) + '</b>.</p>' + (invs.length ? '<div class="tbl"><table><thead><tr><th>Number</th><th>Date</th><th>Place of supply</th><th class="num">Amount</th><th></th></tr></thead><tbody>' + invs.map(function (i) { return '<tr><td><b class="mono">' + i.number + '</b><br><span class="xs muted">' + (i.kind === 'invoice' ? 'Tax invoice' : 'Credit note') + '</span></td><td>' + i.issued + '</td><td>' + esc(i.pos) + '</td><td class="num">' + (i.kind === 'credit_note' ? '− ' : '') + rs(i.total) + '</td><td class="num"><button class="btn btn-ghost btn-sm" data-inv="' + i.id + '">View</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="card flat"><p class="muted">No invoices yet.</p></div>')), init: bindDash };
  };
  routes['/dashboard/vo'] = function (q) {
    if (needUser('/dashboard')) return; var v = db.vos.filter(function (x) { return x.id === +q.id && x.userId === me().id; })[0]; if (!v) { go('/dashboard'); return; }
    var req = KYC[v.plan];
    return { html: dash('o', '<h1 style="font-size:clamp(1.7rem,3vw,2.2rem)">' + esc(v.business) + '</h1><p class="muted">' + PLANS[v.plan].name + ' · ' + esc(centre(v.centre).name) + ' · ' + v.months + ' months</p>' +
      (v.status === 'kyc_review' ? '<p class="alert info">All documents received. Our team reviews them within one working day.</p>' : '') +
      '<div class="card"><h3>KYC documents</h3>' + req.map(function (k) { var f = v.kyc[k]; return '<div class="doc-row"><div class="stack" style="gap:2px"><b>' + k + '</b><span class="xs muted">' + (f ? esc(f) : 'Required') + '</span></div><label class="btn btn-ghost btn-sm" style="cursor:pointer">' + (f ? 'Replace' : 'Upload') + '<input type="file" data-kyc="' + k + '" accept="application/pdf,image/jpeg,image/png" hidden></label></div>'; }).join('') + '<p class="xs muted">In the live site files are checked by content, encrypted on the server and only seen by the verification team. This demo stores only the file name.</p></div>' +
      '<div class="card"><h3>Your documents</h3><p class="muted small">Your agreement, NOC, utility bill and property tax receipt appear here once KYC is approved.</p></div>'),
    init: function () { bindDash(); $$('[data-kyc]').forEach(function (i) { i.onchange = function () { if (!i.files[0]) return; v.kyc[i.dataset.kyc] = i.files[0].name; if (req.every(function (k) { return v.kyc[k]; })) v.status = 'kyc_review'; save(); toast('Uploaded'); render(); }; }); } };
  };

  /* ---------------- admin ---------------- */
  function admin(tab, inner) {
    return '<div class="admin-bar"><div class="wrap">' + [['home', '/admin', 'Overview'], ['seats', '/admin/seats', 'Seats & day passes'], ['orders', '/admin/orders', 'Orders'], ['rooms', '/admin/rooms', 'Meeting rooms'], ['centres', '/admin/centres', 'Centres'], ['zoho', '/admin/zoho', 'Zoho Books']].map(function (a) { return '<a href="' + link(a[1]) + '" class="' + (a[0] === tab ? 'on' : '') + '">' + a[2] + '</a>'; }).join('') + '<button class="link" id="alogout" style="margin-left:auto;color:#B4BDD2">Log out</button></div></div><div class="wrap stack-lg" style="padding-block:36px 80px">' + inner + '</div>';
  }
  function bindAdmin() { $('#alogout').onclick = function () { db.session = null; if (CONNECTED) { liveRole=null; BRIDGE.signOut().catch(liveFail); } save(); go('/'); }; }
  function schedule(date) {
    return db.centres.filter(function (c) { return c.active; }).map(function (c) {
      var hrs = []; for (var h = OPEN; h < CLOSE; h++) hrs.push(h);
      return '<div class="card" style="gap:12px"><div class="between"><h3>' + esc(c.name) + '</h3><span class="pill">Day passes: ' + passesSold(c.key, date) + ' / ' + capacity(c.key, date) + '</span></div><div class="tbl" style="border:0"><table class="sched"><thead><tr><th></th>' + hrs.map(function (h) { return '<th class="mono">' + hh(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        roomsAt(c.key).map(function (r) { var tk = taken(r.id, date); return '<tr><th style="text-align:left;white-space:nowrap">' + esc(r.name) + '<br><span class="xs muted">' + r.seats + ' seats</span></th>' + hrs.map(function (h) { var b = tk[h]; if (!b) return '<td></td>'; var u = db.users.filter(function (x) { return x.id === b.userId; })[0]; return '<td class="bk-c">' + esc(u ? u.name.split(' ')[0] : '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
    }).join('');
  }
  routes['/admin'] = function () {
    if (needAdmin()) return; var t = ist().date, paid = db.orders.filter(function (o) { return o.status !== 'cancelled'; });
    return { html: admin('home', '<h1 style="font-size:2rem">Today, ' + fmtDay(t) + '</h1><div class="g4"><div class="card stat"><span class="small muted">Revenue (demo)</span><b class="mono">' + rs0(paid.reduce(function (n, o) { return n + o.total; }, 0)) + '</b></div><div class="card stat"><span class="small muted">Paid orders</span><b>' + paid.length + '</b></div><div class="card stat"><span class="small muted">KYC to review</span><b>' + db.vos.filter(function (v) { return v.status === 'kyc_review'; }).length + '</b></div><div class="card stat"><span class="small muted">Tour requests</span><b>' + db.leads.length + '</b></div></div>' +
      '<div class="between"><h3>Room schedule</h3><input type="date" id="sd" value="' + t + '" style="width:auto"></div><div id="sched" class="stack-lg">' + schedule(t) + '</div>'), init: function () { bindAdmin(); $('#sd').onchange = function (e) { $('#sched').innerHTML = schedule(e.target.value); }; } };
  };
  routes['/admin/seats'] = function (q) {
    if (needAdmin()) return; var date = q.date || ist().date;
    return { html: admin('seats', '<div class="between"><div class="stack" style="gap:6px"><h1 style="font-size:2rem">Seats & day passes</h1><p class="muted">Day pass seats = open seats − seats held by desk clients that day. Override any single date if needed.</p></div><input type="date" id="sdate" value="' + date + '" style="width:auto"></div>' +
      db.centres.map(function (c) {
        var days = [], d = date; while (days.length < 7) { if (dow(d) !== 0) days.push(d); d = addDays(d, 1); }
        var ov = db.overrides[c.key + '|' + date];
        return '<div class="card"><div class="between"><h3>' + esc(c.name) + (c.active ? '' : ' <span class="pill">Draft</span>') + '</h3><span class="pill ' + (passesLeft(c.key, date) ? 'gr' : 'rd') + '">' + fmtDay(date) + ': ' + passesSold(c.key, date) + ' sold of ' + capacity(c.key, date) + '</span></div>' +
          '<div class="g4"><div class="field"><label>Open seats at centre</label><div class="row" style="flex-wrap:nowrap"><input type="number" min="0" value="' + c.totalSeats + '" data-total="' + c.key + '"><button class="btn btn-ghost btn-sm" data-save-total="' + c.key + '">Save</button></div></div><div class="stat"><span class="small muted">Held by desk clients</span><b>' + occupied(c.key, date) + '</b></div><div class="stat"><span class="small muted">Day pass seats' + (ov !== undefined ? ' (override)' : '') + '</span><b>' + capacity(c.key, date) + '</b></div>' +
          '<div class="field"><label>Override for ' + fmtDay(date) + '</label><div class="row" style="flex-wrap:nowrap"><input type="number" min="0" placeholder="Auto" value="' + (ov !== undefined ? ov : '') + '" data-ov="' + c.key + '"><button class="btn btn-ghost btn-sm" data-save-ov="' + c.key + '">Set</button></div></div></div>' +
          '<div class="tbl" style="border:0"><table class="sched"><thead><tr>' + days.map(function (x) { return '<th>' + fmtDay(x) + '</th>'; }).join('') + '</tr></thead><tbody><tr>' + days.map(function (x) { return '<td class="' + (passesLeft(c.key, x) ? '' : 'bk-h') + '">' + passesSold(c.key, x) + ' / ' + capacity(c.key, x) + '</td>'; }).join('') + '</tr></tbody></table></div>' +
          '<h4 style="font-size:1rem">Desk clients</h4>' + (db.deskClients.filter(function (k) { return k.centre === c.key && (!k.end || k.end >= ist().date); }).map(function (k) { return '<div class="doc-row"><span><b>' + esc(k.name) + '</b> · ' + k.seats + ' seats · from ' + fmtDay(k.start) + '</span><button class="btn btn-danger btn-sm" data-end="' + k.id + '">End</button></div>'; }).join('') || '<p class="small muted">No desk clients.</p>') +
          '<div class="g4" style="align-items:end"><div class="field"><label>Client</label><input data-cn="' + c.key + '" placeholder="Brightline Tech"></div><div class="field"><label>Seats</label><input type="number" min="1" data-cs="' + c.key + '" placeholder="4"></div><div class="field"><label>From</label><input type="date" data-cf="' + c.key + '" value="' + date + '"></div><button class="btn btn-dark btn-sm" style="width:fit-content" data-add="' + c.key + '">Add desk client</button></div></div>';
      }).join('')),
    init: function () {
      bindAdmin(); var re = function () { save(); render(); };
      $('#sdate').onchange = function (e) { go('/admin/seats?date=' + e.target.value); };
      $$('[data-save-total]').forEach(function (b) { b.onclick = function () { var c = centre(b.dataset.saveTotal); c.totalSeats = Math.max(0, +$('[data-total="' + c.key + '"]').value || 0); toast('Saved'); re(); }; });
      $$('[data-save-ov]').forEach(function (b) { b.onclick = function () { var k = b.dataset.saveOv + '|' + date, v = $('[data-ov="' + b.dataset.saveOv + '"]').value; if (v === '') delete db.overrides[k]; else db.overrides[k] = Math.max(0, +v); toast('Saved'); re(); }; });
      $$('[data-end]').forEach(function (b) { b.onclick = function () { db.deskClients.forEach(function (k) { if (k.id === +b.dataset.end) k.end = addDays(ist().date, -1); }); toast('Ended. Seats return to the day pass pool.'); re(); }; });
      $$('[data-add]').forEach(function (b) { b.onclick = function () { var k = b.dataset.add, n = $('[data-cn="' + k + '"]').value.trim(), s = +$('[data-cs="' + k + '"]').value; if (n.length < 2 || !s) return toast('Enter the client name and seats.'); db.deskClients.push({ id: ++db.seq, centre: k, name: n, seats: s, start: $('[data-cf="' + k + '"]').value || ist().date, end: null }); toast('Added. Day pass seats reduced by ' + s + '.'); re(); }; });
    } };
  };
  routes['/admin/orders'] = function () {
    if (needAdmin()) return;
    return { html: admin('orders', '<h1 style="font-size:2rem">Orders</h1><div class="tbl"><table><thead><tr><th>Order</th><th>Customer</th><th>What</th><th>Invoices (Zoho)</th><th class="num">Total</th></tr></thead><tbody>' + (db.orders.slice().reverse().map(function (o) { var u = db.users.filter(function (x) { return x.id === o.userId; })[0]; return '<tr><td class="mono">' + o.publicId + '</td><td>' + esc(u.name) + '<br><span class="xs muted">' + esc(u.email) + '</span></td><td class="small">' + o.product.replace('_', ' ') + ' · ' + esc(centre(o.centre).short) + '</td><td>' + db.invoices.filter(function (i) { return i.orderId === o.id; }).map(function (i) { return '<button class="link mono small" data-inv="' + i.id + '">' + i.number + '</button>'; }).join('<br>') + '</td><td class="num">' + rs(o.total) + '</td></tr>'; }).join('') || '<tr><td colspan="5" class="muted">No orders yet. Book something as demo@livance.co.in.</td></tr>') + '</tbody></table></div>'), init: function () { bindAdmin(); bindInvoiceButtons(); } };
  };
  routes['/admin/centres'] = function () {
    if (needAdmin()) return;
    return { html: admin('centres', '<div class="between"><div class="stack" style="gap:6px"><h1 style="font-size:2rem">Centres</h1><p class="muted">Open a new centre here. It appears across the website, booking and invoicing as soon as it\'s live.</p></div><a class="btn btn-primary" href="#/admin/centres/new">Add a centre</a></div><div class="tbl"><table><thead><tr><th>Centre</th><th>State · GSTIN</th><th>Zoho location</th><th class="num">Rooms</th><th>Status</th></tr></thead><tbody>' +
      db.centres.map(function (c) { return '<tr><td><a class="link" href="' + link('/admin/centres/' + c.key) + '">' + esc(c.name) + '</a></td><td class="small">' + esc(c.state) + '<br><span class="mono">' + esc(c.gstin || '—') + '</span></td><td class="mono small">' + esc(c.zoho || '—') + '</td><td class="num">' + roomsAt(c.key).length + '</td><td>' + (c.active ? '<span class="pill gr">Live</span>' : '<span class="pill">Draft</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>'), init: bindAdmin };
  };
  routes['/admin/centre'] = function (q) {
    if (needAdmin()) return; var isNew = q.key === 'new', c = isNew ? { key: '', name: '', short: '', city: '', state: 'Karnataka', address: '', transit: '', blurb: '', gstin: '', zoho: '', totalSeats: 20, active: false, amenities: [] } : centre(q.key);
    if (!c) { go('/admin/centres'); return; }
    var f = function (id, label, val, hint, attrs) { return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" value="' + esc(val) + '" ' + (attrs || '') + '>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>'; };
    return { html: admin('centres', '<div class="crumbs"><a href="#/admin/centres">Centres</a><span>›</span><span>' + (isNew ? 'New centre' : esc(c.name)) + '</span></div><h1 style="font-size:1.9rem">' + (isNew ? 'Add a centre' : esc(c.name)) + '</h1><p class="alert error" id="ce" hidden></p>' +
      '<div class="card form"><h3>Details</h3><div class="f2">' + f('c-name', 'Centre name', c.name, 'e.g. "Koramangala, Bengaluru"') + f('c-short', 'Short name', c.short) + '</div><div class="f2">' + f('c-city', 'City', c.city) + '<div class="field"><label for="c-state">State</label><select id="c-state">' + STATES.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === c.state ? ' selected' : '') + '>' + s[0] + ' (' + s[1] + ')</option>'; }).join('') + '</select><span class="hint">Decides CGST + SGST on bookings here.</span></div></div>' +
      f('c-addr', 'Full address', c.address, 'Printed on agreements, NOCs and invoices.') + '<div class="f2">' + f('c-gstin', 'GSTIN for this state', c.gstin, 'Must start with the state code.', 'maxlength="15" style="text-transform:uppercase"') + f('c-zoho', 'Zoho Books location ID', c.zoho, 'The Zoho location that carries this GSTIN.') + '</div>' +
      '<div class="f2">' + f('c-seats', 'Open seats for day passes', c.totalSeats, 'Desk clients\' seats are subtracted automatically.', 'type="number" min="0"') + f('c-transit', 'Getting there', c.transit) + '</div>' +
      '<label class="check"><input type="checkbox" id="c-live"' + (c.active ? ' checked' : '') + '><span><b>Live on website.</b> Shows in navigation, locations, booking and invoicing.</span></label><button class="btn btn-dark" style="width:fit-content" id="c-save">' + (isNew ? 'Create centre' : 'Save') + '</button></div>' +
      (isNew ? '' : '<div class="card"><h3>Photos</h3>' + photoAdmin(c.photos = c.photos || [], true) + '</div>') +
      (isNew ? '' : '<div class="card"><div class="between"><h3>Meeting rooms</h3><a class="link small" href="#/admin/rooms">Manage photos and reservations</a></div><p class="small muted">Price is automatic: ₹100 per seat per hour.</p>' + db.rooms.filter(function (r) { return r.centre === c.key; }).map(function (r) { return '<div class="doc-row"><span><b>' + esc(r.name) + '</b> · ' + r.seats + ' seats · ' + rs0(hourly(r)) + '/hr</span><span class="pill ' + (r.active ? 'gr' : '') + '">' + (r.active ? 'Bookable' : 'Off') + '</span></div>'; }).join('') +
        '<div class="g4" style="align-items:end"><div class="field"><label>New room</label><input id="r-name" placeholder="Boardroom"></div><div class="field"><label>Seats</label><input id="r-seats" type="number" min="1" max="100" placeholder="8"></div><div></div><button class="btn btn-dark btn-sm" style="width:fit-content" id="r-add">Add room</button></div></div>')),
    init: function () {
      bindAdmin();
      $('#c-save').onclick = function () {
        var g = $('#c-gstin').value.trim().toUpperCase(), st = $('#c-state').value, e = $('#ce'), errs = [];
        var v = { name: $('#c-name').value.trim(), short: $('#c-short').value.trim(), city: $('#c-city').value.trim(), state: st, address: $('#c-addr').value.trim(), gstin: g, zoho: $('#c-zoho').value.trim(), totalSeats: Math.max(0, +$('#c-seats').value || 0), transit: $('#c-transit').value.trim(), active: $('#c-live').checked };
        if (v.name.length < 3 || !v.short || !v.city) errs.push('Enter the centre name, short name and city.');
        if (v.address.length < 10) errs.push('Enter the full address.');
        if (g && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) errs.push('That GSTIN doesn\'t look right (15 characters).');
        else if (g && g.slice(0, 2) !== STATE_CODE[st]) errs.push('This GSTIN is registered in another state. ' + st + ' GSTINs start with ' + STATE_CODE[st] + '.');
        if (v.active && !g) errs.push('Add the GSTIN before going live.');
        if (v.active && !v.zoho) errs.push('Add the Zoho Books location before going live, so invoices carry this GSTIN.');
        if (v.active && !isNew && !roomsAt(c.key).length) errs.push('Add at least one meeting room before going live.');
        if (v.active && isNew) errs.push('Create the centre first, add rooms, then tick "Live on website".');
        if (errs.length) { e.hidden = false; e.textContent = errs.join(' '); window.scrollTo(0, 0); return; }
        if (isNew) { var key = (v.short + '-' + v.city).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30); var slug = v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); db.centres.push(Object.assign({ key: key, slug: slug, voSlug: v.city.toLowerCase().replace(/^new /, '').replace(/[^a-z0-9]+/g, '-'), blurb: 'Our newest centre in ' + v.city + '.', amenities: ['Meeting rooms', 'Reception and mail handling', 'High-speed Wi-Fi'], deskFrom: null }, v)); save(); toast('Centre created as a draft. Add rooms, then go live.'); go('/admin/centres/' + key); return; }
        Object.assign(c, v); save(); toast(v.active ? 'Saved. Live on the website now.' : 'Saved.'); render();
      };
      if (!isNew) bindPhotoAdmin(c.photos, true, function (m) { save(); toast(m); render(); });
      var ra = $('#r-add'); if (ra) ra.onclick = function () { var n = $('#r-name').value.trim(), s = +$('#r-seats').value; if (n.length < 2 || !(s >= 1 && s <= 100)) return toast('Enter a room name and 1–100 seats.'); db.rooms.push({ id: c.key + '-' + (++db.seq), centre: c.key, name: n, seats: s, features: ['TV screen'], active: true, photos: [] }); save(); toast('Room added at ' + rs0(s * 100) + '/hr'); render(); };
    } };
  };

  function readPhoto(file, cb) {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Choose a JPG, PNG or WebP photo.');
    var fr = new FileReader(); fr.onload = function () { var im = new Image(); im.onload = function () { var w = Math.min(1100, im.width), h = Math.round(im.height * w / im.width), cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(im, 0, 0, w, h); cb(cv.toDataURL('image/jpeg', 0.72)); }; im.src = fr.result; }; fr.readAsDataURL(file);
  }
  function photoAdmin(list, withTag) {
    return '<div class="ph-admin">' + (list || []).map(function (p, i) { return '<div class="ph-item">' + photo(p) + '<div class="row" style="gap:6px;padding:8px;flex-wrap:wrap">' + (i === 0 ? '<span class="pill gr">Cover</span>' : '<button class="btn btn-ghost btn-sm" data-cover="' + i + '">Make cover</button>') +
      (withTag ? '<select data-tag="' + i + '" style="width:auto;padding:4px 8px">' + Object.keys(TAGS).map(function (t) { return '<option value="' + t + '"' + (t === p.tag ? ' selected' : '') + '>' + TAGS[t] + '</option>'; }).join('') + '</select>' : '') +
      '<button class="btn btn-danger btn-sm" data-rm="' + i + '">Remove</button></div></div>'; }).join('') + '</div>' +
      '<div class="row" style="align-items:end">' + (withTag ? '<div class="field"><label>Shows on</label><select id="up-tag">' + Object.keys(TAGS).map(function (t) { return '<option value="' + t + '">' + TAGS[t] + '</option>'; }).join('') + '</select></div>' : '') + '<div class="field"><label>Caption</label><input id="up-cap" placeholder="e.g. 10-seat boardroom"></div><label class="btn btn-dark btn-sm" style="cursor:pointer">Upload photo<input type="file" id="up-file" accept="image/jpeg,image/png,image/webp" hidden></label></div>' +
      '<p class="xs muted">' + (withTag ? 'The tag decides where a photo shows: day pass uses open seats, lounge, reception and pantry; virtual office uses reception, lounge and meeting rooms.' : 'The cover shows on the room card and at checkout.') + ' In the live site photos are checked and resized on the server.</p>';
  }
  function bindPhotoAdmin(list, withTag, done) {
    $$('[data-cover]').forEach(function (b) { b.onclick = function () { var i = +b.dataset.cover; list.unshift(list.splice(i, 1)[0]); done('Cover updated'); }; });
    $$('[data-rm]').forEach(function (b) { b.onclick = function () { list.splice(+b.dataset.rm, 1); done('Photo removed'); }; });
    $$('[data-tag]').forEach(function (sl) { sl.onchange = function () { list[+sl.dataset.tag].tag = sl.value; done('Tag saved'); }; });
    $('#up-file').onchange = function (e) { readPhoto(e.target.files[0], function (url) { list.push({ src: url, caption: $('#up-cap').value.trim() || 'Livance', tag: withTag ? $('#up-tag').value : 'meeting' }); done('Photo added'); }); };
  }
  routes['/admin/rooms'] = function () {
    if (needAdmin()) return; var t = ist().date;
    return { html: admin('rooms', '<div class="stack" style="gap:6px"><h1 style="font-size:2rem">Meeting rooms</h1><p class="muted">Add rooms, manage their photos, and reserve a room for a client taking it monthly. Reserved dates show as unavailable on the website.</p></div>' +
      '<div class="tbl"><table><thead><tr><th>Room</th><th>Centre</th><th class="num">Seats</th><th class="num">Price</th><th>Photos</th><th>Status</th></tr></thead><tbody>' +
      db.rooms.map(function (r) { var rv = (db.reservations || []).filter(function (x) { return x.roomId === r.id && !x.ended && x.end >= t; })[0]; return '<tr><td><a class="link" href="' + link('/admin/rooms/' + r.id) + '">' + esc(r.name) + '</a></td><td class="small">' + esc(centre(r.centre).name) + '</td><td class="num">' + r.seats + '</td><td class="num mono">' + rs0(hourly(r)) + '/hr</td><td class="small">' + (r.photos || []).length + '</td><td>' + (!r.active ? '<span class="pill">Off</span>' : rv ? '<span class="pill am">Reserved to ' + fmtDay(rv.end) + '</span>' : '<span class="pill gr">Bookable</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="card form"><h3>Add a meeting room</h3><div class="g4" style="align-items:end"><div class="field"><label>Centre</label><select id="nr-c">' + db.centres.map(function (c) { return '<option value="' + c.key + '">' + esc(c.name) + '</option>'; }).join('') + '</select></div><div class="field"><label>Room name</label><input id="nr-n" placeholder="Boardroom 2"></div><div class="field"><label>Seats</label><input id="nr-s" type="number" min="1" max="100" placeholder="8"></div><div class="field"><label>Features</label><input id="nr-f" placeholder="TV screen, Whiteboard"></div></div><p class="small muted">Price is automatic: ₹100 per seat per hour.</p><button class="btn btn-dark" style="width:fit-content" id="nr-go">Add room</button></div>'),
      init: function () { bindAdmin(); $('#nr-go').onclick = function () { var n = $('#nr-n').value.trim(), s = +$('#nr-s').value, c = $('#nr-c').value; if (n.length < 2 || !(s >= 1 && s <= 100)) return toast('Enter a room name and 1–100 seats.'); var id = c + '-' + (++db.seq); db.rooms.push({ id: id, centre: c, name: n, seats: s, features: ($('#nr-f').value || 'TV screen').split(',').map(function (x) { return x.trim(); }).filter(Boolean), active: true, photos: [] }); save(); toast('Room added at ' + rs0(s * 100) + '/hr. Add photos next.'); go('/admin/rooms/' + id); }; } };
  };
  routes['/admin/room'] = function (q) {
    if (needAdmin()) return; var r = room(q.id); if (!r) { go('/admin/rooms'); return; } r.photos = r.photos || []; db.reservations = db.reservations || [];
    var t = ist().date, rvs = db.reservations.filter(function (x) { return x.roomId === r.id && !x.ended && x.end >= t; });
    var hrs = ''; for (var h = OPEN; h <= CLOSE; h++) hrs += '<option value="' + h + '">' + hh(h) + '</option>';
    return { html: admin('rooms', '<div class="crumbs"><a href="#/admin/rooms">Meeting rooms</a><span>›</span><span>' + esc(r.name) + '</span></div><h1 style="font-size:1.9rem">' + esc(r.name) + '</h1>' +
      '<div class="card form"><h3>Details</h3><div class="g4" style="align-items:end"><div class="field"><label>Name</label><input id="rm-n" value="' + esc(r.name) + '"></div><div class="field"><label>Seats</label><input id="rm-s" type="number" min="1" max="100" value="' + r.seats + '"></div><div class="field"><label>Features</label><input id="rm-f" value="' + esc(r.features.join(', ')) + '"></div><label class="check"><input type="checkbox" id="rm-a"' + (r.active ? ' checked' : '') + '><span>Bookable online</span></label></div><button class="btn btn-dark" style="width:fit-content" id="rm-save">Save</button></div>' +
      '<div class="card"><h3>Photos</h3>' + photoAdmin(r.photos, false) + '</div>' +
      '<div class="card form"><h3>Reserve for a long-term client</h3><p class="small muted">For a client who takes the room for a month, six months or longer. Those dates and hours are blocked on the website. Existing bookings in the range are flagged first.</p>' +
      (rvs.map(function (x) { return '<div class="doc-row"><span><b>' + esc(x.client) + '</b> · ' + fmtDay(x.start) + ' – ' + fmtDay(x.end) + ' · ' + (x.sh <= OPEN && x.eh >= CLOSE ? 'All day' : hh(x.sh) + '–' + hh(x.eh)) + (x.note ? ' · <span class="muted">' + esc(x.note) + '</span>' : '') + '</span><button class="btn btn-danger btn-sm" data-endrv="' + x.id + '">End now</button></div>'; }).join('') || '<p class="small muted">No active reservations.</p>') +
      '<div class="g4" style="align-items:end"><div class="field"><label>Client</label><input id="rv-c" placeholder="Brightline Tech"></div><div class="field"><label>From</label><input type="date" id="rv-s" value="' + t + '"></div><div class="field"><label>For</label><select id="rv-len"><option value="1">1 month</option><option value="3">3 months</option><option value="6" selected>6 months</option><option value="12">12 months</option><option value="0">Custom end date</option></select></div><div class="field" id="rv-ew" hidden><label>Until</label><input type="date" id="rv-e"></div></div>' +
      '<div class="g4" style="align-items:end"><div class="field"><label>Hours</label><select id="rv-h"><option value="all">All day</option><option value="part">Some hours</option></select></div><div class="field rv-p" hidden><label>From</label><select id="rv-sh">' + hrs + '</select></div><div class="field rv-p" hidden><label>To</label><select id="rv-eh">' + hrs.replace('value="' + CLOSE + '"', 'value="' + CLOSE + '" selected') + '</select></div><div class="field"><label>Note</label><input id="rv-note" placeholder="Monthly contract"></div></div>' +
      '<p class="alert error" id="rv-err" hidden></p><button class="btn btn-primary" style="width:fit-content" id="rv-go">Reserve room</button></div>'),
    init: function () {
      bindAdmin(); var re = function (m) { save(); toast(m); render(); };
      bindPhotoAdmin(r.photos, false, re);
      $('#rm-save').onclick = function () { var n = $('#rm-n').value.trim(), s = +$('#rm-s').value; if (n.length < 2 || !(s >= 1 && s <= 100)) return toast('Enter a room name and 1–100 seats.'); r.name = n; r.seats = s; r.features = $('#rm-f').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean); r.active = $('#rm-a').checked; re('Saved'); };
      $('#rv-len').onchange = function () { $('#rv-ew').hidden = this.value !== '0'; };
      $('#rv-h').onchange = function () { var p = this.value === 'part'; $$('.rv-p').forEach(function (x) { x.hidden = !p; }); };
      $$('[data-endrv]').forEach(function (b) { b.onclick = function () { db.reservations.forEach(function (x) { if (x.id === +b.dataset.endrv) { x.end = addDays(t, -1); x.ended = true; } }); re('Reservation ended. The room is bookable again.'); }; });
      $('#rv-go').onclick = function () {
        var e = $('#rv-err'), c = $('#rv-c').value.trim(), st = $('#rv-s').value, len = +$('#rv-len').value, en, sh = OPEN, eh = CLOSE;
        if (len) { var d = new Date(st + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + len); en = addDays(d.toISOString().slice(0, 10), -1); } else en = $('#rv-e').value;
        if ($('#rv-h').value === 'part') { sh = +$('#rv-sh').value; eh = +$('#rv-eh').value; }
        var err = c.length < 2 ? 'Enter the client name.' : !st || !en || en < st ? 'Choose a valid date range.' : eh <= sh ? 'The end hour must be after the start hour.' : null;
        if (!err) {
          var clash = db.bookings.filter(function (b) { return b.roomId === r.id && b.status === 'confirmed' && b.date >= st && b.date <= en && b.start < eh && b.end > sh; });
          var over = db.reservations.filter(function (x) { return x.roomId === r.id && !x.ended && x.start <= en && x.end >= st && x.sh < eh && x.eh > sh; });
          if (clash.length) err = 'Already booked in that range: ' + clash.slice(0, 3).map(function (b) { return fmtDay(b.date) + ' ' + hh(b.start) + '–' + hh(b.end); }).join(', ') + '. Move or cancel those first.';
          else if (over.length) err = 'Overlaps the reservation for ' + over[0].client + '.';
        }
        if (err) { e.hidden = false; e.textContent = err; return; }
        db.reservations.push({ id: ++db.seq, roomId: r.id, client: c, start: st, end: en, sh: sh, eh: eh, note: $('#rv-note').value.trim() });
        re('Reserved. ' + fmtDay(st) + ' – ' + fmtDay(en) + ' now shows as unavailable.');
      };
    } };
  };
  routes['/admin/zoho'] = function () {
    if (needAdmin()) return; var z = db.zoho;
    return { html: admin('zoho', '<div class="between"><div class="stack" style="gap:6px"><h1 style="font-size:2rem">Zoho Books</h1><p class="muted">Every invoice and credit note is raised in Zoho Books, then emailed and saved in the customer\'s dashboard.</p></div><span class="pill am">Demo · simulated</span></div>' +
      '<div class="g2" style="align-items:start"><div class="card form"><h3>Settings</h3><div class="field"><label>Organisation ID</label><input id="z1" value="' + esc(z.orgId) + '"></div><div class="f2"><div class="field"><label>Tax for same-state sales</label><input id="z2" value="' + esc(z.taxIntra) + '"><span class="hint">GST18 tax group</span></div><div class="field"><label>Tax for other-state sales</label><input id="z3" value="' + esc(z.taxInter) + '"><span class="hint">IGST18</span></div></div><div class="f2"><div class="field"><label>Deposit account ID</label><input id="z4" value="' + esc(z.account) + '"></div><div class="field"><label>Payment mode</label><input id="z5" value="' + esc(z.mode) + '"></div></div><button class="btn btn-dark" style="width:fit-content" id="zs">Save</button></div>' +
      '<div class="card"><h3>Centre locations</h3><p class="small muted">Each centre invoices from its own Zoho location, which carries that state\'s GSTIN.</p>' + db.centres.map(function (c) { return '<div class="doc-row"><span><b>' + esc(c.name) + '</b><br><span class="xs muted mono">' + esc(c.gstin || 'No GSTIN') + '</span></span><span class="mono small">' + esc(c.zoho || 'Not set') + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="card"><h3>Recently raised</h3>' + (db.invoices.slice(-10).reverse().map(function (i) { return '<div class="doc-row"><span><b class="mono">' + i.number + '</b> · ' + (i.kind === 'invoice' ? 'Invoice' : 'Credit note') + ' · POS ' + esc(i.pos) + ' · ' + rs(i.total) + '</span><button class="btn btn-ghost btn-sm" data-inv="' + i.id + '">View</button></div>'; }).join('') || '<p class="small muted">Nothing yet.</p>') + '</div>'),
    init: function () { bindAdmin(); bindInvoiceButtons(); $('#zs').onclick = function () { z.orgId = $('#z1').value; z.taxIntra = $('#z2').value; z.taxInter = $('#z3').value; z.account = $('#z4').value; z.mode = $('#z5').value; save(); toast('Saved'); }; } };
  };

  var invClose = document.getElementById('inv-close'); if (invClose) invClose.onclick = function () { document.getElementById('inv').hidden = true; };
  /* ---- ext/01-core.js ---- */
  /* =====================================================================
     Admin portal, CRM and member extras for the demo. Same rules as the
     real site (src/rbac.js, src/crm.js, src/sales.js, src/members.js).
     ===================================================================== */
  var NOW = function () { return Date.now(); };
  var istStr = function (ms, t) { return ms ? new Date(ms + 330 * 6e4).toISOString().slice(0, t === false ? 10 : 16).replace('T', ' ') : '—'; };
  function ago(ms) { if (!ms) return '—'; var d = (Date.now() - ms) / 6e4, a = Math.abs(d), t = a < 1 ? 'just now' : a < 60 ? Math.round(a) + ' min' : a < 1440 ? Math.round(a / 60) + ' h' : Math.round(a / 1440) + ' d'; return t === 'just now' ? t : d < 0 ? 'in ' + t : t + ' ago'; }
  var MD = window.LIVANCE_MD || { markdown: function (s) { return '<pre>' + esc(s) + '</pre>'; } };
  var monthOf = function (ms) { return new Date(ms + 330 * 6e4).toISOString().slice(0, 7); };
  var dayStartMs = function (date) { return epoch(date, 0); };
  function byId(list, id) { return (db[list] || []).filter(function (x) { return x.id === +id; })[0]; }
  function userName(id) { var u = byId('users', id); return u ? u.name : 'System'; }
  function qsOf(o) { return Object.keys(o).filter(function (k) { return o[k] !== undefined && o[k] !== null && o[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
  function rupeesIn(v) { var n = Number(String(v == null ? '' : v).replace(/[,₹\s]/g, '')); return isFinite(n) && n >= 0 && String(v).trim() !== '' ? Math.round(n * 100) : null; }
  function digits10(v) { return String(v || '').replace(/[\s-]/g, '').replace(/^(?:\+?91|0)(?=\d{10}$)/, ''); }
  var EMAIL_RE = /^[A-Za-z0-9._%+'-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;
  function phoneError(v) { var d = digits10(v); if (!d) return 'Enter your mobile number.'; if (!/^\d+$/.test(d)) return 'Use digits only.'; if (d.length !== 10) return 'The mobile number must have 10 digits. You entered ' + d.length + '.'; if (!/^[6-9]/.test(d)) return 'Indian mobile numbers start with 6, 7, 8 or 9.'; return null; }
  function emailError(v) { v = String(v || '').trim(); if (!v) return 'Enter your email address.'; if (!EMAIL_RE.test(v) || /\.\./.test(v)) return 'Check your email address. It should look like name@company.com.'; if (/@(mailinator|yopmail|tempmail|10minutemail|guerrillamail)\./i.test(v)) return 'Please use a permanent email address.'; return null; }
  function download(name, text, type) {
    var framed = false; try { framed = window.top !== window; } catch (e) { framed = true; }
    if (framed) { var m = $('#inv'); $('#inv-t').textContent = name + ' (copy into Excel or Sheets)'; $('#inv-body').innerHTML = '<p class="small muted">Downloads are blocked in this preview window, so here is the file. On the live site, and in the downloaded HTML file, the CSV downloads directly.</p><textarea readonly rows="16" class="mono" style="font-size:.78rem;width:100%">' + esc(text) + '</textarea>'; m.hidden = false; var ta = $('textarea', m); ta.focus(); ta.select(); return; }
    try { var b = new Blob(['\ufeff' + text], { type: type || 'text/csv' }); var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { toast('Download is blocked in this preview.'); }
  }
  function csvCell(v) { var s2 = String(v == null ? '' : v); return /[",\n]/.test(s2) || /^[=+\-@]/.test(s2) ? '"' + s2.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""') + '"' : s2; }

  /* ---------------- access rights (src/rbac.js) ---------------- */
  var PERMS = {
    dashboard: 'Revenue dashboard and targets', 'crm.own': 'CRM: work their own leads', 'crm.team': 'CRM: see and manage their team\'s leads', 'crm.all': 'CRM: see every lead',
    'crm.assign': 'CRM: assign and transfer leads', 'crm.bulk': 'CRM: bulk email', 'crm.export': 'CRM: export leads to CSV', renewals: 'Renewals', orders: 'Orders and invoices',
    coupons: 'Discount codes', kyc: 'Virtual offices and KYC', tickets: 'Support tickets', credits: 'Meeting room credits for desk members', bookings: 'Schedule, rooms, seats and day passes',
    centres: 'Locations, photos and draft documents', content: 'Blogs, case studies and client logos', seo: 'SEO: page titles, descriptions, redirects', zoho: 'Zoho Books connection', users: 'Team members and access rights',
  };
  var ROLES = {
    sales: { label: 'Sales executive', perms: ['crm.own', 'renewals'] },
    sales_manager: { label: 'Sales manager', perms: ['dashboard', 'crm.own', 'crm.team', 'crm.assign', 'crm.bulk', 'crm.export', 'renewals', 'orders', 'coupons', 'credits'] },
    marketing: { label: 'Marketing', perms: ['content', 'seo', 'coupons', 'crm.bulk'] },
    seo: { label: 'SEO', perms: ['seo', 'content'] },
    tech: { label: 'Tech', perms: ['centres', 'bookings', 'seo', 'zoho'] },
    operations: { label: 'Operations and support', perms: ['tickets', 'kyc', 'credits', 'bookings', 'orders'] },
    admin: { label: 'Admin (everything except team access)', perms: Object.keys(PERMS).filter(function (p) { return p !== 'users'; }) },
  };
  var NAV = [
    ['Sales', [['home', '/admin', 'My day', null], ['crm', '/admin/crm', 'Leads (CRM)', ['crm.own', 'crm.team', 'crm.all']], ['renewals', '/admin/renewals', 'Renewals', ['renewals']], ['dashboard', '/admin/dashboard', 'Revenue & targets', ['dashboard']]]],
    ['Operations', [['orders', '/admin/orders', 'Orders & invoices', ['orders']], ['vos', '/admin/vos', 'Virtual offices & KYC', ['kyc']], ['tickets', '/admin/tickets', 'Support tickets', ['tickets']], ['credits', '/admin/credits', 'Desk members & credits', ['credits']],
      ['schedule', '/admin/schedule', 'Room schedule', ['bookings']], ['rooms', '/admin/rooms', 'Meeting rooms', ['bookings']], ['seats', '/admin/seats', 'Seats & day passes', ['bookings']]]],
    ['Website', [['coupons', '/admin/coupons', 'Discount codes', ['coupons']], ['centres', '/admin/centres', 'Locations & documents', ['centres']], ['content', '/admin/content', 'Blogs, case studies, clients', ['content']], ['seo', '/admin/seo', 'SEO', ['seo']]]],
    ['Settings', [['users', '/admin/users', 'Team & access', ['users']], ['zoho', '/admin/zoho', 'Zoho Books', ['zoho']]]],
  ];
  var PATH_PERMS = [['/admin/crm', ['crm.own', 'crm.team', 'crm.all']], ['/admin/renewals', ['renewals']], ['/admin/dashboard', ['dashboard']], ['/admin/orders', ['orders']], ['/admin/vo', ['kyc']],
    ['/admin/ticket', ['tickets']], ['/admin/credit', ['credits']], ['/admin/schedule', ['bookings']], ['/admin/room', ['bookings']], ['/admin/seats', ['bookings', 'credits']], ['/admin/coupons', ['coupons']],
    ['/admin/centre', ['centres']], ['/admin/doc', ['centres']], ['/admin/content', ['content']], ['/admin/post', ['content']], ['/admin/seo', ['seo']], ['/admin/user', ['users']], ['/admin/zoho', ['zoho']]];
  function isStaff(u) { return !!u && (u.role === 'admin' || (u.role === 'staff' && u.staff && u.staff.active)); }
  function permsOf(u) { if (!u) return []; if (u.role === 'admin') return Object.keys(PERMS); return isStaff(u) ? u.staff.perms : []; }
  function can(p, u) { return permsOf(u || me()).indexOf(p) > -1; }
  function canAny(list, u) { return list.some(function (p) { return can(p, u); }); }
  function pathAllowed(path) { var hit = PATH_PERMS.filter(function (x) { return path === x[0] || path.indexOf(x[0]) === 0; })[0]; return !hit || canAny(hit[1]); }
  function roleLabel(u) { return u.role === 'admin' ? 'Owner' : (ROLES[u.staff.role] || {}).label || 'Team member'; }
  function staffList(crmOnly) { return db.users.filter(function (u) { return isStaff(u) && (!crmOnly || permsOf(u).some(function (p) { return p.indexOf('crm.') === 0; })); }); }
  function teamIds(uid) { var ids = [uid], frontier = [uid]; while (frontier.length) { var next = db.users.filter(function (u) { return u.staff && u.staff.active && frontier.indexOf(u.staff.managerId) > -1 && ids.indexOf(u.id) < 0; }).map(function (u) { return u.id; }); ids = ids.concat(next); frontier = next; } return ids; }
  function canSee(l, u) { u = u || me(); if (!l) return false; if (can('crm.all', u)) return true; if (can('crm.team', u)) return l.ownerId == null || teamIds(u.id).indexOf(l.ownerId) > -1; return can('crm.own', u) && l.ownerId === u.id; }
  function canAssign(u) { return can('crm.assign', u) || can('crm.all', u); }

  /* ---------------- CRM rules (src/crm.js) ---------------- */
  var STAGES = [['new', 'New'], ['contacted', 'Contacted'], ['qualified', 'Qualified'], ['proposal', 'Proposal sent'], ['negotiation', 'Negotiation'], ['won', 'Won'], ['lost', 'Lost']];
  var STAGE = {}; STAGES.forEach(function (x) { STAGE[x[0]] = x[1]; });
  var OPEN_ST = ['new', 'contacted', 'qualified', 'proposal', 'negotiation'];
  var SOLUTIONS = { virtual_office: 'Virtual office', dedicated_desk: 'Dedicated desk', private_cabin: 'Private cabin', meeting_room: 'Meeting room', day_pass: 'Day pass', other: 'Something else' };
  var VO_LABEL = { address: 'Business Address (BA)', gst: 'GST Registration', company: 'Company Registration (CR)' };
  var LOST = ['Price', 'Chose a competitor', 'Location', 'Not ready yet', 'No response', 'Not a fit', 'Duplicate', 'Other'];
  var MANUAL_SOURCES = ['Phone call', 'WhatsApp', 'Walk-in', 'Referral', 'Email', 'JustDial', 'IndiaMART', 'Google Ads', 'Meta Ads', 'LinkedIn', 'Partner / broker', 'Other'];
  var FOLLOW = { overdue: 'Overdue', today: 'Due today', week: 'Due this week', none: 'No follow-up set' };
  function lead(id) { return byId('leads', id); }
  function act(leadId, actorId, type, body, meta) { db.acts.push({ id: ++db.seq, leadId: leadId, actorId: actorId || null, type: type, body: body, meta: meta || null, at: NOW() }); var l = lead(leadId); if (l) { l.lastActivityAt = NOW(); l.updatedAt = NOW(); } }
  function outMail(to, subject, kind, body) {
    var item={ id: ++db.seq, to: to, subject: subject, kind: kind || 'notification', at: NOW(),status:CONNECTED?'sending':'demo' };
    db.mails.unshift(item); db.mails = db.mails.slice(0, 80);
    if(CONNECTED && liveRole==='admin') {
      var msg=body || ('Hello,\n\n'+subject+'\n\nLivance Team');
      BRIDGE.sendEmail({to:to,subject:subject,kind:kind||'crm',body:msg}).then(function(){item.status='sent';save();toast('Email sent to '+to);})
       .catch(function(e){item.status='failed';item.error=e.message;save();toast('Email failed: '+e.message);});
    }
  }
  function nextOwner() { var pool = db.users.filter(function (u) { return u.role === 'staff' && u.staff.active && u.staff.rotation; }).map(function (u) { return u.id; }).sort(function (a, b) { return a - b; }); if (!pool.length) return null; var pick = pool.filter(function (id) { return id > (db.settings.rrLast || 0); })[0] || pool[0]; db.settings.rrLast = pick; return pick; }
  function assign(id, ownerId, actorId, why) {
    var l = lead(id); if (!l || l.ownerId === ownerId) return;
    var from = l.ownerId ? userName(l.ownerId) : 'Unassigned'; l.ownerId = ownerId; l.assignedAt = NOW();
    act(id, actorId, 'owner', from + ' → ' + (ownerId ? userName(ownerId) : 'Unassigned') + (why ? ' (' + why + ')' : ''));
    if (ownerId) db.rems.forEach(function (r) { if (r.leadId === id && !r.doneAt) r.ownerId = ownerId; });
    if (ownerId && ownerId !== actorId) outMail(byId('users', ownerId).email, 'Lead assigned: ' + l.name);
  }
  function capture(d, source, actorId, ownerId) {
    var ex = d.kind === 'renewal' ? null : db.leads.filter(function (l) { return l.kind === 'new' && OPEN_ST.indexOf(l.stage) > -1 && (l.phone === d.phone || (d.email && l.email && l.email.toLowerCase() === d.email.toLowerCase())); }).slice(-1)[0];
    if (ex) { ['email', 'company', 'solution', 'voPlan', 'seats', 'centre'].forEach(function (k) { if (!ex[k] && d[k]) ex[k] = d[k]; }); act(ex.id, actorId, 'enquiry', 'Enquired again via ' + source + (d.message ? ': “' + d.message.slice(0, 300) + '”' : ''), { page: d.page }); return { lead: ex, merged: true }; }
    var l = { id: ++db.seq, name: d.name, phone: d.phone, email: d.email || null, company: d.company || null, solution: d.solution || null, voPlan: d.voPlan || null, seats: d.seats || null, centre: d.centre || null,
      message: d.message || null, source: source, stage: 'new', ownerId: null, kind: d.kind || 'new', refType: d.refType || null, refId: d.refId || null, renewalDate: d.renewalDate || null,
      utm: d.utm || {}, page: d.page || null, value: d.value || null, tags: d.tags || [], createdAt: d.createdAt || NOW(), updatedAt: NOW(), lastActivityAt: NOW(), nextFollowUp: null, userId: d.userId || null, unsub: false };
    db.leads.push(l);
    act(l.id, actorId, 'created', 'Lead created from ' + source, { page: d.page, utm: d.utm && d.utm.source ? [d.utm.source, d.utm.medium, d.utm.campaign].filter(Boolean).join(' / ') : null });
    var owner = ownerId !== undefined ? ownerId : (db.settings.autoassign ? nextOwner() : null);
    if (owner) assign(l.id, owner, actorId, ownerId !== undefined ? null : 'auto-assigned'); else outMail('hello@livance.co.in', 'New lead (unassigned): ' + l.name);
    return { lead: l, merged: false };
  }
  function setStage(id, stage, actorId, o) {
    o = o || {}; var l = lead(id); if (!l || !STAGE[stage]) return;
    var was = l.stage; l.stage = stage; if (o.value) l.value = o.value; l.lostReason = stage === 'lost' ? (o.lost || 'Other') : null; l.wonAt = stage === 'won' ? (l.wonAt || NOW()) : null;
    if (was !== stage) act(id, actorId, 'stage', STAGE[was] + ' → ' + STAGE[stage] + (stage === 'lost' ? ' (' + l.lostReason + ')' : '') + (o.value ? ' · deal value ' + rs0(o.value) : ''));
    if (stage === 'won' || stage === 'lost') db.rems.forEach(function (r) { if (r.leadId === id && !r.doneAt) r.doneAt = NOW(); });
    refreshFollow(id);
  }
  function refreshFollow(id) { var l = lead(id), open = db.rems.filter(function (r) { return r.leadId === id && !r.doneAt; }).map(function (r) { return r.dueAt; }).sort(); if (l) l.nextFollowUp = open[0] || null; }
  function addRem(id, ownerId, due, note, actorId) { db.rems.push({ id: ++db.seq, leadId: id, ownerId: ownerId, dueAt: due, note: note, doneAt: null, createdBy: actorId }); refreshFollow(id); act(id, actorId, 'reminder', 'Follow-up set for ' + istStr(due) + ': ' + note); }
  function doneRem(rid, actorId) { var r = byId('rems', rid); if (!r || r.doneAt) return; r.doneAt = NOW(); refreshFollow(r.leadId); act(r.leadId, actorId, 'reminder', 'Follow-up done: ' + r.note); }
  function visibleLeads(u) { u = u || me(); return db.leads.filter(function (l) { return canSee(l, u); }); }
  function filterLeads(f, u) {
    var t = ist().date, ds = dayStartMs(t), out = visibleLeads(u).filter(function (l) {
      if (f.kind && l.kind !== f.kind) return false;
      if (f.stage === 'open' && OPEN_ST.indexOf(l.stage) < 0) return false; if (f.stage && f.stage !== 'open' && l.stage !== f.stage) return false;
      if (f.owner === 'none' && l.ownerId) return false; if (f.owner === 'me' && l.ownerId !== me().id) return false; if (/^\d+$/.test(f.owner || '') && l.ownerId !== +f.owner) return false;
      if (f.solution && l.solution !== f.solution) return false; if (f.centre && l.centre !== f.centre) return false; if (f.source && l.source !== f.source) return false;
      if (f.tag && l.tags.indexOf(f.tag) < 0) return false;
      if (f.follow === 'overdue' && !(l.nextFollowUp && l.nextFollowUp < NOW())) return false;
      if (f.follow === 'today' && !(l.nextFollowUp >= ds && l.nextFollowUp < ds + 864e5)) return false;
      if (f.follow === 'week' && !(l.nextFollowUp >= ds && l.nextFollowUp < ds + 7 * 864e5)) return false;
      if (f.follow === 'none' && (l.nextFollowUp || OPEN_ST.indexOf(l.stage) < 0)) return false;
      if (f.from && l.createdAt < dayStartMs(f.from)) return false; if (f.to && l.createdAt >= dayStartMs(f.to) + 864e5) return false;
      if (f.q) { var s2 = f.q.toLowerCase(); if ([l.name, l.phone, l.email, l.company, l.message].join(' ').toLowerCase().indexOf(s2) < 0) return false; }
      return true;
    });
    var sorts = { activity: function (a, b) { return (b.lastActivityAt || 0) - (a.lastActivityAt || 0); }, follow: function (a, b) { return (a.nextFollowUp || 9e15) - (b.nextFollowUp || 9e15); }, value: function (a, b) { return (b.value || 0) - (a.value || 0); } };
    return out.sort(sorts[f.sort] || function (a, b) { return b.createdAt - a.createdAt; });
  }
  var overdue = function (l) { return l.nextFollowUp && l.nextFollowUp < NOW() && OPEN_ST.indexOf(l.stage) > -1; };

  /* renewals: subscriptions ending in the window get a renewal lead */
  function dueSubs() {
    var t = ist().date, until = addDays(t, db.settings.renewalDays || 60), from = addDays(t, -30), out = [];
    db.vos.forEach(function (v) { if ((v.status === 'active' || v.status === 'expired') && v.end && v.end <= until && v.end >= from) { var u = byId('users', v.userId), o = byId('orders', v.orderId); out.push({ type: 'vo', id: v.id, name: v.business, contact: u.name, email: u.email, phone: u.phone, centre: v.centre, end: v.end, what: 'Virtual office · ' + PLANS[v.plan].name, solution: 'virtual_office', voPlan: v.plan, value: o ? o.quote.taxable : null, userId: u.id, srcLead: o && o.leadId }); } });
    db.deskClients.forEach(function (d) { if (d.end && d.end <= until && d.end >= from) out.push({ type: 'desk', id: d.id, name: d.name, contact: d.name, email: d.contactEmail, phone: d.contactPhone, centre: d.centre, end: d.end, what: 'Dedicated desk · ' + d.seats + ' seats', solution: 'dedicated_desk', seats: d.seats, value: d.monthlyFee ? d.monthlyFee * 12 : null, userId: d.userId, srcLead: d.leadId }); });
    (db.reservations || []).forEach(function (r) { if (!r.ended && r.end <= until && r.end >= from) out.push({ type: 'room', id: r.id, name: r.client, contact: r.client, email: r.email, phone: null, centre: room(r.roomId).centre, end: r.end, what: 'Long-term room · ' + room(r.roomId).name, solution: 'meeting_room', value: null }); });
    return out.map(function (x) { x.daysLeft = Math.round((Date.parse(x.end) - Date.parse(t)) / 864e5); return x; }).sort(function (a, b) { return a.end < b.end ? -1 : 1; });
  }
  function syncRenewals() {
    dueSubs().forEach(function (x) {
      if (db.leads.some(function (l) { return l.kind === 'renewal' && l.refType === x.type && l.refId === x.id && l.renewalDate === x.end; })) return;
      var prev = x.srcLead && lead(x.srcLead);
      capture({ name: x.contact || x.name, company: x.name, phone: x.phone || '—', email: x.email, solution: x.solution, voPlan: x.voPlan, seats: x.seats, centre: x.centre, kind: 'renewal', refType: x.type, refId: x.id, renewalDate: x.end, value: x.value, userId: x.userId, message: x.what + ' ends on ' + x.end + '.' }, 'Renewal', null, prev && prev.ownerId ? prev.ownerId : undefined);
    });
  }
  // A paid order closes the person's open lead as won, credited to its owner.
  function afterOrder(o) {
    var u = byId('users', o.userId); if (!u) return;
    var l = db.leads.filter(function (x) { return OPEN_ST.indexOf(x.stage) > -1 && (x.userId === u.id || (x.email && x.email.toLowerCase() === u.email.toLowerCase()) || x.phone === digits10(u.phone)); }).sort(function (a, b) { return (b.kind === 'renewal') - (a.kind === 'renewal'); })[0];
    o.paidMs = NOW();
    if (o.product === 'credits') { var dc = deskOf(o.userId); if (dc) grant(dc.id, o.params.credits, 'purchased', 'purchase', 'Bought online · ' + o.publicId, o.userId); }
    if (!l) return; o.leadId = l.id; l.userId = u.id;
    act(l.id, null, 'order', 'Paid online: order ' + o.publicId + ', ' + rs0(o.total)); setStage(l.id, 'won', null, { value: o.quote.taxable });
  }

  /* ---------------- credits (src/members.js) ---------------- */
  var period = function () { return ist().date.slice(0, 7); };
  function deskOf(uid) { var t = ist().date; return db.deskClients.filter(function (d) { return d.userId === uid && d.start <= t && (!d.end || d.end >= t); }).slice(-1)[0] || null; }
  function allot(d) { return d.monthlyCredits != null ? d.monthlyCredits : d.seats * db.settings.hoursPerSeat * db.settings.creditsPerHour; }
  function ensureAllot(d) { if (!db.ledger.some(function (x) { return x.dcId === d.id && x.reason === 'allotment' && x.period === period(); })) db.ledger.push({ id: ++db.seq, dcId: d.id, bucket: 'monthly', period: period(), delta: allot(d), reason: 'allotment', note: period() + ' allotment', at: NOW() }); }
  function balance(d) { ensureAllot(d); var m = 0, p = 0; db.ledger.forEach(function (x) { if (x.dcId !== d.id) return; if (x.bucket === 'monthly' && x.period === period()) m += x.delta; if (x.bucket === 'purchased') p += x.delta; }); m = Math.max(0, m); p = Math.max(0, p); return { monthly: m, purchased: p, total: m + p, allotment: allot(d) }; }
  function grant(dcId, n, bucket, reason, note, actorId, bookingId) { db.ledger.push({ id: ++db.seq, dcId: dcId, bucket: bucket, period: period(), delta: n, reason: reason, note: note || null, actorId: actorId || null, bookingId: bookingId || null, at: NOW() }); }

  /* ---------------- tickets ---------------- */
  var TCAT = { billing: 'Billing and invoices', booking: 'Bookings and meeting rooms', vo: 'Virtual office and KYC', mail: 'Mail and courier', facilities: 'Facilities (Wi-Fi, power, cleaning)', credits: 'Meeting room credits', other: 'Something else' };
  var TPRI = { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' };
  var TST = { open: 'Open', in_progress: 'In progress', waiting: 'Waiting on client', resolved: 'Resolved', closed: 'Closed' };
  var SLA = { urgent: 2, high: 4, normal: 24, low: 48 };
  function sla(t) { if (t.status === 'resolved' || t.status === 'closed' || t.firstResponseAt) return null; var due = t.createdAt + (SLA[t.priority] || 24) * 36e5; return { due: due, overdue: NOW() > due }; }

  /* ---------------- proposals ---------------- */
  function propTotals(items, discount) { var sub = items.reduce(function (n, it) { return n + Math.round(it.price * it.qty); }, 0), d = Math.min(Math.max(0, discount || 0), sub), g = Math.round((sub - d) * 0.18); return { subtotal: sub, discount: d, gst: g, total: sub - d + g }; }
  function priceList() {
    var L = Object.keys(PLANS).map(function (k) { return { key: 'vo_' + k, desc: 'Virtual office: ' + PLANS[k].name, unit: 'year', price: PLANS[k].price }; });
    L.push({ key: 'desk', desc: 'Dedicated desk', unit: 'seat / month', price: INR(7000) }, { key: 'cabin', desc: 'Private cabin', unit: 'month', price: INR(35000) }, { key: 'credits', desc: 'Meeting room credits (1 credit = ₹1)', unit: 'credit', price: INR(1) }, { key: 'daypass', desc: 'Day pass', unit: 'day', price: INR(500) });
    ADDONS.forEach(function (a) { L.push({ key: 'add_' + a.key, desc: a.name, unit: a.perYear ? 'year' : 'one-time', price: a.price('gst') }); });
    L.push({ key: 'custom', desc: 'Custom item', unit: '', price: 0 }); return L;
  }
  var DEFAULT_TERMS = 'Prices are exclusive of GST at 18%. Workspace services are invoiced from the centre\'s GSTIN through Zoho Books.\nPayment in advance. Virtual office documents are issued after KYC approval. Agreements run 11 months and 27 days per year of service.\nThis proposal is valid until the date shown.';
  var tok = function () { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10); };

/* ---- ext/02-seed.js ---- */
  /* ---------------- demo data ---------------- */
  function seedMore() {
    var t = ist().date, D = 864e5, H = 36e5, now = NOW();
    db.settings = { autoassign: true, origins: 'https://offers.livance.co.in', perMinute: 20, renewalDays: 60, hoursPerSeat: 1, creditsPerHour: 400, rrLast: 0 };
    db.acts = []; db.rems = []; db.props = []; db.camps = []; db.outbox = []; db.mails = []; db.tickets = []; db.tmsgs = []; db.ledger = []; db.targets = {}; db.seo = {}; db.redirects = [];
    var staff = function (id, name, email, role, extra) { var u = { id: id, email: email, password: 'team12345', name: name, phone: '98' + String(10000000 + id * 7919).slice(0, 8), role: 'staff',
      staff: { role: role, perms: ROLES[role].perms.slice(), managerId: extra.manager || null, active: true, rotation: !!extra.rotation, title: extra.title || '' } }; db.users.push(u); return u; };
    var M = staff(11, 'Meera Kapoor', 'meera@livance.co.in', 'sales_manager', { title: 'Sales manager' });
    var S1 = staff(12, 'Sahil Verma', 'sahil@livance.co.in', 'sales', { manager: 11, rotation: true, title: 'Sales, Gurugram' });
    var S2 = staff(13, 'Tara Singh', 'tara@livance.co.in', 'sales', { manager: 11, rotation: true, title: 'Sales, Delhi' });
    staff(14, 'Kabir Rao', 'kabir@livance.co.in', 'marketing', { title: 'Marketing' });
    staff(15, 'Neha Joshi', 'neha@livance.co.in', 'operations', { title: 'Centre operations' });
    db.users.push({ id: 4, email: 'karan@quillbyte.in', password: 'x', name: 'Karan Malhotra', phone: '9810022233', role: 'member' }, { id: 5, email: 'ananya@studiosaar.com', password: 'x', name: 'Ananya Sharma', phone: '9899011122', role: 'member' });
    // Aarav (demo member) has a 4-seat desk at Cyber City, so credits can be tried.
    db.deskClients.push({ id: 3, centre: 'gurugram', name: 'Mehta Analytics', seats: 4, start: addDays(t, -60), end: addDays(t, 45), userId: 1, monthlyCredits: null, monthlyFee: INR(28000), contactEmail: 'demo@livance.co.in', contactPhone: '9876543210' });
    db.deskClients[0].end = addDays(t, 20); db.deskClients[0].monthlyFee = INR(56000); db.deskClients[0].contactEmail = 'ops@northwind.example'; db.deskClients[0].contactPhone = '9810033344';

    var L = function (o) {
      var l = { id: ++db.seq, name: o.name, phone: o.phone, email: o.email || null, company: o.company || null, solution: o.solution, voPlan: o.voPlan || null, seats: o.seats || null, centre: o.centre || null,
        message: o.message || null, source: o.source, stage: o.stage || 'new', ownerId: o.owner || null, kind: 'new', utm: o.utm || {}, page: o.page || null, value: o.value || null, tags: o.tags || [],
        createdAt: now - (o.ago || 1) * D, updatedAt: now, lastActivityAt: now - (o.last || o.ago || 1) * D, nextFollowUp: null, unsub: false, lostReason: o.lost || null, wonAt: o.stage === 'won' ? now - (o.wonAgo || 2) * D : null };
      db.leads.push(l);
      db.acts.push({ id: ++db.seq, leadId: l.id, actorId: null, type: 'created', body: 'Lead created from ' + l.source, meta: o.utm && o.utm.source ? { utm: [o.utm.source, o.utm.medium, o.utm.campaign].filter(Boolean).join(' / ') } : null, at: l.createdAt });
      if (l.ownerId) db.acts.push({ id: ++db.seq, leadId: l.id, actorId: null, type: 'owner', body: 'Unassigned → ' + userName(l.ownerId) + ' (auto-assigned)', at: l.createdAt + 6e4 });
      (o.acts || []).forEach(function (a) { db.acts.push({ id: ++db.seq, leadId: l.id, actorId: l.ownerId, type: a[0], body: a[1], at: now - a[2] * H }); });
      if (o.due !== undefined) { db.rems.push({ id: ++db.seq, leadId: l.id, ownerId: l.ownerId || 11, dueAt: now + o.due * H, note: o.dueNote || 'Follow up', doneAt: null }); l.nextFollowUp = now + o.due * H; }
      return l;
    };
    var gads = { source: 'google', medium: 'cpc', campaign: 'vo-gurugram-gst' }, meta = { source: 'facebook', medium: 'paid-social', campaign: 'coworking-delhi' };
    L({ name: 'Rohit Bansal', phone: '9811200011', email: 'rohit@finlynk.in', company: 'Finlynk Technologies', solution: 'virtual_office', voPlan: 'gst', centre: 'gurugram', source: 'Landing page · Google Ads', utm: gads, owner: 12, stage: 'contacted', ago: 2, due: -5, dueNote: 'Call back with GST timeline', tags: ['hot'], value: INR(15000),
      acts: [['call', 'Connected · Needs GST in Haryana within 2 weeks. Comparing with two providers.', 30]] });
    L({ name: 'Pooja Arora', phone: '9811200012', email: 'pooja@kitebox.co', company: 'Kitebox Studio', solution: 'dedicated_desk', seats: 6, centre: 'gurugram', source: 'Website · desk tour', owner: 12, stage: 'qualified', ago: 4, due: 3, dueNote: 'Tour on Saturday 11 AM', value: INR(42000) * 12,
      acts: [['call', 'Connected · 6 seats from next month, wants a window bay.', 60], ['meeting', 'Visited Cyber City. Liked the open floor; asked for 12-month pricing.', 20]] });
    L({ name: 'Vikram Sethi', phone: '9811200013', email: 'vikram@orbitlegal.in', company: 'Orbit Legal LLP', solution: 'private_cabin', seats: 4, centre: 'ghitorni', source: 'Website · contact', owner: 13, stage: 'proposal', ago: 6, due: 20, dueNote: 'Check proposal feedback', value: INR(35000) * 12,
      acts: [['whatsapp', 'Shared cabin photos and floor plan.', 90], ['call', 'Connected · Wants a 4-seat cabin, sending proposal.', 50]] });
    L({ name: 'Simran Kaur', phone: '9811200014', email: 'simran@leafyhealth.in', company: 'Leafy Health Pvt Ltd', solution: 'virtual_office', voPlan: 'company', centre: 'ghitorni', source: 'Landing page · Meta Ads', utm: meta, owner: 13, stage: 'new', ago: 0.1 });
    L({ name: 'Arjun Nair', phone: '9811200015', email: 'arjun@nairexports.com', company: 'Nair Exports', solution: 'virtual_office', voPlan: 'gst', centre: 'gurugram', source: 'JustDial', owner: 12, stage: 'negotiation', ago: 9, due: 1, dueNote: 'Agree 24-month price', value: INR(27000), tags: ['24-months'],
      acts: [['call', 'Connected · Will take 24 months if we include sunboard signage.', 26]] });
    L({ name: 'Megha Jain', phone: '9811200016', email: 'megha@brightpath.in', company: 'Brightpath Tutors', solution: 'meeting_room', centre: 'ghitorni', source: 'Website · contact', owner: 13, stage: 'won', ago: 12, wonAgo: 3, value: INR(12000), acts: [['note', 'Booked the boardroom monthly for parent meetings.', 80]] });
    L({ name: 'Dev Khanna', phone: '9811200017', email: 'dev@stackforge.dev', company: 'StackForge', solution: 'dedicated_desk', seats: 3, centre: 'gurugram', source: 'Referral', owner: 12, stage: 'lost', lost: 'Price', ago: 15, acts: [['call', 'Connected · Found a cheaper desk in Sector 44.', 200]] });
    L({ name: 'Nisha Rawat', phone: '9811200018', email: 'nisha@greenroot.org', company: 'Greenroot Foundation', solution: 'virtual_office', voPlan: 'address', centre: 'ghitorni', source: 'Phone call', owner: 13, stage: 'contacted', ago: 3, due: -26, dueNote: 'Send BA plan details', acts: [['call', 'No answer', 70], ['whatsapp', 'Sent plan comparison on WhatsApp.', 50]] });
    L({ name: 'Harsh Gupta', phone: '9811200019', email: 'harsh@quantwise.in', company: 'Quantwise Analytics', solution: 'private_cabin', seats: 8, centre: 'ghitorni', source: 'LinkedIn', stage: 'new', ago: 0.3 });
    L({ name: 'Zoya Siddiqui', phone: '9811200020', email: 'zoya@inkpot.studio', company: 'Inkpot Studio', solution: 'day_pass', centre: 'gurugram', source: 'Website · contact', owner: 12, stage: 'contacted', ago: 1, due: 26, dueNote: 'Offer a 10-pass bundle' });
    L({ name: 'Kunal Bedi', phone: '9811200021', email: 'kunal@bedifoods.in', company: 'Bedi Foods', solution: 'virtual_office', voPlan: 'gst', centre: 'ghitorni', source: 'Google Ads', utm: { source: 'google', medium: 'cpc', campaign: 'vo-delhi-gst' }, owner: 13, stage: 'won', ago: 20, wonAgo: 8, value: INR(15000) });
    L({ name: 'Priyanka Das', phone: '9811200022', email: 'priyanka@novacare.in', company: 'NovaCare Clinics', solution: 'virtual_office', voPlan: 'company', centre: 'gurugram', source: 'Partner / broker', owner: 12, stage: 'proposal', ago: 5, due: 6, dueNote: 'Chase proposal', value: INR(24999) });

    // Proposals
    var mk = function (leadName, title, items, status, extra) { var l = db.leads.filter(function (x) { return x.name === leadName; })[0], tt = propTotals(items, extra.discount || 0);
      var p = { id: ++db.seq, leadId: l.id, number: 'PR-' + t.slice(2, 7).replace('-', '') + '-' + String(db.props.length + 1).padStart(3, '0'), token: tok(), title: title, centre: l.centre, items: items, discount: tt.discount, subtotal: tt.subtotal, gst: tt.gst, total: tt.total,
        intro: extra.intro || '', terms: DEFAULT_TERMS, validUntil: addDays(t, 12), status: status, version: 1, createdBy: l.ownerId, createdAt: now - 2 * D, updatedAt: now - 2 * D, sentAt: now - 2 * D + H, viewedAt: status === 'viewed' ? now - D : null };
      db.props.push(p); db.acts.push({ id: ++db.seq, leadId: l.id, actorId: l.ownerId, type: 'proposal', body: 'Proposal ' + p.number + ' (v1) emailed to ' + l.email, at: p.sentAt }); if (p.viewedAt) db.acts.push({ id: ++db.seq, leadId: l.id, actorId: null, type: 'proposal', body: 'Client opened proposal ' + p.number, at: p.viewedAt }); };
    mk('Vikram Sethi', '4-seat private cabin, Ghitorni', [{ desc: 'Private cabin (4 seats), Ghitorni, New Delhi', unit: 'month', qty: 12, price: INR(35000) }, { desc: 'Meeting room credits (1 credit = ₹1)', unit: 'credit', qty: 4000, price: INR(1) }], 'viewed', { discount: INR(20000), intro: 'Thanks for visiting Ghitorni. As discussed, here is a lockable 4-seat cabin with boardroom credits.' });
    mk('Priyanka Das', 'Company registration with registered office, Cyber City', [{ desc: 'Virtual office: Company Registration, Cyber City, Gurugram', unit: 'year', qty: 1, price: INR(15000) }, { desc: 'CA assistance (incorporation)', unit: 'one-time', qty: 1, price: INR(9999) }], 'sent', {});

    // Virtual offices in various stages, one ending soon (renewal)
    var vo = function (uid, business, plan, centreKey, status, startAgoDays, months) {
      var oid = ++db.seq, q = quote('virtual_office', { centre: centreKey, plan: plan, months: months, addons: ['sign_sunboard'] }, null, null), u = byId('users', uid);
      var o = { id: oid, publicId: 'LV' + addDays(t, -startAgoDays).slice(2).replace(/-/g, '') + '-' + String(oid).padStart(5, '0'), userId: uid, product: 'virtual_office', centre: centreKey, params: { centre: centreKey, plan: plan, months: months, addons: ['sign_sunboard'] }, quote: q, total: q.total, status: 'paid', paidAt: addDays(t, -startAgoDays), paidMs: now - startAgoDays * D, billing: { name: business, state: centre(centreKey).state, gstin: null }, extra: { business: business } };
      db.orders.push(o); raiseDocs(o, 'invoice'); db.invoices.slice(-1)[0].issued = o.paidAt;
      var start = addDays(t, -startAgoDays), end = (function () { var d = new Date(start + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + months); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
      var v = { id: ++db.seq, orderId: oid, userId: uid, centre: centreKey, plan: plan, months: months, business: business, status: status, kyc: status === 'awaiting_kyc' ? {} : { 'PAN card': 'pan.pdf', 'Aadhaar or passport': 'aadhaar.pdf' }, start: status === 'active' ? start : null, end: status === 'active' ? end : null,
        events: [{ from: null, to: 'awaiting_kyc', note: 'Paid online', at: now - startAgoDays * D, actor: null }], issued: [] };
      if (status !== 'awaiting_kyc') v.events.push({ from: 'awaiting_kyc', to: 'kyc_review', note: 'All documents uploaded', at: now - startAgoDays * D + 4 * H, actor: uid });
      if (status === 'active') v.events.push({ from: 'kyc_review', to: 'active', note: 'Documents issued', at: now - startAgoDays * D + 26 * H, actor: 15 });
      if (plan !== 'address' && status !== 'awaiting_kyc') v.kyc[KYC[plan][2]] = 'document.pdf';
      db.vos.push(v); return v;
    };
    vo(4, 'Quillbyte Media Pvt Ltd', 'gst', 'gurugram', 'active', 330, 12);
    vo(5, 'Studio Saar LLP', 'company', 'ghitorni', 'kyc_review', 1, 12);
    vo(3, 'Kapoor Consulting', 'address', 'ghitorni', 'awaiting_kyc', 0, 12);
    // Revenue history for the dashboard trend
    for (var m = 1; m <= 5; m++) for (var k = 0; k < 3 + m % 3; k++) {
      var pid = ++db.seq, d = addDays(t, -30 * m - k * 3); if (dow(d) === 0) d = addDays(d, 1);
      var qq = quote('meeting_room', { roomId: k % 2 ? 'dl-board' : 'ggn-a', hours: 2 + k % 3 }, null, null);
      db.orders.push({ id: pid, publicId: 'LV' + d.slice(2).replace(/-/g, '') + '-' + String(pid).padStart(5, '0'), userId: 3, product: 'meeting_room', centre: k % 2 ? 'ghitorni' : 'gurugram', params: { roomId: k % 2 ? 'dl-board' : 'ggn-a', date: d, start: 10, hours: 2 + k % 3 }, quote: qq, total: qq.total, status: 'paid', paidAt: d, paidMs: epoch(d, 10), billing: { name: 'Riya Kapoor', state: 'Delhi', gstin: null } });
      raiseDocs(db.orders.slice(-1)[0], 'invoice'); db.invoices.slice(-1)[0].issued = d;
    }
    var ym = t.slice(0, 7); db.targets[ym + '|0'] = INR(500000); db.targets[ym + '|12'] = INR(150000); db.targets[ym + '|13'] = INR(150000);
    // Tickets
    var tk = function (uid, subject, cat, pri, status, hoursAgo, msgs) { var tt = { id: ++db.seq, number: 'T' + t.slice(2, 7).replace('-', '') + '-' + String(db.tickets.length + 1).padStart(4, '0'), userId: uid, subject: subject, category: cat, priority: pri, status: status, assigneeId: status === 'open' ? null : 15, centre: 'gurugram', createdAt: now - hoursAgo * H, updatedAt: now - (hoursAgo / 2) * H, firstResponseAt: status === 'open' ? null : now - (hoursAgo - 1) * H };
      db.tickets.push(tt); msgs.forEach(function (m2, i) { db.tmsgs.push({ id: ++db.seq, ticketId: tt.id, authorId: m2[0], staff: m2[0] > 10, internal: !!m2[2], body: m2[1], at: tt.createdAt + i * H }); }); };
    tk(1, 'Wi-Fi drops in the afternoon', 'facilities', 'high', 'open', 5, [[1, 'Since yesterday the Wi-Fi at Cyber City drops between 2 and 4 PM.']]);
    tk(4, 'Need a copy of last month\'s invoice', 'billing', 'normal', 'waiting', 30, [[4, 'Please share the invoice for the signage renewal.'], [15, 'It is in your dashboard under Invoices. Could you confirm you can download it?'], [15, 'Checked Zoho: invoice synced fine.', true]]);
    tk(5, 'Courier from MCA not received', 'mail', 'urgent', 'in_progress', 3, [[5, 'ROC sent a letter last week, has it arrived?'], [15, 'Checking the mail log with reception now.']]);
    // Credits used by Aarav this month
    grant(3, 4 * 400, 'monthly', 'allotment', period() + ' allotment'); db.ledger[db.ledger.length - 1].reason = 'allotment';
    grant(3, -400, 'monthly', 'booking', 'Meeting Room A, 1 h', 1);
    // Content
    db.posts = [
      { id: ++db.seq, kind: 'blog', slug: 'virtual-office-for-gst-registration-gurugram', title: 'Virtual office for GST registration in Gurugram: what the officer checks', excerpt: 'The documents you need, how physical verification works, and how to avoid a rejection.', author: 'Livance team', status: 'published', publishedAt: now - 9 * D, updatedAt: now - 9 * D, seoTitle: '', seoDesc: 'Register for GST in Haryana with a virtual office: documents, verification and common rejection reasons.', cover: 'img:gh-reception.jpg',
        body: '## The documents\nFor GST registration with a virtual office you need four things from the provider:\n- A **leave and licence agreement** in your company\'s name\n- An **NOC** that says the address may be used for GST\n- A recent **electricity bill** for the premises\n- The **property tax receipt** or ownership proof\n\n## Physical verification\nThe officer may visit. They look for a working office, a reception that knows your company, and ideally a **name board**. That is why we recommend permanent signage on the GST plan.\n\n> Sample post for the demo. Edit or delete it in Admin → Content.' },
      { id: ++db.seq, kind: 'blog', slug: 'ba-vs-gst-vs-company-registration', title: 'Business Address, GST or Company Registration: which plan do you need?', excerpt: 'A plain comparison of what each virtual office plan lets you do.', author: 'Livance team', status: 'draft', publishedAt: null, updatedAt: now - D, body: '## Short answer\nIf you only need a mailing address, choose **Business Address**. Need GST in Haryana or Delhi? Choose **GST Registration**. Incorporating, or opening a bank account? Choose **Company Registration**.' },
      { id: ++db.seq, kind: 'case_study', slug: 'sample-case-study-delhi-cabin', title: 'Sample case study: a 4-person team moves into a Ghitorni cabin', excerpt: 'Placeholder story to show the layout. Replace with a real client story once they approve it.', client: 'Sample client', author: 'Livance team', status: 'published', publishedAt: now - 4 * D, updatedAt: now - 4 * D, cover: 'img:gh-cabin.jpg',
        body: '## The brief\nA growing team needed a lockable cabin and a boardroom for client meetings.\n\n## The setup\n- 4-seat cabin at Ghitorni\n- 4,000 meeting room credits a month\n- GST registration on the same address\n\n> This is placeholder text for the demo. Publish real case studies only with the client\'s written approval.' },
    ];
    db.clients = ['Ola', 'Insaaj Technologies', 'Journey Routers', 'Vevirita Private Limited'].map(function (n, i) { return { id: ++db.seq, name: n, logo: null, url: '', active: true, sort: i }; });
    db.docs = (window.LIVANCE_DOCS || []).map(function (d) { return { id: ++db.seq, centre: d.centre, plan: d.plan, kind: d.kind, title: d.title, body: d.body, public: !!d.public, sort: d.sort, updatedAt: now - 3 * D, editor: null }; });
    db.seo = { '/meeting-rooms': { title: 'Meeting Rooms in Gurugram & Delhi from ₹400/hour | Livance', desc: 'Book a 4, 6 or 10-seat meeting room online at Cyber City or Ghitorni. ₹100 per seat per hour, blocked instantly.', noindex: false } };
    db.redirects = [{ from: '/virtual-office-gurgaon', to: '/virtual-office?centre=gurugram', code: 301, hits: 14 }];
    db.etpl = [
      { id: ++db.seq, name: 'GST plan follow-up', subject: 'Your GST address at Livance, {{first_name}}', body: 'Hi {{first_name}},\n\nThanks for speaking with me today. Our GST Registration plan is ₹15,000 a year plus GST and includes the agreement, NOC, owners\' NOC, utility bill and property tax receipt.\n\nYou can see sample documents here: https://livance.co.in/virtual-office\n\n{{sender}}, Livance', byId: 12, at: now - 5 * D },
      { id: ++db.seq, name: 'Tour invite', subject: 'Come see the space, {{first_name}}', body: 'Hi {{first_name}},\n\nWould you like to visit this week? We are open Monday to Saturday, 9 AM to 7 PM.\n\n{{sender}}', byId: 11, at: now - 7 * D }];
    db.camps = [{ id: ++db.seq, subject: 'October offer: 10% off meeting rooms', body: '…', total: 42, sent: 41, skipped: 3, byId: 11, at: now - 6 * D }];
    db.settings.rrLast = 13;
    syncRenewals();
  }
  function migrateDemo() {
    ['acts', 'rems', 'props', 'camps', 'outbox', 'mails', 'tickets', 'tmsgs', 'ledger', 'posts', 'clients', 'docs', 'redirects', 'etpl'].forEach(function (k) { if (!db[k]) db[k] = []; });
    if (!db.settings) db.settings = { autoassign: true, origins: '', perMinute: 20, renewalDays: 60, hoursPerSeat: 1, creditsPerHour: 400, rrLast: 0 };
    if (!db.targets) db.targets = {}; if (!db.seo) db.seo = {};
  }
  // The admin demo opens straight into the portal, signed in as the owner.
  function startAs() { if (CONNECTED) return; if (!me() || !isStaff(me())) { db.session = 2; save(); } }
  function redirectFor(path) { var r = (db.redirects || []).filter(function (x) { return x.from === path; })[0]; if (r) { r.hits++; save(); return r.to; } return null; }
  var ROUTE_TITLES = { '/': 'Coworking, Meeting Rooms & Virtual Office in Gurugram and Delhi | Livance', '/virtual-office': 'Virtual Office for GST & Company Registration | Livance', '/meeting-rooms': 'Meeting Rooms from ₹400/hour | Livance', '/day-pass': 'Day Pass for ₹500 | Livance', '/blog': 'Blog | Livance' };
  function afterRender(path) {
    var o = db.seo && db.seo[path]; try { document.title = path.indexOf('/admin') === 0 ? 'Livance Admin' : (o && o.title) || ROUTE_TITLES[path] || 'Livance Coworking'; } catch (e) { /* ignore */ }
  }
  // Bulk email goes out gradually, like the live queue (sped up for the demo).
  setInterval(function () {
    if (CONNECTED || !db || !db.outbox) return; var q2 = db.outbox.filter(function (m2) { return m2.status === 'queued'; }).slice(0, 3); if (!q2.length) return;
    q2.forEach(function (m2) { m2.status = 'sent'; m2.sentAt = NOW(); var c = byId('camps', m2.campId); if (c) c.sent++; if (m2.leadId) act(m2.leadId, c && c.byId, 'bulk_email', 'Bulk email: “' + m2.subject + '”'); });
    save(); var live = $('[data-outbox-live]'); if (live) live.textContent = db.outbox.filter(function (m2) { return m2.status === 'queued'; }).length + ' waiting to send';
  }, 1500);

/* ---- ext/03-public.js ---- */
  /* ---------------- chrome overrides ---------------- */
  function header(path) {
    var u = me(), inAdmin = path.indexOf('/admin') === 0;
    var cityMenu = cities().map(function (c) { return '<span class="city">' + esc(c.city) + '</span>' + c.centres.map(function (x) { return '<a href="' + link('/locations/' + x.slug) + '"><b>' + esc(x.name) + '</b><span>' + esc(x.transit) + '</span></a>'; }).join(''); }).join('');
    var dest = u ? (isStaff(u) ? '#/admin' : '#/dashboard') : '#/login', destL = u ? (isStaff(u) ? 'Admin' : 'Dashboard') : 'Log in';
    var team = db.users.filter(isStaff);
    var bar = inAdmin && u && isStaff(u)
      ? '<div class="demo-bar"><div class="wrap">Admin demo · viewing as <select id="viewas" style="width:auto;min-height:28px;padding:2px 8px;font-size:.8rem;display:inline-block">' + team.map(function (x) { return '<option value="' + x.id + '"' + (x.id === u.id ? ' selected' : '') + '>' + esc(x.name) + ' · ' + esc(roleLabel(x)) + '</option>'; }).join('') + '</select> to see what each role can do · <a href="#/" class="link">Website</a> · <button type="button" class="link" id="reset">Reset demo</button></div></div>'
      : '<div class="demo-bar"><div class="wrap">Demo · runs in your browser · member <b>demo@livance.co.in</b> / demo12345 · admin <b>admin@livance.co.in</b> / admin12345 · team <b>meera@livance.co.in</b> / team12345 <button type="button" class="link" id="reset">Reset demo</button></div></div>';
    if(CONNECTED)bar='';
    return bar + '<header class="site-header"><div class="wrap"><a class="logo" href="#/"><b>Livance<i>.</i></b><span>Coworking</span></a>' +
      '<nav class="nav" aria-label="Main"><div class="menu"><button type="button">Workspaces</button><div class="panel">' +
      '<a href="#/day-pass"><b>Day pass</b><span>₹500 a day, walk in and work</span></a><a href="#/meeting-rooms"><b>Meeting rooms</b><span>₹100 per seat per hour, booked online</span></a>' +
      '<a href="#/dedicated-desk"><b>Dedicated desk</b><span>Your own desk, monthly</span></a><a href="#/virtual-office"><b>Virtual office</b><span>Address for GST and company registration</span></a></div></div>' +
      '<div class="menu"><button type="button">Locations</button><div class="panel">' + cityMenu + '<a href="#/locations" style="border-top:1px solid var(--line);margin-top:6px"><b>All locations</b></a></div></div>' +
      '<a href="#/virtual-office">Virtual Office</a><a href="#/contact">Contact</a></nav>' +
      '<div class="hdr-actions"><a class="btn btn-ghost hide-m" href="' + dest + '">' + destL + '</a><a class="btn btn-primary" href="#/" data-book>Book now</a><button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><span></span></button></div></div>' +
      '<div class="mnav" id="mnav" hidden><div class="wrap"><a href="#/day-pass">Day pass</a><a href="#/meeting-rooms">Meeting rooms</a><a href="#/dedicated-desk">Dedicated desk</a><a href="#/virtual-office">Virtual office</a><a href="#/locations">Locations</a><a href="#/blog">Blog</a><a href="#/contact">Contact</a><a href="' + dest + '">' + destL + '</a></div></div></header>';
  }
  function footer() {
    if (parse().path.indexOf('/admin') === 0) return '<div class="wrap" style="padding:18px 20px" ><span class="xs muted">Preview theme: <button class="link" data-theme-set="auto">Device</button> · <button class="link" data-theme-set="light">Light</button> · <button class="link" data-theme-set="dark">Dark</button></span></div>';
    return '<footer class="site-footer"><div class="wrap"><div class="fgrid"><div class="col"><a class="logo" href="#/"><b>Livance<i style="color:var(--orange);font-style:normal">.</i></b></a><p>Virtual offices, day passes and meeting rooms at centres we run ourselves.</p><p class="xs">Livance Management Private Limited<br>CIN U63119HR2025PTC136252</p></div>' +
      '<div class="col"><h6>Workspaces</h6><a href="#/day-pass">Day pass · ₹500</a><a href="#/meeting-rooms">Meeting rooms</a><a href="#/dedicated-desk">Dedicated desk</a><a href="#/virtual-office">Virtual office</a></div>' +
      '<div class="col"><h6>Centres</h6>' + centres().map(function (c) { return '<a href="' + link('/locations/' + c.slug) + '">' + esc(c.name) + '</a><span class="xs">' + esc(c.address) + '</span>'; }).join('') + '</div>' +
      '<div class="col"><h6>Company</h6><a href="#/contact">Contact</a><a href="#/blog">Blog</a><a href="#/case-studies">Case studies</a><a href="#/login">Member login</a><span class="xs">+91 87961 61489<br>hello@livance.co.in</span></div></div>' +
      '<div class="fbase"><span>© 2026 Livance Management Private Limited</span><span>Preview theme: <button class="link" data-theme-set="auto">Device</button> · <button class="link" data-theme-set="light">Light</button> · <button class="link" data-theme-set="dark">Dark</button></span></div></div></footer>';
  }
  document.addEventListener('change', function (e) { if (!CONNECTED && e.target && e.target.id === 'viewas') { db.session = +e.target.value; save(); var p = parse().path; current = pathAllowed(p) ? current : '/admin'; render(); toast('Now viewing as ' + me().name + ' (' + roleLabel(me()) + ')'); } });

  /* ---------------- enquiry form (website, desk, VO, contact) ---------------- */
  function leadForm(o) {
    o = o || {}; var v = o.values || {};
    return '<form class="card form" data-lf novalidate><div class="f2"><div class="field" data-f="name"><label>Full name</label><input name="name" maxlength="80" value="' + esc(v.name || (me() ? me().name : '')) + '"><span class="err" hidden></span></div>' +
      '<div class="field" data-f="company"><label>Company name</label><input name="company" maxlength="120" value="' + esc(v.company || '') + '"><span class="hint">Or proposed name, if you\'re registering.</span></div></div>' +
      '<div class="f2"><div class="field" data-f="email"><label>Email</label><input type="email" name="email" maxlength="254" value="' + esc(v.email || (me() ? me().email : '')) + '"><span class="err" hidden></span></div>' +
      '<div class="field" data-f="phone"><label>Mobile number</label><input type="tel" name="phone" inputmode="numeric" maxlength="14" placeholder="10-digit mobile" value="' + esc(v.phone || '') + '"><span class="err" hidden></span></div></div>' +
      '<div class="f2"><div class="field" data-f="solution"><label>What do you need?</label><select name="solution"><option value="">Choose a solution</option>' + Object.keys(SOLUTIONS).map(function (k) { return '<option value="' + k + '"' + ((v.solution || o.solution) === k ? ' selected' : '') + '>' + SOLUTIONS[k] + '</option>'; }).join('') + '</select><span class="err" hidden></span></div>' +
      '<div class="field"><label>Preferred centre</label><select name="centre"><option value="">Any centre</option>' + centres().map(function (c) { return '<option value="' + c.key + '"' + (o.centre === c.key ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field" data-f="vo_plan" data-when="virtual_office"><label>Virtual office for</label><div class="seg-radio">' + Object.keys(VO_LABEL).map(function (k) { return '<label><input type="radio" name="vo_plan" value="' + k + '"' + (o.voPlan === k ? ' checked' : '') + '><span>' + VO_LABEL[k] + '</span></label>'; }).join('') + '</div><span class="err" hidden></span></div>' +
      '<div class="field" data-f="seats" data-when="dedicated_desk private_cabin"><label>How many seats?</label><input type="number" name="seats" min="1" max="500" inputmode="numeric" style="max-width:180px"><span class="err" hidden></span></div>' +
      '<div class="field"><label>Anything else? <span class="soft">(optional)</span></label><textarea name="message" rows="3" maxlength="1000"></textarea></div>' +
      '<label class="check small"><input type="checkbox" name="marketing_opt_in"><span>Optional: Send me workspace offers by email. I can unsubscribe anytime.</span></label>' +
      '<button class="btn btn-primary btn-block">' + (o.cta || 'Send enquiry') + '</button><p class="xs muted">We\'ll call or WhatsApp you within working hours. No spam.</p></form>';
  }
  function bindLeadForm(source, done) {
    var f = $('[data-lf]'); if (!f) return;
    var sol = f.solution, cond = function () { $$('[data-when]', f).forEach(function (x) { x.hidden = x.dataset.when.split(' ').indexOf(sol.value) < 0; }); };
    sol.onchange = cond; cond();
    f.phone.oninput = function () { f.phone.value = f.phone.value.replace(/[^\d+\s-]/g, ''); };
    var setErr = function (k, m2) { var x = $('[data-f="' + k + '"]', f); if (!x) return; x.classList.toggle('invalid', !!m2); var e = $('.err', x); if (e) { e.hidden = !m2; e.textContent = m2 || ''; } };
    var tried = false;
    f.addEventListener('input', function () { if (tried) check(); }); f.addEventListener('change', function () { if (tried) check(); });
    function check() {
      var err = {}; if (f.name.value.trim().length < 2) err.name = 'Enter your full name.';
      var ee = emailError(f.email.value); if (ee) err.email = ee; var pe = phoneError(f.phone.value); if (pe) err.phone = pe;
      if (!sol.value) err.solution = 'Choose what you need.';
      var vp = $('input[name="vo_plan"]:checked', f); if (sol.value === 'virtual_office' && !vp) err.vo_plan = 'Choose Business Address, GST or Company Registration.';
      var seats = +f.seats.value; if (['dedicated_desk', 'private_cabin'].indexOf(sol.value) > -1 && !(seats >= 1 && seats <= 500 && Math.floor(seats) === seats)) err.seats = 'Enter the number of seats (1–500).';
      ['name', 'email', 'phone', 'solution', 'vo_plan', 'seats'].forEach(function (k) { setErr(k, err[k]); });
      return err;
    }
    onSubmit(f, function () {
      tried = true; check();
      var err = {}; if (f.name.value.trim().length < 2) err.name = 'Enter your full name.';
      var ee = emailError(f.email.value); if (ee) err.email = ee; var pe = phoneError(f.phone.value); if (pe) err.phone = pe;
      if (!sol.value) err.solution = 'Choose what you need.';
      var vp = $('input[name="vo_plan"]:checked', f); if (sol.value === 'virtual_office' && !vp) err.vo_plan = 'Choose Business Address, GST or Company Registration.';
      var seats = +f.seats.value; if (['dedicated_desk', 'private_cabin'].indexOf(sol.value) > -1 && !(seats >= 1 && seats <= 500 && Math.floor(seats) === seats)) err.seats = 'Enter the number of seats (1–500).';
      ['name', 'email', 'phone', 'solution', 'vo_plan', 'seats'].forEach(function (k) { setErr(k, err[k]); });
      if (Object.keys(err).length) { var first = $('.invalid input, .invalid select', f); if (first) first.focus(); return; }
      var values={ name: f.name.value.trim(), company: f.company.value.trim() || null, email: f.email.value.trim().toLowerCase(), phone: digits10(f.phone.value), solution: sol.value, voPlan: vp ? vp.value : null,
        seats: ['dedicated_desk', 'private_cabin'].indexOf(sol.value) > -1 ? seats : null, centre: f.centre.value || null, message: f.message.value.trim() || null, page: parse().path, source: source,
        marketingOptIn:!!(f.marketing_opt_in && f.marketing_opt_in.checked) };
      if(CONNECTED) {
        var submit=f.querySelector('button');submit.disabled=true;submit.textContent='Sending…';
        BRIDGE.submitLead(values).then(function(){f.outerHTML='<div class="card"><span class="pill gr">Enquiry submitted</span><h3>Thanks, '+esc(values.name.split(' ')[0])+'. We’ll contact you shortly.</h3><p class="small muted">Your request has been saved successfully.</p></div>';})
          .catch(function(e){submit.disabled=false;submit.textContent='Try again';toast('Could not save enquiry: '+e.message);});
        return;
      }
      var r=capture(values,source);save();
      f.outerHTML = '<div class="card"><span class="pill gr">Request received</span><h3>Thanks, ' + esc(r.lead.name.split(' ')[0]) + '. We’ll call you shortly.</h3></div>';
      if (done) done(r);
    });
  }
  routes['/contact'] = function () {
    return { html: pageHead('Contact', 'Talk to us.', 'We reply within working hours, Monday to Saturday.') + '<section class="band-sm" style="padding-top:8px"><div class="wrap g2" style="align-items:start"><div class="stack-lg"><div class="card flat"><span class="eyebrow">Call or WhatsApp</span><p class="mono" style="font-size:1.25rem">+91 87961 61489</p></div><div class="card flat"><span class="eyebrow">Email</span><p class="mono" style="font-size:1.1rem">hello@livance.co.in</p></div></div>' + leadForm({ cta: 'Send enquiry' }) + '</div></section>',
      init: function () { bindLeadForm('Website · contact'); } };
  };
  routes['/dedicated-desk'] = function (q) {
    var pics = []; centres().forEach(function (c) { pics = pics.concat(byTag(c.key, 'workspace', 'cabin')); });
    return { html: pageHead('Dedicated desk', 'A desk that\'s yours, every day.', 'From ₹7,000 a month in Cyber City (Udyog Vihar Phase V), Gurugram. Cabins and open seats at Ghitorni on enquiry.') +
      '<section class="band-sm" style="padding-top:0"><div class="wrap">' + gallery(pics, 'strip', 4) + '</div></section>' +
      '<section class="band alt"><div class="wrap g2" style="align-items:start"><div class="stack"><h2>What\'s included.</h2><ul class="checks"><li>Your own desk and chair</li><li>Wi-Fi, power backup and AC</li><li>Meeting room credits every month</li><li>Open Monday to Saturday, 9 AM to 7 PM</li></ul></div><div class="card flat"><h3>Meeting room credits</h3><p class="small muted">Each seat comes with 400 credits a month: one hour in a 4-seat room. Bigger rooms use more credits. Book online with credits, and buy more anytime.</p></div></div></section>' +
      '<section class="band" id="enquire"><div class="wrap g2" style="align-items:start"><div class="stack"><h2>Book a tour.</h2><p class="muted">We\'ll confirm a time on WhatsApp within working hours.</p></div>' + leadForm({ solution: 'dedicated_desk', centre: q.centre, cta: 'Request a tour' }) + '</div></section>',
      init: function () { bindLeadForm('Website · desk tour'); } };
  };

  /* client logos and case studies on the home page */
  var baseHome = routes['/'];
  routes['/'] = function (q) {
    var out = baseHome(q);
    var cl = db.clients.filter(function (c) { return c.active; });
    var strip = cl.length ? '<section class="band-sm" aria-label="Clients"><div class="wrap stack" style="gap:18px;text-align:center"><p class="eyebrow" style="justify-self:center">Teams that work with Livance</p><div class="logos">' + cl.map(function (c) { return '<span class="lg">' + (c.logo ? '<img src="' + c.logo + '" alt="' + esc(c.name) + '">' : '<span class="wm">' + esc(c.name) + '</span>') + '</span>'; }).join('') + '</div></div></section>' : '';
    var cs = db.posts.filter(function (p) { return p.kind === 'case_study' && p.status === 'published' && p.publishedAt <= NOW(); }).slice(0, 3);
    var csHtml = cs.length ? '<section class="band"><div class="wrap"><div class="sec-head between"><h2>How teams use Livance.</h2><a class="link" href="#/case-studies">All case studies</a></div><div class="g3">' + cs.map(postCard).join('') + '</div></div></section>' : '';
    var i = out.html.indexOf('<section class="band"><div class="wrap"><div class="sec-head"><h2>Workspace for every way you work.');
    if (i > -1) out.html = out.html.slice(0, i) + strip + out.html.slice(i);
    var j = out.html.indexOf('<section class="band"><div class="wrap"><div class="sec-head"><h2>Questions.');
    if (j > -1) out.html = out.html.slice(0, j) + csHtml + out.html.slice(j);
    return out;
  };

  /* virtual office page: real drafts, plan rules, callback form */
  var baseVO = routes['/virtual-office'];
  routes['/virtual-office'] = function (q) {
    var out = baseVO(q), ck = centre(q.centre) && centre(q.centre).active ? q.centre : centres()[0].key, plan = PLANS[q.plan] ? q.plan : 'gst';
    var rows = [['Leave & licence agreement (' + AGREEMENT_TERM + ')', [1, 1, 1]], ['Mail and courier handling (15 items a month)', [1, 1, 1]], ['Use on website, letterhead and correspondence', [1, 1, 1]], ['GST registration (principal place of business)', [0, 1, 1]],
      ['NOC from Livance', ['–', 'GST consent', 'MCA consent']], ['Registered office with MCA / ROC', [0, 0, 1]], ['Bank account opening', [0, 0, 1]], ['Owners\' NOC, utility bill and property tax receipt', [0, 1, 1]], ['Support during GST officer verification', [0, 1, 1]],
      ['Signage (A4, sunboard or metallic)', ['Add-on', 'Add-on', 'Add-on']], ['CA assistance', ['Add-on', 'Add-on', 'Add-on']], ['Loans, vehicle registration, Import-Export Code', ['Not allowed', 'Not allowed', 'Not allowed']]];
    var cmp = '<section class="band alt"><div class="wrap"><div class="sec-head"><h2>Compare plans.</h2><p class="muted">What each plan lets you use the address for, exactly as the agreement says.</p></div><div class="tbl"><table class="cmp" style="min-width:640px"><thead><tr><th>Included</th>' + Object.keys(PLANS).map(function (k) { return '<th class="c">' + PLANS[k].name + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + r[0] + '</td>' + r[1].map(function (x) { return '<td class="c ' + (x === 1 ? 'y' : x === 0 ? 'n' : 'small muted') + '">' + (x === 1 ? '✓' : x === 0 ? '–' : x) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '<tr class="row-price"><td>Price per year (+ GST)</td>' + Object.keys(PLANS).map(function (k) { return '<td class="c mono">' + rs0(PLANS[k].price) + '</td>'; }).join('') + '</tr></tbody></table></div></div></section>';
    var docs = '<section class="band" id="documents"><div class="wrap"><div class="sec-head"><h2>Preview your documents.</h2><p class="muted">These are our actual drafts for ' + esc(centre(ck).name) + '. Type your company name to see it filled in. Your documents are issued after KYC, signed and stamped.</p></div>' +
      '<div class="docs" id="docs"><div class="stack"><div class="card flat form" style="padding:18px"><div class="field"><label>Your company or proposed name</label><input id="doc-co" placeholder="Your Company Private Limited" maxlength="120"></div><div class="field"><label>Plan</label><select id="doc-plan">' + Object.keys(PLANS).map(function (k) { return '<option value="' + k + '"' + (k === plan ? ' selected' : '') + '>' + PLANS[k].name + '</option>'; }).join('') + '</select></div></div><div class="doc-tabs" id="doc-tabs" role="tablist"></div></div><div class="viewer"><div class="page md" id="doc-page"></div></div></div></div></section>';
    var talk = '<section class="band" id="talk"><div class="wrap g2" style="align-items:start"><div class="stack"><h2>Not sure which plan?</h2><p class="muted">Tell us what you\'re registering and we\'ll call you back with the right plan and documents.</p></div>' + leadForm({ solution: 'virtual_office', centre: ck, voPlan: plan, cta: 'Request a callback' }) + '</div></section>';
    var h = out.html;
    var a = h.indexOf('<section class="band alt"><div class="wrap"><div class="sec-head"><h2>Compare plans.'), b = h.indexOf('<section class="band alt"><div class="wrap"><div class="sec-head"><h2>Your name on the wall.');
    if (a > -1 && b > a) h = h.slice(0, a) + cmp + docs + h.slice(b);
    var c = h.indexOf('<section class="band dark">'); if (c > -1) h = h.slice(0, c) + talk + h.slice(c);
    h = h.replace('Annual, on an 11-month agreement.', 'Annual plans. Each year is an agreement of ' + AGREEMENT_TERM + '.');
    out.html = h;
    var baseInit = out.init;
    out.init = function () {
      if (baseInit) { try { baseInit(); } catch (e) { /* old document preview removed */ } }
      var cur = null, SUB = { lla: 'Signed agreement', noc: 'Consent from Livance', owner_noc: 'From the property owners', utility: 'Latest, under 2 months old', tax: 'Current assessment year' };
      function list() { var pl = $('#doc-plan').value; return db.docs.filter(function (d) { return d.centre === ck && d.public && (d.plan === pl || d.plan === '*'); }).sort(function (x, y) { return x.sort - y.sort; }); }
      function fields() { var c2 = centre(ck), pl = $('#doc-plan').value; return { company: $('#doc-co').value.trim() || 'Your Company Private Limited', signatory: 'Authorised signatory', date: 'the date of signing', start_date: 'the activation date', centre_address: c2.address, city: c2.city, term: AGREEMENT_TERM, plan: PLANS[pl].name, fee: rs0(PLANS[pl].price) + ' per year' }; }
      function draw() {
        var L2 = list(); if (!L2.some(function (d) { return d.kind === cur; })) cur = L2.length ? L2[0].kind : null;
        $('#doc-tabs').innerHTML = L2.map(function (d) { return '<button type="button" class="doc-tab" role="tab" aria-selected="' + (d.kind === cur) + '" data-doc="' + d.kind + '"><i class="ic"></i><b>' + esc(d.title) + '</b><span>' + (SUB[d.kind] || '') + '</span></button>'; }).join('') + ($('#doc-plan').value === 'address' ? '<p class="small muted">The Business Address plan includes the agreement only. NOCs and proofs come with the GST and Company Registration plans.</p>' : '');
        var d = L2.filter(function (x) { return x.kind === cur; })[0];
        $('#doc-page').innerHTML = d ? '<div class="lh"><div><b>Livance<i>.</i></b><br>Livance Management Private Limited</div><div style="text-align:right">Draft for preview</div></div>' + MD.markdown(d.body, fields()) : '<p class="muted">No preview for this plan yet.</p>';
      }
      $('#doc-tabs').onclick = function (e) { var b2 = e.target.closest('.doc-tab'); if (b2) { cur = b2.dataset.doc; draw(); } };
      $('#doc-co').oninput = function () { var n = $('#doc-co').value.trim() || 'Your Company Private Limited'; $$('#doc-page [data-k="company"]').forEach(function (el) { el.textContent = n; }); };
      $('#doc-plan').onchange = draw; draw();
      bindLeadForm('Website · virtual office');
    };
    return out;
  };

  /* blog and case studies */
  function postCard(p) { var img = p.cover ? (p.cover.indexOf('img:') === 0 ? IMG[p.cover.slice(4)] : p.cover) : null; return '<a class="card post-card" href="' + link('/post?slug=' + p.slug) + '">' + (img ? '<figure class="photo"><img src="' + img + '" alt=""></figure>' : '<figure class="photo"><div class="ph t2"></div></figure>') + '<div class="pc-body"><span class="pill">' + (p.kind === 'blog' ? istStr(p.publishedAt, false) : esc(p.client || 'Case study')) + '</span><h3>' + esc(p.title) + '</h3><p class="small muted">' + esc(p.excerpt || '') + '</p></div></a>'; }
  function postsPage(kind) { var ps = db.posts.filter(function (p) { return p.kind === kind && p.status === 'published' && p.publishedAt <= NOW(); }).sort(function (a, b) { return b.publishedAt - a.publishedAt; });
    return { html: pageHead(kind === 'blog' ? 'Blog' : 'Case studies', kind === 'blog' ? 'Guides for founders.' : 'How teams use Livance.', kind === 'blog' ? 'Virtual offices, GST and company registration, and making coworking work for your team.' : 'Real businesses, real setups, at our Gurugram and Delhi centres.') +
      '<section class="band-sm" style="padding-top:8px"><div class="wrap">' + (ps.length ? '<div class="g3">' + ps.map(postCard).join('') + '</div>' : '<div class="card flat"><p class="muted">Nothing published yet.</p></div>') + '</div></section>' }; }
  routes['/blog'] = function () { return postsPage('blog'); };
  routes['/case-studies'] = function () { return postsPage('case_study'); };
  routes['/post'] = function (q) {
    var p = db.posts.filter(function (x) { return x.slug === q.slug && x.status === 'published'; })[0]; if (!p) { go('/blog'); return; }
    var img = p.cover ? (p.cover.indexOf('img:') === 0 ? IMG[p.cover.slice(4)] : p.cover) : null;
    return { html: '<section class="page-head"><div class="wrap narrow"><div class="crumbs"><a href="#/">Home</a><span>›</span><a href="' + link(p.kind === 'blog' ? '/blog' : '/case-studies') + '">' + (p.kind === 'blog' ? 'Blog' : 'Case studies') + '</a></div><h1 style="font-size:clamp(2rem,4vw,3rem)">' + esc(p.title) + '</h1>' + (p.excerpt ? '<p class="lede">' + esc(p.excerpt) + '</p>' : '') + '<p class="small muted">' + esc(p.author || 'Livance') + ' · ' + istStr(p.publishedAt, false) + '</p></div></section>' +
      (img ? '<div class="wrap narrow" style="margin-bottom:28px"><figure class="photo wide"><img src="' + img + '" alt=""></figure></div>' : '') + '<section class="band-sm" style="padding-top:0"><div class="wrap narrow"><div class="prose">' + MD.markdown(p.body) + '</div></div></section>' +
      '<section class="band alt"><div class="wrap between"><h2>Need a workspace or a business address?</h2><div class="row"><a class="btn btn-primary" href="#/virtual-office">Virtual office</a><a class="btn btn-ghost" href="#/contact">Talk to us</a></div></div></section>' };
  };

  /* the link a client gets with a proposal */
  routes['/proposal'] = function (q) {
    var p = db.props.filter(function (x) { return x.token === q.t; })[0];
    if (!p || p.status === 'draft') return { html: pageHead('Proposal', 'This link isn\'t valid.', 'Ask your Livance contact for a new one.') };
    var l = lead(p.leadId), owner = l.ownerId ? byId('users', l.ownerId) : null, expired = p.validUntil < ist().date && ['accepted', 'declined'].indexOf(p.status) < 0;
    if (!p.viewedAt) { p.viewedAt = NOW(); if (p.status === 'sent') p.status = 'viewed'; act(l.id, null, 'proposal', 'Client opened proposal ' + p.number); save(); }
    return { html: '<section class="band-sm"><div class="wrap" style="max-width:880px"><div class="stack" style="gap:8px;margin-bottom:22px"><span class="eyebrow">Proposal ' + p.number + (p.version > 1 ? ' · v' + p.version : '') + '</span><h1 style="font-size:clamp(1.8rem,3.4vw,2.6rem)">' + esc(p.title) + '</h1><p class="muted">Prepared for <b>' + esc(l.name) + '</b>' + (l.company ? ', ' + esc(l.company) : '') + ' · valid until ' + p.validUntil + '</p></div>' +
      (p.status === 'accepted' ? '<p class="alert ok">Accepted. Thank you! ' + esc(owner ? owner.name : 'Our team') + ' will be in touch to complete the next steps.</p>' : p.status === 'declined' ? '<p class="alert info">You declined this proposal.</p>' : expired ? '<p class="alert error">This proposal has expired.</p>' : '') +
      '<div class="card stack-lg">' + (p.intro ? '<p style="white-space:pre-line">' + esc(p.intro) + '</p>' : '') + '<div class="tbl" style="border:0"><table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>' + p.items.map(function (it) { return '<tr><td>' + esc(it.desc) + (it.unit ? ' (per ' + esc(it.unit) + ')' : '') + '</td><td class="num">' + it.qty + '</td><td class="num mono">' + rs(it.price) + '</td><td class="num mono">' + rs(Math.round(it.price * it.qty)) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="sum-rows" style="max-width:340px;margin-left:auto;width:100%"><div><span>Subtotal</span><span>' + rs(p.subtotal) + '</span></div>' + (p.discount ? '<div class="neg"><span>Discount</span><span>− ' + rs(p.discount) + '</span></div>' : '') + '<div><span>GST 18%</span><span>' + rs(p.gst) + '</span></div></div><div class="sum-total" style="max-width:340px;margin-left:auto;width:100%"><span>Total</span><b>' + rs(p.total) + '</b></div>' +
      '<div class="stack" style="gap:6px"><h3>Terms</h3><p class="small muted" style="white-space:pre-line">' + esc(p.terms) + '</p></div>' +
      (['accepted', 'declined'].indexOf(p.status) < 0 && !expired ? '<div class="row"><button class="btn btn-primary" id="p-acc">Accept proposal</button><button class="btn btn-ghost" id="p-dec">Decline</button></div>' : '') + '</div>' +
      (owner ? '<p class="small muted" style="margin-top:16px">Questions? ' + esc(owner.name) + ' · ' + esc(owner.email) + '</p>' : '') + '<p class="xs muted">Demo: this is the page your client opens from the email. <a class="link" href="' + link('/admin/crm/lead?id=' + l.id) + '">Back to the lead</a></p></div></section>',
      init: function () {
        var dec = function (d, reason) { p.status = d; p.decidedAt = NOW(); p.declineReason = reason || null; act(l.id, null, 'proposal', 'Client ' + d + ' proposal ' + p.number + ' online' + (reason ? ': “' + reason + '”' : '')); if (d === 'accepted') setStage(l.id, 'won', null, { value: p.subtotal - p.discount }); outMail(owner ? owner.email : 'hello@livance.co.in', 'Proposal ' + d + ': ' + p.number); save(); toast('Proposal ' + d + '. The owner is notified.'); render(); };
        var a2 = $('#p-acc'); if (a2) a2.onclick = function () { dec('accepted'); };
        var d2 = $('#p-dec'); if (d2) d2.onclick = function () { dec('declined', 'Going with another option'); };
      } };
  };

/* ---- ext/04-member.js ---- */
  /* ---------------- member dashboard: support and credits ---------------- */
  function dash(tab, inner) {
    var u = me(), desk = u && deskOf(u.id);
    var tabs = [['o', '/dashboard', 'Overview'], ['b', '/dashboard/bookings', 'Bookings'], ['i', '/dashboard/invoices', 'Invoices']];
    if (desk) tabs.push(['c', '/dashboard/credits', 'Meeting room credits']);
    tabs.push(['s', '/dashboard/support', 'Support']);
    return '<div class="wrap dash"><nav class="dash-nav">' + tabs.map(function (t2) { return '<a href="' + link(t2[1]) + '" class="' + (tab === t2[0] ? 'on' : '') + '">' + t2[2] + '</a>'; }).join('') + '<button class="link small" id="logout" style="padding:11px 14px;color:var(--muted);text-align:left">Log out</button></nav><div class="stack-lg" style="min-width:0">' + inner + '</div></div>';
  }
  var baseBookingRow = bookingRow;
  routes['/dashboard/credits'] = function () {
    if (needUser('/dashboard/credits')) return; var u = me(), d = deskOf(u.id);
    if (!d) return { html: dash('c', '<h1 style="font-size:clamp(1.7rem,3vw,2.2rem)">Meeting room credits</h1><div class="card flat"><p class="muted">Credits come with a dedicated desk membership.</p></div>'), init: bindDash };
    var b = balance(d), per = db.settings.creditsPerHour; save();
    var led = db.ledger.filter(function (x) { return x.dcId === d.id; }).slice().reverse();
    return { html: dash('c', '<h1 style="font-size:clamp(1.7rem,3vw,2.2rem)">Meeting room credits</h1><p class="muted">' + esc(d.name) + ' · ' + d.seats + ' seats · ' + esc(centre(d.centre).name) + '</p>' +
      '<div class="kpis"><div class="kpi"><span>Available now</span><b class="mono">' + b.total.toLocaleString('en-IN') + '</b><small>≈ ' + (Math.round(b.total / per * 10) / 10) + ' hours in a 4-seat room</small></div><div class="kpi"><span>Left this month</span><b class="mono">' + b.monthly.toLocaleString('en-IN') + '</b><small>of ' + b.allotment.toLocaleString('en-IN') + ' · resets on the 1st</small></div><div class="kpi"><span>Bought credits</span><b class="mono">' + b.purchased.toLocaleString('en-IN') + '</b><small>Kept while your membership runs</small></div></div>' +
      '<div class="card stack"><h3>How credits work</h3><p class="muted small">1 credit = ₹1 of meeting room time at list price. A 4-seat room is 400 credits an hour, the 10-seat boardroom 1,000. Monthly credits are used first. Book from the <a class="link" href="#/meeting-rooms">meeting rooms page</a> and choose "Use meeting room credits" at checkout.</p></div>' +
      '<div class="card form"><div class="between"><h3>Need more?</h3><span class="small muted">₹1 per credit + GST, invoiced through Zoho Books</span></div><div class="seg-radio" id="buy">' + [400, 1000, 2000, 5000].map(function (n, i) { return '<label><input type="radio" name="cr" value="' + n + '"' + (i === 1 ? ' checked' : '') + '><span>' + n.toLocaleString('en-IN') + ' credits · ₹' + n.toLocaleString('en-IN') + '</span></label>'; }).join('') + '</div><button class="btn btn-primary" style="width:fit-content" id="buy-go">Buy credits</button></div>' +
      '<div class="stack"><h3>History</h3><div class="tbl"><table class="dense"><thead><tr><th>Date</th><th>What</th><th class="num">Credits</th></tr></thead><tbody>' + led.map(function (x) { return '<tr><td class="small">' + istStr(x.at, false) + '</td><td class="small">' + ({ allotment: 'Monthly allotment', booking: 'Booking', cancel: 'Cancellation', purchase: 'Bought', adjustment: 'Adjustment by Livance' }[x.reason] || x.reason) + (x.note ? ' · ' + esc(x.note) : '') + '</td><td class="num mono" style="color:' + (x.delta < 0 ? 'var(--red)' : 'var(--green)') + '">' + (x.delta > 0 ? '+' : '') + x.delta.toLocaleString('en-IN') + '</td></tr>'; }).join('') + '</tbody></table></div></div>'),
      init: function () { bindDash(); $('#buy-go').onclick = function () { go('/checkout?product=credits&credits=' + $('input[name="cr"]:checked').value); }; } };
  };
  routes['/dashboard/support'] = function () {
    if (needUser('/dashboard/support')) return; var u = me(), rows = db.tickets.filter(function (t2) { return t2.userId === u.id; }).sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return { html: dash('s', '<h1 style="font-size:clamp(1.7rem,3vw,2.2rem)">Support</h1><div class="g2" style="align-items:start"><form class="card form" id="tk"><h3>Raise a ticket</h3><div class="field"><label>Subject</label><input name="subject" maxlength="120"></div><div class="f2"><div class="field"><label>About</label><select name="category"><option value="">Choose</option>' + Object.keys(TCAT).map(function (k) { return '<option value="' + k + '">' + TCAT[k] + '</option>'; }).join('') + '</select></div><div class="field"><label>How urgent?</label><select name="priority"><option value="normal">Normal</option><option value="high">High: affecting my work</option><option value="urgent">Urgent: can\'t work at all</option><option value="low">Low: whenever you can</option></select></div></div><div class="field"><label>Details</label><textarea name="body" rows="5"></textarea></div><span class="err" id="tk-err" hidden></span><button class="btn btn-primary" style="width:fit-content">Send</button></form>' +
      '<div class="stack"><h3>Your tickets</h3>' + (rows.length ? rows.map(function (t2) { return '<a class="card card-link" style="gap:6px;padding:16px 18px" href="' + link('/dashboard/ticket?id=' + t2.id) + '"><div class="between"><b>' + esc(t2.subject) + '</b><span class="pill ' + (t2.status === 'resolved' || t2.status === 'closed' ? 'gr' : t2.status === 'waiting' ? 'am' : '') + '">' + (t2.status === 'waiting' ? 'Reply needed' : TST[t2.status]) + '</span></div><span class="small muted mono">' + t2.number + ' · ' + TCAT[t2.category] + '</span></a>'; }).join('') : '<div class="card flat"><p class="muted small">No tickets yet.</p></div>') + '</div></div>'),
      init: function () { bindDash(); onSubmit($('#tk'), function (e) { var f = e.target, er = $('#tk-err'); if (f.subject.value.trim().length < 4 || !f.category.value || f.body.value.trim().length < 10) { er.hidden = false; er.textContent = 'Add a subject, choose what it\'s about, and describe the issue.'; return; }
        var t2 = { id: ++db.seq, number: 'T' + ist().date.slice(2, 7).replace('-', '') + '-' + String(db.tickets.length + 1).padStart(4, '0'), userId: u.id, subject: f.subject.value.trim(), category: f.category.value, priority: f.priority.value, status: 'open', assigneeId: null, centre: (deskOf(u.id) || {}).centre || null, createdAt: NOW(), updatedAt: NOW(), firstResponseAt: null };
        db.tickets.push(t2); db.tmsgs.push({ id: ++db.seq, ticketId: t2.id, authorId: u.id, staff: false, internal: false, body: f.body.value.trim(), at: NOW() }); outMail('hello@livance.co.in', '[' + t2.number + '] ' + t2.subject); save(); toast('Ticket ' + t2.number + ' raised. We\'ll reply here and by email.'); go('/dashboard/ticket?id=' + t2.id); }); } };
  };
  routes['/dashboard/ticket'] = function (q) {
    if (needUser('/dashboard/support')) return; var u = me(), t2 = db.tickets.filter(function (x) { return x.id === +q.id && x.userId === u.id; })[0]; if (!t2) { go('/dashboard/support'); return; }
    var msgs = db.tmsgs.filter(function (m2) { return m2.ticketId === t2.id && !m2.internal; });
    return { html: dash('s', '<div class="crumbs"><a href="#/dashboard/support">Support</a><span>›</span><span class="mono">' + t2.number + '</span></div><div class="between"><h1 style="font-size:clamp(1.5rem,2.6vw,2rem)">' + esc(t2.subject) + '</h1><span class="pill">' + TST[t2.status] + '</span></div><div class="stack">' +
      msgs.map(function (m2) { return '<div class="msg ' + (m2.staff ? 'staff' : '') + '"><span class="meta"><b>' + (m2.staff ? esc(userName(m2.authorId)) + ' · Livance' : 'You') + '</b> · ' + istStr(m2.at) + '</span><div style="white-space:pre-wrap">' + esc(m2.body) + '</div></div>'; }).join('') + '</div>' +
      (t2.status !== 'closed' ? '<form class="card form" id="rp"><div class="field"><label>Reply</label><textarea name="body" rows="4"></textarea></div><div class="row"><button class="btn btn-primary">Send reply</button>' + (t2.status === 'resolved' ? '<button type="button" class="btn btn-ghost" id="close">It\'s fixed, close the ticket</button>' : '') + '</div></form>' : '')),
      init: function () { bindDash(); onSubmit($('#rp'), function (e) { var b = e.target.body.value.trim(); if (b.length < 2) return; db.tmsgs.push({ id: ++db.seq, ticketId: t2.id, authorId: u.id, staff: false, internal: false, body: b, at: NOW() }); if (t2.status === 'waiting' || t2.status === 'resolved') t2.status = 'open'; t2.updatedAt = NOW(); save(); toast('Reply sent'); render(); });
        var c = $('#close'); if (c) c.onclick = function () { t2.status = 'closed'; save(); render(); }; } };
  };

  /* checkout: credits purchase, and paying for a room with credits */
  var baseCheckout = routes['/checkout'];
  routes['/checkout'] = function (q, path) {
    if (needUser(current)) return;
    var u = me();
    if (q.product === 'credits') {
      var d = deskOf(u.id); if (!d) { toast('Credits are for dedicated desk members.'); go('/dashboard'); return; }
      var n = Math.max(100, Math.min(100000, Math.round((+q.credits || 1000) / 100) * 100)), ck = d.centre;
      var params = { centre: ck, credits: n };
      return { html: '<section class="band-sm"><div class="wrap"><div class="stack" style="gap:8px;margin-bottom:28px"><div class="crumbs"><a href="#/dashboard/credits">Credits</a><span>›</span><span>Checkout</span></div><h1 style="font-size:clamp(1.8rem,3.2vw,2.4rem)">Confirm and pay.</h1></div><div class="split"><div class="card" style="padding:clamp(22px,3vw,34px)"><div class="q"><h3>Your credits</h3><div class="review"><b>' + n.toLocaleString('en-IN') + ' meeting room credits</b><span class="muted">' + esc(d.name) + ' · ' + esc(centre(ck).name) + '</span><span>₹1 per credit + GST. Added to your balance as soon as you pay.</span></div></div>' + billingHtml(centre(ck).state) +
        '<div class="q"><label class="check"><input type="checkbox" id="agree"><span>I agree to the Terms. Credits are non-refundable and can be used at any Livance centre.</span></label><span class="err" id="agree-err" hidden>Accept the terms to continue.</span></div></div>' + summaryHtml() + '</div></div></section>',
        init: function () { var sm = new Summary(function () { return { product: 'credits', params: params }; }); sm.onDraw = function (qq) { $('#pay-btn').textContent = 'Pay ' + rs(qq.total) + ' securely'; $('#cp-form').hidden = true; }; sm.draw();
          $('#pay-btn').onclick = function () { var b = billingOk(); if (!b) return; if (!$('#agree').checked) { $('#agree-err').hidden = false; return; } var qq = sm.quote(); pay(qq.total, function () { var o = placeOrder('credits', params, qq, b); if (o) { toast(n.toLocaleString('en-IN') + ' credits added.'); go('/dashboard/credits'); } }); }; } };
    }
    var out = baseCheckout(q, path); if (!out) return out;
    var d2 = q.product === 'meeting_room' && deskOf(u.id);
    if (!d2) return out;
    var r = room(q.roomId), cost = Math.round(hourly(r) / 100) * (+q.hours), bal = balance(d2), enough = bal.total >= cost;
    var choose = '<div class="q"><h3>How do you want to pay?</h3><div class="choices"><label class="choice"><input type="radio" name="paywith" value="credits"' + (enough ? ' checked' : ' disabled') + '><b>Use meeting room credits</b><span class="d">' + cost.toLocaleString('en-IN') + ' credits · you have ' + bal.total.toLocaleString('en-IN') + ' (' + bal.monthly.toLocaleString('en-IN') + ' this month + ' + bal.purchased.toLocaleString('en-IN') + ' bought)' + (enough ? '' : '. Not enough: buy more or pay below.') + '</span></label><label class="choice"><input type="radio" name="paywith" value="money"' + (enough ? '' : ' checked') + '><b>Pay by UPI, card or net banking</b><span class="d">GST invoice from Zoho Books</span></label></div></div>';
    out.html = out.html.replace('<div class="q" id="billing-wrap">', choose + '<div class="q" id="billing-wrap">');
    var baseInit = out.init;
    out.init = function () {
      baseInit();
      var withC = function () { var x = $('input[name="paywith"]:checked'); return x && x.value === 'credits'; };
      var mode = function () { $('#billing-wrap').hidden = withC(); $('.summary').classList.toggle('dim', withC()); $('#pay-btn').textContent = withC() ? 'Book with ' + cost.toLocaleString('en-IN') + ' credits' : 'Pay securely'; };
      $$('input[name="paywith"]').forEach(function (x) { x.onchange = mode; }); mode();
      var payBtn = $('#pay-btn'), moneyPay = payBtn.onclick;
      payBtn.onclick = function () {
        if (!withC()) return moneyPay();
        if (!$('#agree').checked) { $('#agree-err').hidden = false; return; }
        var a = availability(r.id, q.date); for (var h = +q.start; h < +q.start + +q.hours; h++) { var s2 = a.hours.filter(function (x) { return x.hour === h; })[0]; if (!s2 || s2.status !== 'free') { toast('Someone just booked one of those hours.'); return; } }
        var b2 = balance(d2); if (b2.total < cost) { toast('Not enough credits.'); return; }
        var bid = ++db.seq; db.bookings.push({ id: bid, orderId: null, userId: u.id, kind: 'meeting_room', centre: r.centre, roomId: r.id, date: q.date, start: +q.start, end: +q.start + +q.hours, status: 'confirmed', paidWith: 'credits' });
        var fromM = Math.min(b2.monthly, cost); if (fromM) grant(d2.id, -fromM, 'monthly', 'booking', r.name + ', ' + q.date + ' ' + hh(+q.start) + ' × ' + q.hours + 'h', u.id, bid); if (cost - fromM) grant(d2.id, -(cost - fromM), 'purchased', 'booking', r.name + ', ' + q.date, u.id, bid);
        save(); toast('Booked with ' + cost.toLocaleString('en-IN') + ' credits. The room is blocked for you.'); go('/dashboard/bookings');
      };
    };
    return out;
  };
  // Credits purchases are priced like any other order (₹1 per credit, GST at the centre).
  var baseLines = lines;
  lines = function (product, p) { if (product === 'credits') return [{ desc: 'Meeting room credits (' + p.credits.toLocaleString('en-IN') + '), ' + centre(p.centre).name, sac: '997212', pos: 'property', qty: p.credits, unit: INR(1), amount: INR(1) * p.credits }]; return baseLines(product, p); };
  // Cancelling a credit booking returns credits by the same 100/50/0 rule.
  var baseCancel = cancel;
  cancel = function (id) {
    var b = db.bookings.filter(function (x) { return x.id === id; })[0];
    if (!b || b.paidWith !== 'credits') return baseCancel(id);
    var pct = refundPct(b); $('#confirm-text').textContent = 'Cancel this booking? ' + (pct ? pct + '% of the credits come back.' : 'It starts within 12 hours, so no credits come back.'); $('#confirm').hidden = false;
    $('#confirm-yes').onclick = function () { $('#confirm').hidden = true; b.status = 'cancelled'; db.ledger.filter(function (x) { return x.bookingId === b.id && x.reason === 'booking'; }).forEach(function (x) { var back = Math.round(-x.delta * pct / 100); if (back) grant(x.dcId, back, x.bucket, 'cancel', pct + '% returned on cancellation', b.userId, b.id); }); save(); toast('Cancelled. Credits returned.'); render(); };
    $('#confirm-no').onclick = function () { $('#confirm').hidden = true; };
  };

/* ---- ext/05-admin-crm.js ---- */
  /* ---------------- admin shell ---------------- */
  function needAdmin() {
    var u = me(), p = parse().path;
    if (!u || !isStaff(u) || (CONNECTED && liveRole!=='admin')) { go('/login?next=' + encodeURIComponent(current)); toast('Sign in as your authorized administrator'); return true; }
    if (!pathAllowed(p)) { app.innerHTML = header(p) + '<main>' + admin('', '<h1>No access</h1><p class="muted">' + esc(u.name) + ' (' + esc(roleLabel(u)) + ') can\'t open this section. Switch roles in the bar above to compare.</p>') + '</main>' + footer(); bindChrome(); bindAdmin(); return true; }
    return false;
  }
  function admin(tab, inner) {
    var u = me();
    var nav = NAV.map(function (g) { var items = g[1].filter(function (x) { return !x[3] || canAny(x[3]); }); return items.length ? '<p class="adm-group">' + g[0] + '</p>' + items.map(function (x) { return '<a href="' + link(x[1]) + '" class="' + (x[0] === tab ? 'on' : '') + '">' + x[2] + '</a>'; }).join('') : ''; }).join('');
    return '<div class="adm"><aside class="adm-side" id="adm-side"><div class="adm-who"><b>' + esc(u.name) + '</b><span>' + esc(roleLabel(u)) + '</span></div><nav aria-label="Admin">' + nav + '</nav><div class="adm-out"><button class="link" id="alogout">Log out</button></div></aside>' +
      '<div class="adm-main"><button type="button" class="btn btn-ghost btn-sm adm-menu" id="adm-menu">Menu</button><div class="stack-lg">' + inner + '</div></div></div>';
  }
  function bindAdmin() {
    var lo = $('#alogout'); if (lo) lo.onclick = function () { db.session = null; if (CONNECTED) { liveRole=null; BRIDGE.signOut().catch(liveFail); } save(); go('/'); };
    var mb = $('#adm-menu'); if (mb) mb.onclick = function () { $('#adm-side').classList.toggle('open'); };
    bindInvoiceButtons();
    $$('[data-toggle]').forEach(function (b) { b.onclick = function () { var t2 = $(b.dataset.toggle); if (t2) t2.hidden = !t2.hidden; }; });
  }
  var A = function (tab, inner, init) { return { html: admin(tab, inner), init: function () { bindAdmin(); if (init) init(); } }; };
  function stPill(s2) { return '<span class="st st-' + s2 + '">' + STAGE[s2] + '</span>'; }
  function vals(form) { var o = {}; $$('input, select, textarea', form).forEach(function (i) { if (!i.name) return; if ((i.type === 'checkbox' || i.type === 'radio') && !i.checked) return; if (o[i.name] !== undefined) { o[i.name] = [].concat(o[i.name], i.value); } else o[i.name] = i.value; }); return o; }
  var istInput = function (ms) { return new Date(ms + 330 * 6e4).toISOString().slice(0, 16); };
  var fromIstInput = function (s2) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s2 || '') ? Date.parse(s2 + ':00Z') - 330 * 6e4 : null; };

  /* ---------------- My day ---------------- */
  routes['/admin'] = function () {
    if (needAdmin()) return; var u = me(), t = ist().date, ds = dayStartMs(t), ms = dayStartMs(t.slice(0, 8) + '01');
    syncRenewals();
    var isCrm = canAny(['crm.own', 'crm.team', 'crm.all']), h = new Date(Date.now() + 330 * 6e4).getUTCHours();
    var html = '<div class="between"><div class="stack" style="gap:4px"><h1>Good ' + (h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening') + ', ' + esc(u.name.split(' ')[0]) + '.</h1><p class="muted">' + fmtDay(t) + ' · ' + esc(roleLabel(u)) + '</p></div>' + (isCrm ? '<a class="btn btn-primary" href="#/admin/crm/new">Add a lead</a>' : '') + '</div>';
    if (isCrm) {
      var vis = visibleLeads(u), open = vis.filter(function (l) { return OPEN_ST.indexOf(l.stage) > -1; }), won = vis.filter(function (l) { return l.stage === 'won' && l.wonAt >= ms; });
      var od = open.filter(overdue).length, today = vis.filter(function (l) { return l.nextFollowUp >= ds && l.nextFollowUp < ds + 864e5; }).length;
      html += '<div class="kpis"><a class="kpi ' + (od ? 'warn' : '') + '" href="#/admin/crm?follow=overdue"><span>Overdue follow-ups</span><b>' + od + '</b><small>Do these first</small></a><a class="kpi" href="#/admin/crm?follow=today"><span>Due today</span><b>' + today + '</b><small>Calls and follow-ups</small></a><a class="kpi" href="#/admin/crm?stage=new"><span>New, not contacted</span><b>' + vis.filter(function (l) { return l.stage === 'new'; }).length + '</b><small>Call within the hour</small></a><a class="kpi" href="#/admin/crm?stage=open"><span>Open leads</span><b>' + open.length + '</b><small>' + rs0(open.reduce(function (n, l) { return n + (l.value || 0); }, 0)) + ' in pipeline</small></a><a class="kpi" href="#/admin/crm?stage=won"><span>Won this month</span><b>' + rs0(won.reduce(function (n, l) { return n + (l.value || 0); }, 0)) + '</b><small>' + won.length + ' deals</small></a></div>';
      var rems = db.rems.filter(function (r) { return r.ownerId === u.id && !r.doneAt && r.dueAt < ds + 864e5; }).sort(function (a, b) { return a.dueAt - b.dueAt; });
      var fresh = vis.filter(function (l) { return l.stage === 'new'; }).sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 6);
      html += '<div class="g2" style="align-items:start"><div class="card"><div class="between"><h3>Your follow-ups</h3><a class="link small" href="#/admin/crm?follow=overdue">All</a></div>' + (rems.length ? rems.map(function (r) { var l = lead(r.leadId); return '<div class="doc-row"><div class="stack" style="gap:2px;min-width:0"><a class="link" href="' + link('/admin/crm/lead?id=' + l.id) + '"><b>' + esc(l.name) + '</b>' + (l.company && l.company !== l.name ? ' · ' + esc(l.company) : '') + '</a><span class="xs" style="color:' + (r.dueAt < NOW() ? 'var(--red)' : 'var(--muted)') + '">' + ago(r.dueAt) + ' · ' + esc(r.note) + '</span></div><div class="row" style="flex-wrap:nowrap"><a class="btn btn-ghost btn-sm" href="tel:+91' + l.phone + '">Call</a><button class="btn btn-ghost btn-sm" data-done="' + r.id + '">Done</button></div></div>'; }).join('') : '<p class="small muted">Nothing due' + (u.role === 'admin' ? ' for you. Switch to Sahil or Tara in the bar above to see a sales day.' : '. Nice.') + '</p>') + '</div>' +
        '<div class="card"><div class="between"><h3>New leads</h3><a class="link small" href="#/admin/crm?stage=new">All</a></div>' + (fresh.length ? fresh.map(function (l) { return '<div class="doc-row"><div class="stack" style="gap:2px;min-width:0"><a class="link" href="' + link('/admin/crm/lead?id=' + l.id) + '"><b>' + esc(l.name) + '</b>' + (l.company && l.company !== l.name ? ' · ' + esc(l.company) : '') + '</a><span class="xs muted">' + esc(l.source) + ' · ' + ago(l.createdAt) + ' · ' + (l.ownerId ? esc(userName(l.ownerId)) : 'unassigned') + '</span></div><a class="btn btn-ghost btn-sm" href="tel:+91' + l.phone + '">Call</a></div>'; }).join('') : '<p class="small muted">No new leads.</p>') + '</div></div>';
      var un = canAssign() ? db.leads.filter(function (l) { return !l.ownerId && l.stage === 'new'; }) : [];
      if (un.length) html += '<div class="card"><div class="between"><h3>Unassigned (' + un.length + ')</h3><div class="row"><select id="un-to" style="width:auto;min-height:38px;padding:6px 10px">' + staffList(true).filter(function (x) { return x.role !== 'admin'; }).map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('') + '</select><button class="btn btn-dark btn-sm" id="un-go">Assign all</button></div></div>' + un.map(function (l) { return '<div class="doc-row"><span><a class="link" href="' + link('/admin/crm/lead?id=' + l.id) + '"><b>' + esc(l.name) + '</b></a> · ' + l.phone + ' <span class="xs muted">· ' + esc(l.source) + ' · ' + ago(l.createdAt) + '</span></span></div>'; }).join('') + '</div>';
    }
    if (can('renewals')) { var rn = dueSubs().filter(function (x) { return x.daysLeft <= 30; }); if (rn.length) html += '<div class="card"><div class="between"><h3>Renewals in the next 30 days</h3><a class="link small" href="#/admin/renewals">All renewals</a></div>' + rn.map(function (x) { return '<div class="doc-row"><span><b>' + esc(x.name) + '</b> · ' + esc(x.what) + '</span><span class="pill ' + (x.daysLeft < 0 ? 'rd' : x.daysLeft <= 15 ? 'am' : '') + '">' + (x.daysLeft < 0 ? 'Expired' : x.daysLeft + ' days left') + '</span></div>'; }).join('') + '</div>'; }
    var k = '';
    if (can('dashboard')) k += '<a class="kpi" href="#/admin/dashboard"><span>Online revenue this month</span><b>' + rs0(db.orders.filter(function (o) { return o.status !== 'cancelled' && (o.paidMs || 0) >= ms; }).reduce(function (n, o) { return n + o.quote.taxable; }, 0)) + '</b><small>Before GST</small></a>';
    if (can('kyc')) k += '<a class="kpi" href="#/admin/vos"><span>KYC to review</span><b>' + db.vos.filter(function (v) { return v.status === 'kyc_review'; }).length + '</b><small>Virtual offices</small></a>';
    if (can('tickets')) k += '<a class="kpi" href="#/admin/tickets"><span>Open tickets</span><b>' + db.tickets.filter(function (x) { return x.status === 'open' || x.status === 'in_progress'; }).length + '</b><small>' + db.tickets.filter(function (x) { return x.assigneeId === u.id && ['open', 'in_progress', 'waiting'].indexOf(x.status) > -1; }).length + ' assigned to you</small></a>';
    if (k) html += '<div class="kpis">' + k + '</div>';
    if (can('bookings')) html += '<div class="between"><h3>Room schedule</h3><input type="date" id="sd" value="' + t + '" style="width:auto"></div><div id="sched" class="stack-lg">' + schedule(t) + '</div>';
    return A('home', html, function () {
      $$('[data-done]').forEach(function (b) { b.onclick = function () { doneRem(+b.dataset.done, u.id); save(); toast('Done'); render(); }; });
      var ug = $('#un-go'); if (ug) ug.onclick = function () { db.leads.filter(function (l) { return !l.ownerId && l.stage === 'new'; }).forEach(function (l) { assign(l.id, +$('#un-to').value, u.id, 'assigned by manager'); }); save(); toast('Assigned'); render(); };
      var sd = $('#sd'); if (sd) sd.onchange = function (e) { $('#sched').innerHTML = schedule(e.target.value); };
    });
  };
  routes['/admin/schedule'] = function () { if (needAdmin()) return; var t = ist().date; return A('schedule', '<div class="between"><h1>Room schedule</h1><input type="date" id="sd" value="' + t + '" style="width:auto"></div><div id="sched" class="stack-lg">' + schedule(t) + '</div>', function () { $('#sd').onchange = function (e) { $('#sched').innerHTML = schedule(e.target.value); }; }); };

  /* ---------------- CRM list and board ---------------- */
  routes['/admin/crm'] = function (q) {
    if (needAdmin()) return; syncRenewals();
    var f = {}; ['stage', 'owner', 'solution', 'centre', 'source', 'follow', 'from', 'to', 'q', 'tag', 'kind', 'sort'].forEach(function (k) { if (q[k]) f[k] = q[k]; }); if (!f.kind) f.kind = 'new';
    var view = q.view === 'board' ? 'board' : 'list', rows = filterLeads(view === 'board' ? Object.assign({}, f, { stage: f.stage === 'open' ? '' : f.stage }) : f);
    var team = staffList(true), sources = []; db.leads.forEach(function (l) { if (sources.indexOf(l.source) < 0) sources.push(l.source); });
    var counts = {}; visibleLeads().filter(function (l) { return l.kind === f.kind; }).forEach(function (l) { counts[l.stage] = (counts[l.stage] || 0) + 1; });
    var qs = qsOf(f), sel = function (name, opts, cur) { return '<select name="' + name + '"><option value="">Any</option>' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(cur) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; };
    var html = '<div class="between"><div class="stack" style="gap:4px"><h1>' + (f.kind === 'renewal' ? 'Renewal leads' : 'Leads') + '</h1><p class="muted small">' + rows.length + ' shown · ' + (can('crm.all') ? 'all leads' : can('crm.team') ? 'your team\'s leads' : 'your leads only') + '</p></div><div class="row"><div class="tabs-sm"><a href="' + link('/admin/crm?' + qs) + '" class="' + (view === 'list' ? 'on' : '') + '">List</a><a href="' + link('/admin/crm?' + qs + '&view=board') + '" class="' + (view === 'board' ? 'on' : '') + '">Board</a></div>' +
      (can('crm.bulk') ? '<a class="btn btn-ghost btn-sm" href="#/admin/crm/campaigns">Bulk emails</a>' : '') + (canAny(['crm.all', 'crm.team']) ? '<a class="btn btn-ghost btn-sm" href="#/admin/crm/settings">Settings</a>' : '') + '<a class="btn btn-primary btn-sm" href="#/admin/crm/new">Add a lead</a></div></div>' +
      '<div class="tabs-sm"><a href="' + link('/admin/crm?kind=' + f.kind) + '" class="' + (!f.stage ? 'on' : '') + '">All</a><a href="' + link('/admin/crm?kind=' + f.kind + '&stage=open') + '" class="' + (f.stage === 'open' ? 'on' : '') + '">Open</a>' + STAGES.map(function (s2) { return '<a href="' + link('/admin/crm?kind=' + f.kind + '&stage=' + s2[0]) + '" class="' + (f.stage === s2[0] ? 'on' : '') + '">' + s2[1] + ' <span class="soft">' + (counts[s2[0]] || 0) + '</span></a>'; }).join('') + '</div>' +
      '<form class="filters" id="flt"><div class="field" style="flex:2 1 220px"><label>Search</label><input type="search" name="q" value="' + esc(f.q || '') + '" placeholder="Name, phone, email, company"></div>' +
      '<div class="field"><label>Stage</label>' + sel('stage', [['open', 'Open (not won/lost)']].concat(STAGES), f.stage) + '</div>' +
      (canAny(['crm.team', 'crm.all']) ? '<div class="field"><label>Owner</label>' + sel('owner', [['me', 'Me'], ['none', 'Unassigned']].concat(team.map(function (x) { return [x.id, x.name]; })), f.owner) + '</div>' : '') +
      '<div class="field"><label>Solution</label>' + sel('solution', Object.keys(SOLUTIONS).map(function (k) { return [k, SOLUTIONS[k]]; }), f.solution) + '</div>' +
      '<div class="field"><label>Follow-up</label>' + sel('follow', Object.keys(FOLLOW).map(function (k) { return [k, FOLLOW[k]]; }), f.follow) + '</div>' +
      '<div class="field"><label>Source</label>' + sel('source', sources.map(function (x) { return [x, x]; }), f.source) + '</div>' +
      '<div class="field"><label>Centre</label>' + sel('centre', db.centres.map(function (c) { return [c.key, c.name]; }), f.centre) + '</div>' +
      '<div class="field"><label>Type</label><select name="kind"><option value="new"' + (f.kind === 'new' ? ' selected' : '') + '>New business</option><option value="renewal"' + (f.kind === 'renewal' ? ' selected' : '') + '>Renewals</option></select></div>' +
      '<div class="field"><label>Created from</label><input type="date" name="from" value="' + (f.from || '') + '"></div><div class="field"><label>to</label><input type="date" name="to" value="' + (f.to || '') + '"></div>' +
      '<div class="field"><label>Tag</label><input name="tag" value="' + esc(f.tag || '') + '" placeholder="e.g. hot"></div><div class="field"><label>Sort</label><select name="sort">' + [['recent', 'Newest'], ['activity', 'Last activity'], ['follow', 'Next follow-up'], ['value', 'Deal value']].map(function (o) { return '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="row" style="flex:0 0 auto"><button class="btn btn-dark btn-sm">Apply</button><a class="btn btn-ghost btn-sm" href="' + link('/admin/crm' + (view === 'board' ? '?view=board' : '')) + '">Clear</a>' + (can('crm.export') ? '<button type="button" class="btn btn-ghost btn-sm" id="csv">Export CSV</button>' : '') + '</div></form>';
    if (view === 'board') {
      html += '<div class="board">' + STAGES.map(function (s2) { var col = rows.filter(function (x) { return x.stage === s2[0]; });
        return '<div class="board-col" data-stage="' + s2[0] + '"><h4><span>' + s2[1] + '</span><span class="soft">' + col.length + ' · ' + rs0(col.reduce(function (n, x) { return n + (x.value || 0); }, 0)) + '</span></h4>' + col.map(function (x) { return '<a class="lc ' + (overdue(x) ? 'over' : '') + '" href="' + link('/admin/crm/lead?id=' + x.id) + '" draggable="' + (s2[0] !== 'lost') + '" data-id="' + x.id + '"><b>' + esc(x.name) + '</b><span class="muted">' + esc(x.company || SOLUTIONS[x.solution] || x.source) + '</span><span class="xs muted">' + (x.ownerId ? esc(userName(x.ownerId)) : 'Unassigned') + (x.nextFollowUp ? ' · follow ' + ago(x.nextFollowUp) : '') + '</span></a>'; }).join('') + '</div>'; }).join('') + '</div><p class="xs muted">Drag a card to another stage. To mark a lead lost, open it and give a reason.</p>';
    } else {
      html += '<div id="bulk"><div class="row" style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 12px"><label class="row small" style="gap:8px"><input type="checkbox" id="all"> Select all</label><span class="small muted" id="cnt">0 selected</span><select id="bact" style="width:auto;min-height:38px;padding:6px 10px"><option value="">Bulk action…</option>' + (canAssign() ? '<option value="assign">Transfer to…</option>' : '') + '<option value="stage">Move to stage…</option><option value="tag">Add tag…</option>' + (can('crm.bulk') ? '<option value="email">Send email…</option>' : '') + '</select>' +
        '<select id="b-owner" data-for="assign" hidden style="width:auto;min-height:38px;padding:6px 10px"><option value="">Unassigned</option>' + team.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('') + '</select><select id="b-stage" data-for="stage" hidden style="width:auto;min-height:38px;padding:6px 10px">' + STAGES.filter(function (s2) { return s2[0] !== 'lost'; }).map(function (s2) { return '<option value="' + s2[0] + '">' + s2[1] + '</option>'; }).join('') + '</select><input id="b-tag" data-for="tag" hidden placeholder="tag" style="width:140px;min-height:38px;padding:6px 10px"><button class="btn btn-dark btn-sm" id="bgo">Apply</button></div>' +
        '<div class="tbl" style="margin-top:12px"><table class="dense"><thead><tr><th></th><th>Lead</th><th>Need</th><th>Stage</th><th>Owner</th><th>Follow-up</th><th>Source</th><th class="num">Value</th><th>Created</th></tr></thead><tbody>' +
        rows.map(function (x) { return '<tr class="' + (overdue(x) ? 'over' : '') + '"><td><input type="checkbox" class="pick" value="' + x.id + '"></td><td><a class="link" href="' + link('/admin/crm/lead?id=' + x.id) + '"><b>' + esc(x.name) + '</b></a>' + (x.company && x.company !== x.name ? ' · ' + esc(x.company) : '') + '<br><span class="xs muted mono">' + x.phone + '</span><span class="xs muted">' + (x.email ? ' · ' + esc(x.email) : '') + '</span>' + (x.tags.length ? '<br>' + x.tags.map(function (t2) { return '<span class="tag">' + esc(t2) + '</span>'; }).join('') : '') + '</td>' +
          '<td class="small">' + (SOLUTIONS[x.solution] || '—') + (x.voPlan ? ' · ' + PLANS[x.voPlan].short : '') + (x.seats ? ' · ' + x.seats + ' seats' : '') + '<br><span class="xs muted">' + (x.centre ? esc(centre(x.centre).short) : '') + '</span></td><td>' + stPill(x.stage) + '</td><td class="small">' + (x.ownerId ? esc(userName(x.ownerId)) : 'Unassigned') + '</td>' +
          '<td class="small" style="' + (overdue(x) ? 'color:var(--red);font-weight:600' : '') + '">' + (x.nextFollowUp ? ago(x.nextFollowUp) : '—') + '</td><td class="small">' + esc(x.source) + (x.utm && x.utm.campaign ? ' · ' + esc(x.utm.campaign) : '') + '</td><td class="num small">' + (x.value ? rs0(x.value) : '') + '</td><td class="small">' + ago(x.createdAt) + '</td></tr>'; }).join('') +
        (rows.length ? '' : '<tr><td colspan="9" class="muted">No leads match these filters.</td></tr>') + '</tbody></table></div></div>';
    }
    return A('crm', html, function () {
      onSubmit($('#flt'), function (e) { var v = vals(e.target); var o = {}; Object.keys(v).forEach(function (k) { if (v[k]) o[k] = v[k]; }); if (view === 'board') o.view = 'board'; go('/admin/crm?' + qsOf(o)); });
      var cv = $('#csv'); if (cv) cv.onclick = function () { var head = ['ID', 'Created', 'Name', 'Company', 'Phone', 'Email', 'Solution', 'Virtual office for', 'Seats', 'Centre', 'Stage', 'Owner', 'Source', 'Value (₹)', 'Next follow-up', 'Tags', 'UTM campaign'];
        download('livance-leads-' + ist().date + '.csv', [head.join(',')].concat(rows.map(function (l) { return [l.id, istStr(l.createdAt), l.name, l.company, l.phone, l.email, SOLUTIONS[l.solution] || '', VO_LABEL[l.voPlan] || '', l.seats, l.centre ? centre(l.centre).name : '', STAGE[l.stage], l.ownerId ? userName(l.ownerId) : '', l.source, l.value ? l.value / 100 : '', l.nextFollowUp ? istStr(l.nextFollowUp) : '', l.tags.join(' '), (l.utm || {}).campaign].map(csvCell).join(','); })).join('\n')); toast('Exported ' + rows.length + ' leads'); };
      if (view === 'board') {
        var dragged = null;
        $$('.lc').forEach(function (c) { c.addEventListener('dragstart', function (e) { dragged = c; e.dataTransfer.setData('text/plain', c.dataset.id); }); });
        $$('.board-col').forEach(function (col) {
          col.addEventListener('dragover', function (e) { if (col.dataset.stage !== 'lost') { e.preventDefault(); col.classList.add('drop'); } });
          col.addEventListener('dragleave', function () { col.classList.remove('drop'); });
          col.addEventListener('drop', function (e) { e.preventDefault(); col.classList.remove('drop'); if (!dragged) return; setStage(+dragged.dataset.id, col.dataset.stage, me().id); save(); toast('Moved to ' + STAGE[col.dataset.stage]); render(); });
        });
        return;
      }
      var picks = function () { return $$('.pick').filter(function (x) { return x.checked; }).map(function (x) { return +x.value; }); };
      var upd = function () { $('#cnt').textContent = picks().length + ' selected'; };
      $('#all').onchange = function () { $$('.pick').forEach(function (x) { x.checked = $('#all').checked; }); upd(); }; $$('.pick').forEach(function (x) { x.onchange = upd; });
      $('#bact').onchange = function () { $$('[data-for]').forEach(function (el) { el.hidden = el.dataset.for !== $('#bact').value; }); };
      $('#bgo').onclick = function () {
        var ids = picks(), a = $('#bact').value; if (!ids.length) return toast('Tick at least one lead.'); if (!a) return toast('Choose an action.');
        if (a === 'email') { db.pending = ids; save(); go('/admin/crm/email'); return; }
        ids.forEach(function (id) { if (a === 'assign') assign(id, +$('#b-owner').value || null, me().id, 'bulk transfer'); if (a === 'stage') setStage(id, $('#b-stage').value, me().id); if (a === 'tag') { var tg = $('#b-tag').value.trim().toLowerCase(); var l = lead(id); if (tg && l.tags.indexOf(tg) < 0) l.tags.push(tg); } });
        save(); toast('Updated ' + ids.length + ' lead' + (ids.length > 1 ? 's' : '')); render();
      };
    });
  };

  /* ---------------- add a lead ---------------- */
  routes['/admin/crm/new'] = function () {
    if (needAdmin()) return; var team = staffList(true);
    var html = '<div class="crumbs"><a href="#/admin/crm">Leads</a><span>›</span><span>Add a lead</span></div><h1>Add a lead</h1><form class="card form" id="nl" style="max-width:820px">' +
      '<div class="f2"><div class="field"><label>Name</label><input name="name" maxlength="80"></div><div class="field"><label>Company</label><input name="company" maxlength="120"></div></div>' +
      '<div class="f2"><div class="field"><label>Mobile (10 digits)</label><input name="phone" inputmode="numeric" maxlength="14"></div><div class="field"><label>Email</label><input type="email" name="email"></div></div>' +
      '<div class="f2"><div class="field"><label>Solution</label><select name="solution"><option value="">—</option>' + Object.keys(SOLUTIONS).map(function (k) { return '<option value="' + k + '">' + SOLUTIONS[k] + '</option>'; }).join('') + '</select></div><div class="field"><label>Virtual office for</label><select name="vo"><option value="">—</option>' + Object.keys(VO_LABEL).map(function (k) { return '<option value="' + k + '">' + VO_LABEL[k] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="f2"><div class="field"><label>Seats</label><input type="number" name="seats" min="1" max="500"></div><div class="field"><label>Centre</label><select name="centre"><option value="">Any</option>' + db.centres.map(function (c) { return '<option value="' + c.key + '">' + esc(c.name) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="f2"><div class="field"><label>Source</label><select name="source"><option value="">Choose</option>' + MANUAL_SOURCES.map(function (s2) { return '<option>' + s2 + '</option>'; }).join('') + '</select></div>' + (canAssign() ? '<div class="field"><label>Owner</label><select name="owner"><option value="' + me().id + '">Me</option><option value="">Unassigned</option>' + team.filter(function (x) { return x.id !== me().id; }).map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('') + '</select></div>' : '') + '</div>' +
      '<div class="f2"><div class="field"><label>Expected value (₹, before GST)</label><input name="value" inputmode="decimal"></div><div class="field"><label>Tags</label><input name="tags" placeholder="hot, referral"></div></div><div class="field"><label>Notes</label><textarea name="message" rows="3"></textarea></div>' +
      '<p class="alert error" id="nl-err" hidden></p><div class="row"><button class="btn btn-primary">Add lead</button><span class="xs muted">If this phone or email already has an open lead, the note is added there instead.</span></div></form>';
    return A('crm', html, function () { onSubmit($('#nl'), function (e) {
      var v = vals(e.target), err = [];
      if ((v.name || '').trim().length < 2) err.push('Enter the name.'); var pe = phoneError(v.phone); if (pe) err.push(pe); if (v.email && emailError(v.email)) err.push(emailError(v.email)); if (!v.source) err.push('Choose where the lead came from.');
      if (err.length) { $('#nl-err').hidden = false; $('#nl-err').textContent = err.join(' '); return; }
      var r = capture({ name: v.name.trim(), company: v.company || null, phone: digits10(v.phone), email: v.email || null, solution: v.solution || null, voPlan: v.vo || null, seats: +v.seats || null, centre: v.centre || null, message: v.message || null, value: rupeesIn(v.value), tags: (v.tags || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean) }, v.source, me().id, canAssign() ? (+v.owner || null) : me().id);
      save(); toast(r.merged ? 'Added to the existing open lead for this person.' : 'Lead added'); go('/admin/crm/lead?id=' + r.lead.id);
    }); });
  };

  /* ---------------- lead detail ---------------- */
  var ICON = { created: '+', note: '✎', call: '☎', whatsapp: 'W', email: '@', meeting: '◷', sms: '✉', stage: '→', owner: '⇄', reminder: '⏰', proposal: '₹', bulk_email: '@', enquiry: '↺', order: '✓', edit: '✎' };
  routes['/admin/crm/lead'] = function (q) {
    if (needAdmin()) return; var l = lead(q.id);
    if (!l || !canSee(l)) return A('crm', '<h1>Lead not found</h1><p class="muted">It doesn\'t exist or isn\'t assigned to you.</p><a class="btn btn-ghost" href="#/admin/crm" style="width:fit-content">Back to leads</a>');
    var u = me(), team = staffList(true), hist = db.acts.filter(function (a) { return a.leadId === l.id; }).sort(function (a, b) { return b.at - a.at; });
    var rems = db.rems.filter(function (r) { return r.leadId === l.id; }).sort(function (a, b) { return (!!a.doneAt - !!b.doneAt) || a.dueAt - b.dueAt; });
    var props = db.props.filter(function (p) { return p.leadId === l.id; }).reverse();
    var wa = encodeURIComponent('Hi ' + l.name.split(' ')[0] + ', this is ' + u.name.split(' ')[0] + ' from Livance Coworking. Thanks for your enquiry about ' + (SOLUTIONS[l.solution] || 'our workspace').toLowerCase() + '. When is a good time to talk?');
    var html = '<div class="crumbs"><a href="#/admin/crm">Leads</a><span>›</span><span>' + esc(l.name) + '</span></div>' +
      '<div class="between" style="align-items:flex-start"><div class="stack" style="gap:6px"><h1>' + esc(l.name) + (l.company && l.company !== l.name ? ' · ' + esc(l.company) : '') + '</h1><div class="row small">' + stPill(l.stage) + (l.kind === 'renewal' ? '<span class="pill am">Renewal · ' + l.renewalDate + '</span>' : '') + '<span class="muted">' + (SOLUTIONS[l.solution] || 'Enquiry') + (l.voPlan ? ' · ' + VO_LABEL[l.voPlan] : '') + (l.seats ? ' · ' + l.seats + ' seats' : '') + (l.centre ? ' · ' + esc(centre(l.centre).name) : '') + '</span></div>' +
      '<span class="small muted">Owner: <b>' + (l.ownerId ? esc(userName(l.ownerId)) : 'Unassigned') + '</b> · from ' + esc(l.source) + ' · created ' + istStr(l.createdAt) + (l.value ? ' · deal ' + rs0(l.value) : '') + '</span></div>' +
      '<div class="quick"><a class="btn btn-primary btn-sm" href="tel:+91' + l.phone + '">Call ' + l.phone + '</a><a class="btn btn-ghost btn-sm" href="https://wa.me/91' + l.phone + '?text=' + wa + '" target="_blank" rel="noopener">WhatsApp</a><a class="btn btn-ghost btn-sm" href="' + link('/admin/crm/proposal?lead=' + l.id) + '">New proposal</a></div></div>' +
      '<div class="card" style="gap:10px"><div class="tabs-sm">' + STAGES.map(function (s2) { return '<button type="button" data-stage="' + s2[0] + '" aria-pressed="' + (l.stage === s2[0]) + '">' + s2[1] + '</button>'; }).join('') + '</div>' +
      '<div class="row" id="p-won" hidden><label class="small">Deal value (₹, before GST)</label><input id="won-v" inputmode="decimal" placeholder="' + (l.value ? l.value / 100 : '15000') + '" style="width:160px;min-height:38px;padding:6px 10px"><button class="btn btn-dark btn-sm" id="won-go">Mark won</button></div>' +
      '<div class="row" id="p-lost" hidden><select id="lost-r" style="width:auto;min-height:38px;padding:6px 10px">' + LOST.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select><button class="btn btn-danger btn-sm" id="lost-go">Mark lost</button></div>' + (l.stage === 'lost' && l.lostReason ? '<p class="xs muted">Lost: ' + esc(l.lostReason) + '</p>' : '') + '</div>' +
      '<div class="lead-grid"><div class="stack-lg">' +
      '<form class="card form" id="act" style="gap:12px"><div class="between"><h3>Log activity</h3><div class="seg-radio" style="gap:6px">' + [['call', 'Call'], ['whatsapp', 'WhatsApp'], ['note', 'Note'], ['meeting', 'Tour / meeting'], ['email', 'Email'], ['sms', 'SMS']].map(function (x, i) { return '<label><input type="radio" name="type" value="' + x[0] + '"' + (i === 0 ? ' checked' : '') + '><span style="padding:6px 11px;font-size:.82rem">' + x[1] + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="field" id="outc"><label>Call outcome</label><div class="seg-radio" style="gap:6px">' + ['Connected', 'No answer', 'Busy', 'Call back later', 'Wrong number', 'Not interested'].map(function (o) { return '<label><input type="radio" name="outcome" value="' + o + '"><span style="padding:6px 11px;font-size:.82rem">' + o + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="field"><label>What happened?</label><textarea name="body" rows="3" placeholder="Wants GST plan at Ghitorni, comparing with another provider. Sending proposal today."></textarea></div>' +
      '<div class="f2"><div class="field"><label>Next follow-up <span class="soft">(optional)</span></label><input type="datetime-local" name="fu"></div><div class="field"><label>Follow-up note</label><input name="fn" maxlength="200" placeholder="Call back after the proposal"></div></div><div class="row"><button class="btn btn-dark">Save</button><span class="xs muted">A call, WhatsApp, email or meeting moves a new lead to Contacted.</span></div></form>' +
      '<div class="card"><div class="between"><h3>History</h3><span class="xs muted">' + hist.length + ' entries · anyone with access can see this</span></div><div class="timeline">' + hist.map(function (a) { return '<div class="tl t-' + a.type + '"><i>' + (ICON[a.type] || '•') + '</i><div class="stack" style="gap:2px;min-width:0"><span style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(a.body) + '</span><span class="meta">' + esc(a.actorId ? userName(a.actorId) : 'System') + ' · ' + istStr(a.at) + ' (' + ago(a.at) + ')' + (a.meta && a.meta.utm ? ' · ' + esc(a.meta.utm) : '') + '</span></div></div>'; }).join('') + '</div></div></div>' +
      '<div class="stack-lg"><div class="card"><div class="between"><h3>Details</h3><button type="button" class="link small" data-toggle="#ed">Edit</button></div><dl class="dl"><dt>Phone</dt><dd class="mono">' + l.phone + '</dd><dt>Email</dt><dd>' + esc(l.email || '—') + (l.unsub ? ' (unsubscribed)' : '') + '</dd><dt>Company</dt><dd>' + esc(l.company || '—') + '</dd><dt>Needs</dt><dd>' + (SOLUTIONS[l.solution] || '—') + (l.voPlan ? ' · ' + VO_LABEL[l.voPlan] : '') + (l.seats ? ' · ' + l.seats + ' seats' : '') + '</dd><dt>Centre</dt><dd>' + (l.centre ? esc(centre(l.centre).name) : 'Any') + '</dd>' + (l.message ? '<dt>Message</dt><dd style="white-space:pre-wrap">' + esc(l.message) + '</dd>' : '') + (l.utm && l.utm.source ? '<dt>Campaign</dt><dd>' + esc([l.utm.source, l.utm.medium, l.utm.campaign].filter(Boolean).join(' / ')) + '</dd>' : '') + (l.tags.length ? '<dt>Tags</dt><dd>' + l.tags.map(function (t2) { return '<span class="tag">' + esc(t2) + '</span>'; }).join('') + '</dd>' : '') + '</dl>' +
      '<form id="ed" class="form stack" hidden><div class="f2"><div class="field"><label>Name</label><input name="name" value="' + esc(l.name) + '"></div><div class="field"><label>Company</label><input name="company" value="' + esc(l.company || '') + '"></div></div><div class="f2"><div class="field"><label>Mobile</label><input name="phone" value="' + l.phone + '"></div><div class="field"><label>Email</label><input name="email" value="' + esc(l.email || '') + '"></div></div><div class="f2"><div class="field"><label>Deal value (₹)</label><input name="value" value="' + (l.value ? l.value / 100 : '') + '"></div><div class="field"><label>Tags</label><input name="tags" value="' + esc(l.tags.join(', ')) + '"></div></div><button class="btn btn-dark btn-sm" style="width:fit-content">Save details</button></form></div>' +
      '<div class="card"><h3>Follow-ups</h3>' + rems.map(function (r) { return '<div class="doc-row" style="' + (r.doneAt ? 'opacity:.55' : '') + '"><div class="stack" style="gap:2px"><b class="small">' + esc(r.note) + '</b><span class="xs" style="color:' + (!r.doneAt && r.dueAt < NOW() ? 'var(--red)' : 'var(--muted)') + '">' + istStr(r.dueAt) + ' · ' + esc(userName(r.ownerId)) + (r.doneAt ? ' · done' : '') + '</span></div>' + (r.doneAt ? '' : '<button class="btn btn-ghost btn-sm" data-done="' + r.id + '">Done</button>') + '</div>'; }).join('') +
      '<form class="form stack" id="rem" style="gap:8px"><div class="f2"><div class="field"><label>When</label><input type="datetime-local" name="due" value="' + istInput(NOW() + 864e5).slice(0, 11) + '11:00"></div><div class="field"><label>What</label><input name="note" placeholder="Call to confirm the tour"></div></div><button class="btn btn-ghost btn-sm" style="width:fit-content">Add follow-up</button></form></div>' +
      (canAssign() ? '<form class="card form" id="tr" style="gap:10px"><h3>Transfer</h3><div class="f2"><div class="field"><label>To</label><select name="to"><option value="">Unassigned</option>' + team.map(function (x) { return '<option value="' + x.id + '"' + (l.ownerId === x.id ? ' selected' : '') + '>' + esc(x.name) + (x.staff && x.staff.title ? ' · ' + esc(x.staff.title) : '') + '</option>'; }).join('') + '</select></div><div class="field"><label>Reason <span class="soft">(optional)</span></label><input name="why" placeholder="Delhi lead, handing to Delhi team"></div></div><button class="btn btn-ghost btn-sm" style="width:fit-content">Transfer lead</button><span class="xs muted">The new owner gets an email. Open follow-ups move with the lead.</span></form>' : '') +
      '<div class="card"><div class="between"><h3>Proposals</h3><a class="link small" href="' + link('/admin/crm/proposal?lead=' + l.id) + '">New</a></div>' + (props.length ? props.map(function (p) { return '<div class="doc-row"><div class="stack" style="gap:2px"><a class="link" href="' + link('/admin/crm/proposal?id=' + p.id) + '"><b class="mono small">' + p.number + '</b> ' + esc(p.title) + '</a><span class="xs muted">' + rs(p.total) + ' · v' + p.version + ' · ' + istStr(p.updatedAt) + '</span></div><span class="pill ' + (p.status === 'accepted' ? 'gr' : p.status === 'declined' ? 'rd' : p.status === 'draft' ? '' : 'am') + '">' + p.status + '</span></div>'; }).join('') : '<p class="small muted">None yet.</p>') + '</div>' +
      (l.email ? '<form class="card form" id="em" style="gap:10px"><h3>Email ' + esc(l.name.split(' ')[0]) + '</h3>' + (db.etpl.length ? '<div class="field"><label>Start from a template</label><select id="tpl"><option value="">—</option>' + db.etpl.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('') + '</select></div>' : '') + '<div class="field"><label>Subject</label><input name="subject"></div><div class="field"><label>Message</label><textarea name="body" rows="6" placeholder="Hi {{first_name}}, …"></textarea><span class="hint">{{first_name}}, {{company}} and {{sender}} are filled in.</span></div><button class="btn btn-dark btn-sm" style="width:fit-content">Send email</button></form>' : '') +
      '</div></div>';
    return A('crm', html, function () {
      $$('[data-stage]').forEach(function (b) { b.onclick = function () { var s2 = b.dataset.stage; $('#p-won').hidden = s2 !== 'won'; $('#p-lost').hidden = s2 !== 'lost'; if (s2 === 'won' || s2 === 'lost') return; setStage(l.id, s2, u.id); save(); toast('Stage: ' + STAGE[s2]); render(); }; });
      $('#won-go').onclick = function () { setStage(l.id, 'won', u.id, { value: rupeesIn($('#won-v').value) || l.value }); save(); toast('Won!'); render(); };
      $('#lost-go').onclick = function () { setStage(l.id, 'lost', u.id, { lost: $('#lost-r').value }); save(); render(); };
      var outc = function () { var t2 = $('#act input[name="type"]:checked'); $('#outc').hidden = !t2 || t2.value !== 'call'; }; $$('#act input[name="type"]').forEach(function (x) { x.onchange = outc; }); outc();
      onSubmit($('#act'), function (e) { var v = vals(e.target); if (!v.body && !v.outcome) return toast('Write what happened.'); act(l.id, u.id, v.type, [v.outcome, v.body].filter(Boolean).join(' · '));
        if (l.stage === 'new' && v.type !== 'note' && v.outcome !== 'No answer' && v.outcome !== 'Wrong number') setStage(l.id, 'contacted', u.id);
        var due = fromIstInput(v.fu); if (due) addRem(l.id, l.ownerId || u.id, due, v.fn || 'Follow up', u.id); save(); toast('Saved'); render(); });
      onSubmit($('#rem'), function (e) { var v = vals(e.target), due = fromIstInput(v.due); if (!due || !v.note) return toast('Pick a time and what to do.'); addRem(l.id, l.ownerId || u.id, due, v.note, u.id); save(); render(); });
      $$('[data-done]').forEach(function (b) { b.onclick = function () { doneRem(+b.dataset.done, u.id); save(); render(); }; });
      onSubmit($('#ed'), function (e) { var v = vals(e.target), pe = phoneError(v.phone); if (pe) return toast(pe); l.name = v.name; l.company = v.company || null; l.phone = digits10(v.phone); l.email = v.email || null; l.value = rupeesIn(v.value); l.tags = (v.tags || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean); act(l.id, u.id, 'edit', 'Updated details'); save(); toast('Saved'); render(); });
      var tr = $('#tr'); if (tr) onSubmit(tr, function (e) { var v = vals(e.target); assign(l.id, +v.to || null, u.id, v.why || null); save(); toast('Transferred'); if (canSee(l)) render(); else go('/admin/crm'); });
      var tp = $('#tpl'); if (tp) tp.onchange = function () { var x = byId('etpl', tp.value); if (x) { $('#em [name="subject"]').value = x.subject; $('#em [name="body"]').value = x.body; } };
      var em = $('#em'); if (em) onSubmit(em, function (e) { var v = vals(e.target); if (!v.subject || !v.body) return toast('Write a subject and a message.'); act(l.id, u.id, 'email', 'Emailed “' + v.subject.replace('{{first_name}}', l.name.split(' ')[0]) + '”'); outMail(l.email, merge(v.subject,l,u), 'crm', merge(v.body,l,u)); if (l.stage === 'new') setStage(l.id, 'contacted', u.id); save(); toast(CONNECTED ? 'Email is being sent. Check delivery status.' : 'Demo email logged'); render(); });
    });
  };

  /* ---------------- proposals ---------------- */
  routes['/admin/crm/proposal'] = function (q) {
    if (needAdmin()) return; var u = me(), p = q.id ? byId('props', q.id) : null, l = lead(p ? p.leadId : q.lead);
    if (!l || !canSee(l)) return A('crm', '<h1>Not found</h1>');
    if (!p) { var LL = priceList(), first = l.solution === 'virtual_office' ? LL.filter(function (x) { return x.key === 'vo_' + (l.voPlan || 'gst'); })[0] : l.solution === 'dedicated_desk' ? LL[3] : l.solution === 'private_cabin' ? LL[4] : null;
      p = { id: null, title: (SOLUTIONS[l.solution] || 'Workspace') + ' proposal for ' + (l.company || l.name), centre: l.centre, items: first ? [{ desc: first.desc + (l.centre ? ', ' + centre(l.centre).name : ''), unit: first.unit, price: first.price, qty: l.solution === 'dedicated_desk' ? (l.seats || 1) * 12 : l.solution === 'private_cabin' ? 12 : 1 }] : [{ desc: '', unit: '', price: 0, qty: 1 }], discount: 0, intro: '', terms: DEFAULT_TERMS, validUntil: addDays(ist().date, 15), status: 'draft', version: 1 }; }
    var row = function (it) { return '<tr><td><input name="desc" value="' + esc(it.desc) + '" style="min-height:38px;padding:6px 10px"></td><td><input name="unit" value="' + esc(it.unit || '') + '" style="min-height:38px;padding:6px 10px;width:110px"></td><td class="num"><input name="qty" type="number" step="any" min="0" value="' + it.qty + '" style="min-height:38px;padding:6px 10px;width:84px;text-align:right"></td><td class="num"><input name="price" inputmode="decimal" value="' + it.price / 100 + '" style="min-height:38px;padding:6px 10px;width:110px;text-align:right"></td><td class="num mono" data-amt></td><td><button type="button" class="link small" data-del style="color:var(--red)">Remove</button></td></tr>'; };
    var decided = p.status === 'accepted' || p.status === 'declined';
    var html = '<div class="crumbs"><a href="#/admin/crm">Leads</a><span>›</span><a href="' + link('/admin/crm/lead?id=' + l.id) + '">' + esc(l.name) + '</a><span>›</span><span>' + (p.id ? p.number : 'New proposal') + '</span></div>' +
      '<div class="between"><h1>' + (p.id ? 'Proposal ' + p.number : 'New proposal') + '</h1>' + (p.id ? '<div class="row"><span class="pill ' + (p.status === 'accepted' ? 'gr' : p.status === 'declined' ? 'rd' : p.status === 'draft' ? '' : 'am') + '">' + p.status + ' · v' + p.version + '</span>' + (p.status !== 'draft' ? '<a class="btn btn-ghost btn-sm" href="' + link('/proposal?t=' + p.token) + '">Client view</a>' : '') + '</div>' : '') + '</div>' +
      (p.sentAt ? '<p class="small muted">Sent ' + istStr(p.sentAt) + (p.viewedAt ? ' · opened ' + istStr(p.viewedAt) : ' · not opened yet') + (p.decidedAt ? ' · ' + p.status + ' ' + istStr(p.decidedAt) : '') + '</p>' : '') +
      '<form class="card form" id="pf"><div class="f2"><div class="field"><label>Title</label><input name="title" value="' + esc(p.title) + '"></div><div class="f2"><div class="field"><label>Centre</label><select name="centre"><option value="">—</option>' + db.centres.map(function (c) { return '<option value="' + c.key + '"' + (p.centre === c.key ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div><div class="field"><label>Valid until</label><input type="date" name="valid" value="' + p.validUntil + '"></div></div></div>' +
      '<div class="field"><label>Opening note <span class="soft">(optional)</span></label><textarea name="intro" rows="3" placeholder="Thanks for visiting Ghitorni today…">' + esc(p.intro || '') + '</textarea></div>' +
      '<div class="between"><h3>Items</h3><select id="addit" style="width:auto;min-height:38px;padding:6px 10px"><option value="">Add from price list…</option>' + priceList().map(function (it, i) { return '<option value="' + i + '">' + esc(it.desc) + (it.price ? ' · ' + rs0(it.price) + (it.unit ? '/' + it.unit : '') : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="tbl"><table class="dense" id="items"><thead><tr><th style="width:44%">Description</th><th>Per</th><th class="num">Qty</th><th class="num">Rate (₹)</th><th class="num">Amount</th><th></th></tr></thead><tbody>' + p.items.map(row).join('') + '</tbody></table></div>' +
      '<div class="g2" style="align-items:start"><div class="field"><label>Terms</label><textarea name="terms" rows="6">' + esc(p.terms || '') + '</textarea></div><div class="card flat" style="gap:8px"><div class="sum-rows"><div><span>Subtotal</span><span id="t-sub"></span></div><div><span>Discount (₹)</span><span><input name="discount" value="' + (p.discount || 0) / 100 + '" style="min-height:34px;padding:4px 8px;width:110px;text-align:right"></span></div><div><span>GST 18%</span><span id="t-gst"></span></div></div><div class="sum-total"><span>Total</span><b id="t-tot"></b></div></div></div>' +
      '<div class="row">' + (decided ? '<span class="small muted">Decided proposals can\'t be edited. Duplicate it instead.</span><button type="button" class="btn btn-ghost" id="dup">Duplicate</button>' : '<button class="btn btn-dark">' + (p.id ? 'Save changes' : 'Save draft') + '</button>' + (p.id && p.status !== 'draft' ? '<span class="xs muted">Saving a sent proposal creates a new version you need to send again.</span>' : '')) + '</div></form>' +
      (p.id && !decided ? '<div class="card form" style="max-width:760px"><h3>' + (p.status === 'draft' ? 'Send to ' + esc(l.name) : 'Send again') + '</h3>' + (l.email ? '' : '<p class="alert error">This lead has no email. Add one first.</p>') + '<div class="field"><label>Message <span class="soft">(optional)</span></label><textarea id="smsg" rows="3" placeholder="Hi ' + esc(l.name.split(' ')[0]) + ', as promised, here\'s our proposal."></textarea></div><p class="small muted">The client gets an email with the PDF and a link to accept or decline online. Accepting marks the lead won.</p><button class="btn btn-primary" style="width:fit-content" id="send"' + (l.email ? '' : ' disabled') + '>Email proposal to ' + esc(l.email || 'client') + '</button></div>' : '');
    return A('crm', html, function () {
      var tb = $('#items tbody');
      var num = function (v) { var n = parseFloat(String(v || '').replace(/[,₹\s]/g, '')); return isFinite(n) ? n : 0; };
      var read = function () { return $$('tr', tb).map(function (tr) { return { desc: $('[name="desc"]', tr).value.trim(), unit: $('[name="unit"]', tr).value.trim(), qty: num($('[name="qty"]', tr).value), price: Math.round(num($('[name="price"]', tr).value) * 100) }; }).filter(function (it) { return it.desc && it.qty > 0; }); };
      var calc = function () { $$('tr', tb).forEach(function (tr) { var a2 = num($('[name="qty"]', tr).value) * num($('[name="price"]', tr).value); $('[data-amt]', tr).textContent = a2 ? '₹' + a2.toLocaleString('en-IN') : ''; }); var tt = propTotals(read(), Math.round(num($('[name="discount"]').value) * 100)); $('#t-sub').textContent = rs(tt.subtotal); $('#t-gst').textContent = rs(tt.gst); $('#t-tot').textContent = rs(tt.total); };
      $('#pf').addEventListener('input', calc); calc();
      $('#addit').onchange = function () { var it = priceList()[+this.value]; if (!it) return; var first = tb.rows[0]; if (tb.rows.length === 1 && !$('[name="desc"]', first).value) first.outerHTML = row({ desc: it.desc, unit: it.unit, price: it.price, qty: 1 }); else tb.insertAdjacentHTML('beforeend', row({ desc: it.desc, unit: it.unit, price: it.price, qty: 1 })); this.value = ''; calc(); };
      tb.onclick = function (e) { if (e.target.matches('[data-del]')) { if (tb.rows.length > 1) e.target.closest('tr').remove(); calc(); } };
      var dup = $('#dup'); if (dup) dup.onclick = function () { var np = JSON.parse(JSON.stringify(p)); np.id = ++db.seq; np.number = 'PR-' + ist().date.slice(2, 7).replace('-', '') + '-' + String(db.props.length + 1).padStart(3, '0'); np.token = tok(); np.status = 'draft'; np.version = 1; np.sentAt = np.viewedAt = np.decidedAt = null; np.createdAt = np.updatedAt = NOW(); np.validUntil = addDays(ist().date, 15); db.props.push(np); act(l.id, u.id, 'proposal', 'Proposal ' + np.number + ' drafted (copy of ' + p.number + ')'); save(); go('/admin/crm/proposal?id=' + np.id); };
      if (!decided) onSubmit($('#pf'), function (e) {
        var v = vals(e.target), items = read(); if (!v.title || !items.length) return toast('Add a title and at least one item.');
        var tt = propTotals(items, Math.round(num(v.discount) * 100));
        if (!p.id) { p = Object.assign(p, { id: ++db.seq, leadId: l.id, number: 'PR-' + ist().date.slice(2, 7).replace('-', '') + '-' + String(db.props.length + 1).padStart(3, '0'), token: tok(), createdBy: u.id, createdAt: NOW() }); db.props.push(p); act(l.id, u.id, 'proposal', 'Proposal ' + p.number + ' drafted · total ' + rs0(tt.total)); }
        else { var bump = p.status !== 'draft'; if (bump) { p.version++; p.status = 'draft'; } act(l.id, u.id, 'proposal', 'Proposal ' + p.number + ' edited' + (bump ? ' (now version ' + p.version + ', needs re-sending)' : '') + ' · total ' + rs0(tt.total)); }
        Object.assign(p, { title: v.title, centre: v.centre || null, items: items, discount: tt.discount, subtotal: tt.subtotal, gst: tt.gst, total: tt.total, intro: v.intro, terms: v.terms, validUntil: v.valid || p.validUntil, updatedAt: NOW() });
        save(); toast('Saved'); go('/admin/crm/proposal?id=' + p.id);
      });
      var sb = $('#send'); if (sb) sb.onclick = function () { p.status = 'sent'; p.sentAt = NOW(); act(l.id, u.id, 'proposal', 'Proposal ' + p.number + ' (v' + p.version + ') emailed to ' + l.email); outMail(l.email, p.title + ' · Livance proposal ' + p.number, 'proposal', 'Hello '+l.name+',\n\n'+(p.intro||'Please review our proposal.')+'\n\nProposal: '+p.number+'\nAmount: '+rs0(p.total)+'\n\n'+(p.terms||'')+'\n\nLivance Team'); if (['new', 'contacted', 'qualified'].indexOf(l.stage) > -1) setStage(l.id, 'proposal', u.id, { value: p.subtotal - p.discount }); save(); toast(CONNECTED ? 'Proposal email is being sent. Check delivery status. PDF attachment not included.' : 'Demo proposal email logged'); render(); };
    });
  };

  /* ---------------- bulk email ---------------- */
  var merge = function (s2, l, snd) { return String(s2).replace(/\{\{\s*first_name\s*\}\}/g, l.name.split(' ')[0]).replace(/\{\{\s*name\s*\}\}/g, l.name).replace(/\{\{\s*company\s*\}\}/g, l.company || 'your business').replace(/\{\{\s*sender\s*\}\}/g, snd.name); };
  routes['/admin/crm/email'] = function () {
    if (needAdmin()) return; if (!can('crm.bulk')) return A('crm', '<h1>No access</h1><p class="muted">Your role does not include bulk email.</p>');
    var ls = (db.pending || []).map(lead).filter(function (l) { return l && canSee(l); }), reach = ls.filter(function (l) { return l.email && !l.unsub && (!CONNECTED || l.marketingOptIn); });
    var html = '<div class="crumbs"><a href="#/admin/crm">Leads</a><span>›</span><span>Email ' + ls.length + ' leads</span></div><h1>Email ' + ls.length + ' lead' + (ls.length === 1 ? '' : 's') + '</h1><p class="muted">' + reach.length + ' will get it. ' + (ls.length - reach.length) + ' skipped (no email or unsubscribed). Emails go out gradually and each has an unsubscribe link.</p>' +
      '<form class="card form" id="bm" style="max-width:860px">' + (db.etpl.length ? '<div class="field"><label>Start from a template</label><select id="tpl"><option value="">—</option>' + db.etpl.map(function (x) { return '<option value="' + x.id + '">' + esc(x.name) + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="field"><label>Subject</label><input name="subject" placeholder="Your virtual office in Gurugram, {{first_name}}"></div><div class="field"><label>Message</label><textarea name="body" rows="10"></textarea><span class="hint">Merge fields: {{first_name}}, {{name}}, {{company}}, {{sender}}.</span></div>' +
      '<div class="card flat" id="prev" style="gap:6px"><span class="eyebrow">Preview for ' + esc(reach[0] ? reach[0].name : '—') + '</span><b id="pv-s"></b><div id="pv-b" class="small" style="white-space:pre-wrap"></div></div>' +
      '<div class="row"><button class="btn btn-primary">Queue ' + reach.length + ' emails</button><a class="btn btn-ghost" href="#/admin/crm">Cancel</a></div></form>';
    return A('crm', html, function () {
      var f = $('#bm'), pv = function () { if (!reach[0]) return; $('#pv-s').textContent = merge(f.subject.value, reach[0], me()); $('#pv-b').textContent = merge(f.body.value, reach[0], me()); };
      f.addEventListener('input', pv);
      var tp = $('#tpl'); if (tp) tp.onchange = function () { var x = byId('etpl', tp.value); if (x) { f.subject.value = x.subject; f.body.value = x.body; pv(); } };
      onSubmit(f, function () { if (!f.subject.value.trim() || f.body.value.trim().length < 10) return toast('Write a subject and a message.');
        var c = { id: ++db.seq, subject: f.subject.value.trim(), body: f.body.value, total: reach.length, sent: 0, skipped: ls.length - reach.length, byId: me().id, at: NOW() }; db.camps.unshift(c);
        reach.forEach(function (l) { db.outbox.push({ id: ++db.seq, campId: c.id, leadId: l.id, to: l.email, subject: merge(c.subject, l, me()), status: 'queued' }); });
        db.pending = []; save();
        if(CONNECTED) {
          var jobs=reach.slice(0,20).map(function(l){return {to:l.email,subject:merge(c.subject,l,me()),body:merge(c.body,l,me())};});
          if(reach.length>20){toast('Send up to 20 consented recipients per batch.');return;}
          BRIDGE.bulkEmail(jobs).then(function(result){
            (result.results||[]).forEach(function(x){var m2=db.outbox.filter(function(t){return t.campId===c.id&&t.to===x.to})[0];if(m2){m2.status=x.status;m2.error=x.error||null;if(x.status==='sent'){m2.sentAt=NOW();c.sent++;}}});save();toast(c.sent+' emails delivered to provider.');render();
          }).catch(function(e){toast('Bulk email failed: '+e.message);});
          go('/admin/crm/campaigns');return;
        }
        toast(reach.length + ' demo emails queued'); go('/admin/crm/campaigns'); });
    });
  };
  routes['/admin/crm/campaigns'] = function () {
    if (needAdmin()) return; if (!can('crm.bulk')) return A('crm', '<h1>No access</h1>');
    var queued = db.outbox.filter(function (m2) { return m2.status === 'queued'; }).length;
    var html = '<div class="crumbs"><a href="#/admin/crm">Leads</a><span>›</span><span>Bulk emails</span></div><div class="between"><h1>Bulk emails</h1><span class="pill ' + (queued ? 'am' : 'gr') + '" data-outbox-live>' + queued + ' waiting to send</span></div><p class="muted small">To send, filter the lead list, tick leads and choose "Send email…".</p>' +
      '<div class="tbl"><table class="dense"><thead><tr><th>Subject</th><th>By</th><th>When</th><th class="num">Recipients</th><th class="num">Sent</th><th class="num">Skipped</th></tr></thead><tbody>' + db.camps.map(function (c) { return '<tr><td><b>' + esc(c.subject) + '</b></td><td class="small">' + esc(userName(c.byId)) + '</td><td class="small">' + istStr(c.at) + '</td><td class="num">' + c.total + '</td><td class="num">' + c.sent + '</td><td class="num">' + c.skipped + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="card"><h3>Templates</h3><p class="small muted">Reusable emails for the whole team.</p>' + db.etpl.map(function (x) { return '<details class="doc-row" style="display:block"><summary class="between" style="cursor:pointer"><b>' + esc(x.name) + '</b><span class="xs muted">' + esc(userName(x.byId)) + '</span></summary><p class="small"><b>' + esc(x.subject) + '</b></p><p class="small muted" style="white-space:pre-wrap">' + esc(x.body) + '</p><button class="link small" style="color:var(--red)" data-deltpl="' + x.id + '">Delete</button></details>'; }).join('') +
      '<form class="form stack" id="nt" style="border-top:1px solid var(--line);padding-top:14px"><h4>New template</h4><div class="f2"><div class="field"><label>Name</label><input name="name"></div><div class="field"><label>Subject</label><input name="subject"></div></div><div class="field"><label>Message</label><textarea name="body" rows="4"></textarea></div><button class="btn btn-ghost btn-sm" style="width:fit-content">Add template</button></form></div>';
    return A('crm', html, function () {
      onSubmit($('#nt'), function (e) { var v = vals(e.target); if (!v.name || !v.subject || !v.body) return toast('Fill in all three.'); db.etpl.push({ id: ++db.seq, name: v.name, subject: v.subject, body: v.body, byId: me().id, at: NOW() }); save(); render(); });
      $$('[data-deltpl]').forEach(function (b) { b.onclick = function () { db.etpl = db.etpl.filter(function (x) { return x.id !== +b.dataset.deltpl; }); save(); render(); }; });
    });
  };
  routes['/admin/crm/settings'] = function () {
    if (needAdmin()) return; if (!canAny(['crm.all', 'crm.team'])) return A('crm', '<h1>No access</h1>');
    var s2 = db.settings, sales = staffList(true).filter(function (x) { return x.role !== 'admin'; });
    var html = '<div class="crumbs"><a href="#/admin/crm">Leads</a><span>›</span><span>Settings</span></div><h1>CRM settings</h1><form class="card form" id="cs" style="max-width:880px"><h3>Lead assignment</h3><label class="check"><input type="checkbox" name="auto"' + (s2.autoassign ? ' checked' : '') + '><span><b>Assign new leads automatically</b>, one by one, to the people ticked below.</span></label><div class="perm-grid">' + sales.map(function (x) { return '<label class="check"><input type="checkbox" name="rot" value="' + x.id + '"' + (x.staff.rotation ? ' checked' : '') + '><span>' + esc(x.name) + ' · ' + esc(x.staff.title) + '</span></label>'; }).join('') + '</div>' +
      '<h3>Renewals</h3><div class="field" style="max-width:260px"><label>Create renewal leads this many days before expiry</label><input type="number" name="ren" min="15" max="120" value="' + s2.renewalDays + '"></div>' +
      '<h3>Landing pages</h3><p class="small muted">Forms on other websites (ad landing pages, microsites) send leads straight into this CRM with their UTM campaign. Allowed sites, one per line:</p><div class="field"><textarea name="origins" rows="3">' + esc(s2.origins) + '</textarea></div>' +
      '<details><summary class="link small">Try it: simulate a Google Ads landing page lead</summary><div class="row" style="margin-top:10px"><button type="button" class="btn btn-ghost btn-sm" id="sim">Send a test lead from offers.livance.co.in</button></div></details>' +
      '<button class="btn btn-dark" style="width:fit-content">Save settings</button></form>';
    return A('crm', html, function () {
      onSubmit($('#cs'), function (e) { var f = e.target; s2.autoassign = f.auto.checked; s2.renewalDays = Math.max(15, Math.min(120, +f.ren.value || 60)); s2.origins = f.origins.value; var rot = $$('input[name="rot"]', f).filter(function (x) { return x.checked; }).map(function (x) { return +x.value; }); sales.forEach(function (x) { x.staff.rotation = rot.indexOf(x.id) > -1; }); save(); toast('Saved'); });
      $('#sim').onclick = function () { var n = Math.floor(Math.random() * 900) + 100; var r = capture({ name: 'Test Lead ' + n, phone: '98765' + String(10000 + n).slice(0, 5), email: 'test' + n + '@example.in', solution: 'private_cabin', seats: 4, centre: 'ghitorni', utm: { source: 'google', medium: 'cpc', campaign: 'cabins-delhi' }, page: 'https://offers.livance.co.in/cabins' }, 'Landing page · Google Ads'); save(); toast('Lead received' + (r.lead.ownerId ? ', assigned to ' + userName(r.lead.ownerId) : '')); go('/admin/crm/lead?id=' + r.lead.id); };
    });
  };

  /* ---------------- renewals ---------------- */
  routes['/admin/renewals'] = function (q) {
    if (needAdmin()) return; syncRenewals(); save();
    var days = +q.days || db.settings.renewalDays, rows = dueSubs().filter(function (x) { return x.daysLeft <= days; }).map(function (x) { x.lead = db.leads.filter(function (l) { return l.kind === 'renewal' && l.refType === x.type && l.refId === x.id && l.renewalDate === x.end; })[0]; return x; }).filter(function (x) { return !x.lead || canSee(x.lead); });
    var html = '<div class="between"><div class="stack" style="gap:4px"><h1>Renewals</h1><p class="muted small">Subscriptions ending in the next ' + days + ' days. Each gets a renewal lead automatically, owned by whoever closed the original deal.</p></div><div class="tabs-sm">' + [15, 30, 60, 90].map(function (d) { return '<a href="' + link('/admin/renewals?days=' + d) + '" class="' + (days === d ? 'on' : '') + '">' + d + ' days</a>'; }).join('') + '<a href="#/admin/crm?kind=renewal">Renewal leads</a></div></div>' +
      '<div class="kpis"><div class="kpi"><span>Due</span><b>' + rows.length + '</b></div><div class="kpi"><span>Value at stake</span><b>' + rs0(rows.reduce(function (n, x) { return n + (x.value || 0); }, 0)) + '</b></div><div class="kpi"><span>Renewed (won)</span><b>' + rows.filter(function (x) { return x.lead && x.lead.stage === 'won'; }).length + '</b></div></div>' +
      '<div class="tbl"><table class="dense"><thead><tr><th>Client</th><th>What</th><th>Ends</th><th>Renewal lead</th><th>Owner</th><th class="num">Value</th></tr></thead><tbody>' + rows.map(function (x) { return '<tr><td><b>' + esc(x.name) + '</b><br><span class="xs muted">' + esc(x.email || '') + '</span></td><td class="small">' + esc(x.what) + '</td><td class="small">' + x.end + '<br><span class="pill ' + (x.daysLeft < 0 ? 'rd' : x.daysLeft <= 15 ? 'am' : '') + '">' + (x.daysLeft < 0 ? 'expired' : x.daysLeft + ' days') + '</span></td><td>' + (x.lead ? '<a class="link" href="' + link('/admin/crm/lead?id=' + x.lead.id) + '">' + stPill(x.lead.stage) + '</a>' : '') + '</td><td class="small">' + (x.lead && x.lead.ownerId ? esc(userName(x.lead.ownerId)) : 'Unassigned') + '</td><td class="num small">' + (x.value ? rs0(x.value) : '') + '</td></tr>'; }).join('') + (rows.length ? '' : '<tr><td colspan="6" class="muted">Nothing due in this window.</td></tr>') + '</tbody></table></div>' +
      '<p class="xs muted">Sources: virtual offices (from activation and term), desk clients with an end date, and long-term room reservations.</p>';
    return A('renewals', html);
  };

  /* ---------------- revenue and targets ---------------- */
  routes['/admin/dashboard'] = function (q) {
    if (needAdmin()) return; var ym = /^\d{4}-\d{2}$/.test(q.month || '') ? q.month : ist().date.slice(0, 7);
    var inM = function (ms, m) { return ms && monthOf(ms) === m; };
    var paid = db.orders.filter(function (o) { return o.status !== 'cancelled' && inM(o.paidMs || epoch(o.paidAt, 10), ym); });
    var online = paid.reduce(function (n, o) { return n + o.quote.taxable; }, 0);
    var offline = db.leads.filter(function (l) { return l.stage === 'won' && inM(l.wonAt, ym) && !db.orders.some(function (o) { return o.leadId === l.id; }); }), offSum = offline.reduce(function (n, l) { return n + (l.value || 0); }, 0), total = online + offSum, target = db.targets[ym + '|0'] || 0;
    var pct = function (a, b) { return b ? Math.min(100, Math.round(a / b * 100)) : 0; };
    var months = [], cur = ym; for (var i = 0; i < 6; i++) { months.unshift(cur); var y = +cur.slice(0, 4), mo = +cur.slice(5); cur = (mo === 1 ? y - 1 : y) + '-' + String(mo === 1 ? 12 : mo - 1).padStart(2, '0'); }
    var trend = months.map(function (m) { return { m: m, v: db.orders.filter(function (o) { return o.status !== 'cancelled' && inM(o.paidMs || epoch(o.paidAt, 10), m); }).reduce(function (n, o) { return n + o.quote.taxable; }, 0) + db.leads.filter(function (l) { return l.stage === 'won' && inM(l.wonAt, m) && !db.orders.some(function (o) { return o.leadId === l.id; }); }).reduce(function (n, l) { return n + (l.value || 0); }, 0), t: db.targets[m + '|0'] || 0 }; });
    var mx = Math.max.apply(null, [1].concat(trend.map(function (x) { return Math.max(x.v, x.t); })));
    var byP = {}; paid.forEach(function (o) { byP[o.product] = (byP[o.product] || 0) + o.quote.taxable; });
    var people = staffList(true).map(function (p) { var w = db.leads.filter(function (l) { return l.ownerId === p.id && l.stage === 'won' && inM(l.wonAt, ym); }); return { p: p, won: w.length, value: w.reduce(function (n, l) { return n + (l.value || 0); }, 0), target: db.targets[ym + '|' + p.id] || 0, open: db.leads.filter(function (l) { return l.ownerId === p.id && OPEN_ST.indexOf(l.stage) > -1; }).length }; });
    var canT = me().role === 'admin' || can('crm.team');
    var srcs = {}; db.leads.forEach(function (l) { if (!inM(l.createdAt, ym)) return; var s2 = srcs[l.source] = srcs[l.source] || { n: 0, won: 0 }; s2.n++; if (l.stage === 'won') s2.won++; });
    var html = '<div class="between"><div class="stack" style="gap:4px"><h1>Revenue & targets</h1><p class="muted small">Before GST. Online orders plus deals marked won in the CRM that weren\'t paid online (desk and cabin contracts).</p></div><input type="month" id="mo" value="' + ym + '" style="width:auto"></div>' +
      '<div class="kpis"><div class="kpi"><span>Revenue, ' + ym + '</span><b>' + rs0(total) + '</b><small>' + (target ? pct(total, target) + '% of ' + rs0(target) + ' target' : 'No target set') + '</small></div><div class="kpi"><span>Online (Razorpay)</span><b>' + rs0(online) + '</b><small>' + paid.length + ' orders</small></div><div class="kpi"><span>Won offline (CRM)</span><b>' + rs0(offSum) + '</b><small>' + offline.length + ' deals</small></div></div>' +
      (target ? '<div class="meter"><i style="width:' + pct(total, target) + '%"></i></div>' : '') +
      '<div class="g2" style="align-items:start"><div class="card"><h3>Last 6 months</h3><div class="bar-chart" style="--n:6">' + trend.map(function (x) { return '<div class="b" title="' + x.m + ': ' + rs0(x.v) + '"><span class="mono" style="color:var(--ink)">' + (x.v ? '₹' + Math.round(x.v / 1e5) + 'k' : '') + '</span><i style="height:' + Math.max(2, x.v / mx * 160) + 'px"></i>' + (x.t ? '<i class="t" style="bottom:' + (22 + x.t / mx * 160) + 'px"></i>' : '') + '<span>' + x.m.slice(5) + '/' + x.m.slice(2, 4) + '</span></div>'; }).join('') + '</div><p class="xs muted">Bars: revenue. Dark line: target.</p></div>' +
      '<div class="card"><h3>By product</h3><div class="sum-rows">' + Object.keys(byP).map(function (k) { return '<div><span>' + ({ virtual_office: 'Virtual office', meeting_room: 'Meeting rooms', day_pass: 'Day passes', credits: 'Credits' }[k] || k) + '</span><span>' + rs0(byP[k]) + '</span></div>'; }).join('') + (Object.keys(byP).length ? '' : '<p class="small muted">No online orders this month.</p>') + '</div></div></div>' +
      '<div class="card"><div class="between"><h3>Team, ' + ym + '</h3>' + (canT ? '<button class="btn btn-dark btn-sm" id="savet">Save targets</button>' : '') + '</div><div class="tbl" style="border:0"><table class="dense"><thead><tr><th>Person</th><th class="num">Open</th><th class="num">Won</th><th class="num">Won value</th><th class="num">Target (₹)</th><th style="width:22%">Progress</th></tr></thead><tbody>' +
      '<tr><td><b>Company</b></td><td></td><td></td><td class="num"><b>' + rs0(total) + '</b></td><td class="num">' + (canT ? '<input data-t="0" value="' + (target ? target / 100 : '') + '" style="width:120px;min-height:34px;padding:4px 8px;text-align:right">' : rs0(target)) + '</td><td><div class="meter"><i style="width:' + pct(total, target) + '%"></i></div></td></tr>' +
      people.map(function (x) { return '<tr><td>' + esc(x.p.name) + '<br><span class="xs muted">' + esc(x.p.staff ? x.p.staff.title : 'Owner') + '</span></td><td class="num">' + x.open + '</td><td class="num">' + x.won + '</td><td class="num">' + rs0(x.value) + '</td><td class="num">' + (canT ? '<input data-t="' + x.p.id + '" value="' + (x.target ? x.target / 100 : '') + '" style="width:120px;min-height:34px;padding:4px 8px;text-align:right">' : (x.target ? rs0(x.target) : '—')) + '</td><td><div class="meter"><i style="width:' + pct(x.value, x.target) + '%"></i></div><span class="xs muted">' + (x.target ? pct(x.value, x.target) + '%' : '') + '</span></td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="g2" style="align-items:start"><div class="card"><h3>Lead funnel (created in ' + ym + ')</h3><div class="sum-rows">' + STAGES.map(function (s2) { return '<div><span>' + stPill(s2[0]) + '</span><span>' + db.leads.filter(function (l) { return l.kind === 'new' && inM(l.createdAt, ym) && l.stage === s2[0]; }).length + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="card"><h3>Sources</h3><div class="tbl" style="border:0"><table class="dense"><thead><tr><th>Source</th><th class="num">Leads</th><th class="num">Won</th><th class="num">Win rate</th></tr></thead><tbody>' + Object.keys(srcs).map(function (k) { return '<tr><td class="small">' + esc(k) + '</td><td class="num">' + srcs[k].n + '</td><td class="num">' + srcs[k].won + '</td><td class="num">' + Math.round(srcs[k].won / srcs[k].n * 100) + '%</td></tr>'; }).join('') + '</tbody></table></div></div></div>';
    return A('dashboard', html, function () { $('#mo').onchange = function () { go('/admin/dashboard?month=' + this.value); }; var sv = $('#savet'); if (sv) sv.onclick = function () { $$('[data-t]').forEach(function (i2) { var v = rupeesIn(i2.value); if (v) db.targets[ym + '|' + i2.dataset.t] = v; else delete db.targets[ym + '|' + i2.dataset.t]; }); save(); toast('Targets saved'); render(); }; });
  };

/* ---- ext/06-admin-ops-site.js ---- */
  /* ---------------- orders ---------------- */
  var PROD = { virtual_office: 'Virtual office', meeting_room: 'Meeting room', day_pass: 'Day pass', credits: 'Credits' };
  routes['/admin/orders'] = function (q) {
    if (needAdmin()) return; var s2 = (q.q || '').toLowerCase(), pr = q.product || '';
    var rows = db.orders.slice().reverse().filter(function (o) { var u = byId('users', o.userId) || {}, invs = db.invoices.filter(function (i) { return i.orderId === o.id; }).map(function (i) { return i.number; }).join(' ');
      return (!pr || o.product === pr) && (!s2 || (o.publicId + ' ' + u.name + ' ' + u.email + ' ' + invs + ' ' + ((o.billing || {}).gstin || '')).toLowerCase().indexOf(s2) > -1); });
    var sum = rows.filter(function (o) { return o.status !== 'cancelled'; }).reduce(function (a, o) { a.t += o.quote.taxable; a.g += o.total - o.quote.taxable; return a; }, { t: 0, g: 0 });
    var html = '<div class="between"><div class="stack" style="gap:4px"><h1>Orders & invoices</h1><p class="muted small">' + rows.length + ' orders · ' + rs0(sum.t) + ' before GST · ' + rs0(sum.g) + ' GST</p></div><button class="btn btn-ghost btn-sm" id="csv">Export CSV</button></div>' +
      '<form class="filters" id="of"><div class="field" style="flex:2 1 260px"><label>Search</label><input type="search" name="q" value="' + esc(q.q || '') + '" placeholder="Order ID, invoice number, name, email, GSTIN"></div><div class="field"><label>Product</label><select name="product"><option value="">Any</option>' + Object.keys(PROD).map(function (k) { return '<option value="' + k + '"' + (pr === k ? ' selected' : '') + '>' + PROD[k] + '</option>'; }).join('') + '</select></div><button class="btn btn-dark btn-sm">Search</button></form>' +
      '<div class="tbl"><table class="dense"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>What</th><th>Invoice no.</th><th>Coupon</th><th class="num">Taxable</th><th class="num">Total</th><th>Status</th></tr></thead><tbody>' +
      rows.map(function (o) { var u = byId('users', o.userId) || { name: '—', email: '' }; return '<tr><td class="mono small">' + o.publicId + '</td><td class="small">' + (o.paidAt || '') + '</td><td>' + esc(u.name) + '<br><span class="xs muted">' + esc(u.email) + ((o.billing || {}).gstin ? ' · ' + o.billing.gstin : '') + '</span></td><td class="small">' + (PROD[o.product] || o.product) + ' · ' + esc(centre(o.centre).short) + '</td><td>' + db.invoices.filter(function (i) { return i.orderId === o.id; }).map(function (i) { return '<button class="link mono small" data-inv="' + i.id + '">' + i.number + '</button>'; }).join('<br>') + '</td><td class="small mono">' + esc(o.coupon || (o.quote && o.quote.coupon && o.quote.coupon.code) || '') + '</td><td class="num small">' + rs(o.quote.taxable) + '</td><td class="num">' + rs(o.total) + '</td><td><span class="pill ' + (o.status === 'cancelled' ? 'rd' : 'gr') + '">' + o.status + '</span></td></tr>'; }).join('') +
      (rows.length ? '' : '<tr><td colspan="9" class="muted">No orders match.</td></tr>') + '</tbody></table></div><p class="xs muted">Invoice numbers come from Zoho Books, one series per GSTIN. Click a number to open the invoice.</p>';
    return A('orders', html, function () {
      onSubmit($('#of'), function (e) { go('/admin/orders?' + qsOf(vals(e.target))); });
      $('#csv').onclick = function () { download('livance-orders-' + ist().date + '.csv', ['Order,Date,Customer,Email,GSTIN,Product,Centre,Invoice numbers,Taxable (₹),GST (₹),Total (₹),Status'].concat(rows.map(function (o) { var u = byId('users', o.userId) || {}; return [o.publicId, o.paidAt, u.name, u.email, (o.billing || {}).gstin, PROD[o.product], centre(o.centre).name, db.invoices.filter(function (i) { return i.orderId === o.id; }).map(function (i) { return i.number; }).join(' '), o.quote.taxable / 100, (o.total - o.quote.taxable) / 100, o.total / 100, o.status].map(csvCell).join(','); })).join('\n')); };
    });
  };

  /* ---------------- virtual offices and KYC ---------------- */
  var VST = { awaiting_kyc: 'Awaiting KYC', kyc_review: 'KYC review', kyc_rejected: 'KYC rejected', documents_pending: 'Documents pending', active: 'Active', expired: 'Expired' };
  var vPill = function (s2) { return '<span class="pill ' + ({ kyc_review: 'or', active: 'gr', kyc_rejected: 'rd', documents_pending: 'am' }[s2] || '') + '">' + (VST[s2] || s2) + '</span>'; };
  function voEvent(v, to, note) { v.events = v.events || []; v.events.push({ from: v.status, to: to, note: note, at: NOW(), actor: me().id }); v.status = to; }
  function voFields(v) { var c = centre(v.centre), u = byId('users', v.userId) || {}; return { company: v.business, signatory: u.name, date: fmtDay(v.start || ist().date), start_date: fmtDay(v.start || ist().date), centre_address: c.address, city: c.city, term: AGREEMENT_TERM, plan: PLANS[v.plan].name, fee: rs0(PLANS[v.plan].price) + ' per year' }; }
  routes['/admin/vos'] = function (q) {
    if (needAdmin()) return; var st = q.status || '', s2 = (q.q || '').toLowerCase(), counts = {};
    db.vos.forEach(function (v) { counts[v.status] = (counts[v.status] || 0) + 1; });
    var rows = db.vos.slice().reverse().filter(function (v) { var u = byId('users', v.userId) || {}; return (!st || v.status === st) && (!s2 || (v.business + ' ' + u.name + ' ' + u.email).toLowerCase().indexOf(s2) > -1); });
    var html = '<div class="stack" style="gap:4px"><h1>Virtual offices & KYC</h1><p class="muted small">Track every client from payment to active. Open one to review documents, generate the agreement and NOC, or reset KYC.</p></div>' +
      '<div class="tabs-sm"><a href="#/admin/vos" class="' + (!st ? 'on' : '') + '">All</a>' + Object.keys(VST).map(function (k) { return '<a href="' + link('/admin/vos?status=' + k) + '" class="' + (st === k ? 'on' : '') + '">' + VST[k] + ' <span class="soft">' + (counts[k] || 0) + '</span></a>'; }).join('') + '</div>' +
      '<form class="filters" id="vf"><div class="field" style="flex:2 1 260px"><label>Search</label><input type="search" name="q" value="' + esc(q.q || '') + '" placeholder="Business, name, email"></div><button class="btn btn-dark btn-sm">Search</button></form>' +
      '<div class="tbl"><table class="dense"><thead><tr><th>Business</th><th>Plan</th><th>Centre</th><th>Stage</th><th class="num">KYC docs</th><th>Term</th><th>Last change</th></tr></thead><tbody>' + rows.map(function (v) { var u = byId('users', v.userId) || {}, last = (v.events || []).slice(-1)[0]; return '<tr><td><a class="link" href="' + link('/admin/vo?id=' + v.id) + '"><b>' + esc(v.business) + '</b></a><br><span class="xs muted">' + esc(u.name) + ' · ' + esc(u.email) + '</span></td><td class="small">' + PLANS[v.plan].name + '</td><td class="small">' + esc(centre(v.centre).short) + '</td><td>' + vPill(v.status) + '</td><td class="num">' + KYC[v.plan].filter(function (k) { return v.kyc[k]; }).length + '/' + KYC[v.plan].length + '</td><td class="small">' + (v.start ? v.start + ' → ' + v.end : v.months + ' months') + '</td><td class="small">' + (last ? ago(last.at) : '') + '</td></tr>'; }).join('') + (rows.length ? '' : '<tr><td colspan="7" class="muted">Nothing here.</td></tr>') + '</tbody></table></div>';
    return A('vos', html, function () { onSubmit($('#vf'), function (e) { go('/admin/vos?' + qsOf(Object.assign({ status: st }, vals(e.target)))); }); });
  };
  routes['/admin/vo'] = function (q) {
    if (needAdmin()) return; var v = byId('vos', q.id); if (!v) return A('vos', '<h1>Not found</h1>');
    var u = byId('users', v.userId) || {}, req = KYC[v.plan], steps = ['awaiting_kyc', 'kyc_review', 'documents_pending', 'active'], si = steps.indexOf(v.status === 'kyc_rejected' ? 'kyc_review' : v.status);
    var tpls = db.docs.filter(function (d) { return d.centre === v.centre && (d.plan === v.plan || d.plan === '*'); }).sort(function (a, b) { return a.sort - b.sort; });
    var html = '<div class="crumbs"><a href="#/admin/vos">Virtual offices</a><span>›</span><span>' + esc(v.business) + '</span></div><div class="between"><div class="stack" style="gap:4px"><h1>' + esc(v.business) + '</h1><p class="muted small">' + PLANS[v.plan].name + ' · ' + esc(centre(v.centre).name) + ' · ' + v.months + ' months · ' + esc(u.name) + ' · ' + esc(u.email) + ' · ' + esc(u.phone || '') + '</p></div>' + vPill(v.status) + '</div>' +
      '<ol class="row small" style="list-style:none;padding:0;gap:6px">' + ['Paid', 'KYC review', 'Documents', 'Active'].map(function (x, i) { return '<li class="pill ' + (i < si ? 'gr' : i === si ? 'am' : '') + '">' + (i + 1) + '. ' + x + '</li>'; }).join('') + '</ol>' +
      '<div class="g2" style="align-items:start"><div class="stack-lg"><div class="card"><h3>KYC documents</h3>' + req.map(function (k) { return '<div class="doc-row"><div class="stack" style="gap:2px"><b>' + k + '</b><span class="xs muted">' + (v.kyc[k] ? esc(v.kyc[k]) : 'Not uploaded') + '</span></div><span class="pill ' + (v.kyc[k] ? 'gr' : '') + '">' + (v.kyc[k] ? 'Received' : 'Missing') + '</span></div>'; }).join('') +
      (v.status === 'kyc_review' ? '<div class="row"><button class="btn btn-primary btn-sm" id="ok">Approve KYC</button><input id="why" placeholder="Reason, if rejecting" style="flex:1;min-height:38px;padding:6px 10px"><button class="btn btn-danger btn-sm" id="no">Reject</button></div>' : '') +
      '<details style="margin-top:8px"><summary class="link small">Reset KYC</summary><p class="small muted">Clears the uploaded documents and sends the client back to "Awaiting KYC" with your note. Use it when a document is wrong or expired.</p><div class="row"><input id="rwhy" placeholder="e.g. PAN is blurred, please re-upload" style="flex:1;min-height:38px;padding:6px 10px"><button class="btn btn-ghost btn-sm" id="reset">Reset KYC</button></div></details></div>' +
      '<div class="card"><div class="between"><h3>Client documents</h3>' + (['documents_pending', 'active'].indexOf(v.status) > -1 ? '<button class="btn btn-dark btn-sm" id="gen">' + (v.issued.length ? 'Regenerate' : 'Generate from drafts') + '</button>' : '') + '</div><p class="small muted">Generated from this centre\'s draft templates (' + tpls.length + ' for this plan) with the client\'s details filled in.</p>' +
      (v.issued.length ? v.issued.map(function (d, i) { return '<div class="doc-row"><span><b>' + esc(d.title) + '</b> <span class="xs muted">· ' + istStr(d.at) + '</span></span><button class="link small" data-view="' + i + '">View</button></div>'; }).join('') : '<p class="small muted">Nothing issued yet.</p>') +
      (v.status === 'documents_pending' && v.issued.length ? '<button class="btn btn-primary btn-sm" id="act8" style="width:fit-content">Activate virtual office</button>' : '') + '</div></div>' +
      '<div class="card"><h3>Timeline</h3><div class="timeline">' + (v.events || []).slice().reverse().map(function (e) { return '<div class="tl"><i>→</i><div class="stack" style="gap:2px"><span><b>' + (VST[e.to] || e.to) + '</b>' + (e.note ? ' · ' + esc(e.note) : '') + '</span><span class="meta">' + (e.actor ? esc(userName(e.actor)) : 'System') + ' · ' + istStr(e.at) + '</span></div></div>'; }).join('') + '</div></div></div>' +
      '<div class="modal" id="dv" hidden><div class="modal-box wide"><header><b id="dv-t"></b><button class="btn btn-ghost btn-sm" id="dv-x">Close</button></header><div class="body"><div class="page md" id="dv-b"></div></div></div></div>';
    return A('vos', html, function () {
      var re = function (m2) { save(); toast(m2); render(); };
      var ok = $('#ok'); if (ok) ok.onclick = function () { voEvent(v, 'documents_pending', 'KYC approved'); outMail(u.email, 'KYC approved for ' + v.business, 'kyc'); re('Approved. Generate the documents next.'); };
      var no = $('#no'); if (no) no.onclick = function () { var w = $('#why').value.trim(); if (!w) return toast('Give a reason so the client knows what to fix.'); voEvent(v, 'kyc_rejected', w); outMail(u.email, 'Action needed on your KYC', 'kyc'); re('Rejected. The client was emailed.'); };
      $('#reset').onclick = function () { var w = $('#rwhy').value.trim() || 'Please upload your documents again'; v.kyc = {}; v.issued = []; voEvent(v, 'awaiting_kyc', 'KYC reset: ' + w); outMail(u.email, 'Please re-upload your KYC documents', 'kyc'); re('KYC reset'); };
      var gen = $('#gen'); if (gen) gen.onclick = function () { if (!tpls.length) return toast('No draft templates for this centre and plan. Add them under Locations & documents.'); var f = voFields(v); v.issued = tpls.map(function (d) { return { title: d.title, html: MD.markdown(d.body, f).replace(/<span class="fld"[^>]*>([\s\S]*?)<\/span>/g, '<b>$1</b>'), at: NOW() }; }); v.events.push({ from: v.status, to: v.status, note: v.issued.length + ' documents generated', at: NOW(), actor: me().id }); re('Generated ' + v.issued.length + ' documents'); };
      var a8 = $('#act8'); if (a8) a8.onclick = function () { v.start = ist().date; var d = new Date(v.start + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + v.months); d.setUTCDate(d.getUTCDate() - 1); v.end = d.toISOString().slice(0, 10); voEvent(v, 'active', 'Documents issued to client'); outMail(u.email, 'Your virtual office is active', 'kyc'); re('Active. The client can download the documents.'); };
      $$('[data-view]').forEach(function (b) { b.onclick = function () { var d = v.issued[+b.dataset.view]; $('#dv-t').textContent = d.title; $('#dv-b').innerHTML = d.html; $('#dv').hidden = false; }; }); $('#dv-x').onclick = function () { $('#dv').hidden = true; };
    });
  };
  // The member sees issued documents on their virtual office page.
  var baseDashVo = routes['/dashboard/vo'];
  routes['/dashboard/vo'] = function (q) {
    var out = baseDashVo(q); if (!out) return out; var v = db.vos.filter(function (x) { return x.id === +q.id; })[0];
    if (v && v.status === 'kyc_rejected') out.html = out.html.replace('<div class="card"><h3>KYC documents</h3>', '<p class="alert error">' + esc(((v.events || []).slice(-1)[0] || {}).note || 'Please re-upload') + '</p><div class="card"><h3>KYC documents</h3>');
    if (v && v.status === 'active' && v.issued && v.issued.length) out.html = out.html.replace('<p class="muted small">Your agreement, NOC, utility bill and property tax receipt appear here once KYC is approved.</p>', v.issued.map(function (d, i) { return '<div class="doc-row"><b>' + esc(d.title) + '</b><button class="link small" data-myd="' + i + '">View</button></div>'; }).join('') + '<div class="page md" id="myd" hidden style="margin-top:10px"></div>');
    var bi = out.init; out.init = function () { if (bi) bi(); $$('[data-myd]').forEach(function (b) { b.onclick = function () { var p = $('#myd'); p.innerHTML = v.issued[+b.dataset.myd].html; p.hidden = false; }; }); };
    return out;
  };

  /* ---------------- tickets ---------------- */
  var TPRI_L = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' };
  routes['/admin/tickets'] = function (q) {
    if (needAdmin()) return; var st = q.status || 'active', u = me(), cnt = {};
    db.tickets.forEach(function (t2) { cnt[t2.status] = (cnt[t2.status] || 0) + 1; });
    var rows = db.tickets.filter(function (t2) { return (st === 'active' ? ['open', 'in_progress', 'waiting'].indexOf(t2.status) > -1 : st === 'all' || t2.status === st) && (q.mine ? t2.assigneeId === u.id : true); }).sort(function (a, b) { return ['urgent', 'high', 'normal', 'low'].indexOf(a.priority) - ['urgent', 'high', 'normal', 'low'].indexOf(b.priority) || b.updatedAt - a.updatedAt; });
    var html = '<div class="stack" style="gap:4px"><h1>Support tickets</h1><p class="muted small">Raised by clients from their dashboard. First-response targets: urgent 2 h, high 4 h, normal 24 h, low 48 h.</p></div>' +
      '<div class="tabs-sm"><a href="#/admin/tickets" class="' + (st === 'active' && !q.mine ? 'on' : '') + '">Active</a><a href="' + link('/admin/tickets?mine=1') + '" class="' + (q.mine ? 'on' : '') + '">Assigned to me</a>' + Object.keys(TST).map(function (k) { return '<a href="' + link('/admin/tickets?status=' + k) + '" class="' + (st === k ? 'on' : '') + '">' + TST[k] + ' <span class="soft">' + (cnt[k] || 0) + '</span></a>'; }).join('') + '<a href="' + link('/admin/tickets?status=all') + '" class="' + (st === 'all' ? 'on' : '') + '">All</a></div>' +
      '<div class="tbl"><table class="dense"><thead><tr><th>Ticket</th><th>Client</th><th>Category</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Response</th><th>Updated</th></tr></thead><tbody>' + rows.map(function (t2) { var c = byId('users', t2.userId) || {}, s3 = sla(t2); return '<tr><td><a class="link" href="' + link('/admin/ticket?id=' + t2.id) + '"><b class="mono small">' + t2.number + '</b> ' + esc(t2.subject) + '</a></td><td class="small">' + esc(c.name) + '</td><td class="small">' + TCAT[t2.category] + '</td><td><span class="pill ' + (t2.priority === 'urgent' ? 'rd' : t2.priority === 'high' ? 'am' : '') + '">' + TPRI_L[t2.priority] + '</span></td><td class="small">' + TST[t2.status] + '</td><td class="small">' + (t2.assigneeId ? esc(userName(t2.assigneeId)) : 'Unassigned') + '</td><td class="small" style="' + (s3 && s3.overdue ? 'color:var(--red);font-weight:600' : '') + '">' + (s3 ? (s3.overdue ? 'Overdue ' : 'Due ') + ago(s3.due) : 'Responded') + '</td><td class="small">' + ago(t2.updatedAt) + '</td></tr>'; }).join('') + (rows.length ? '' : '<tr><td colspan="8" class="muted">No tickets here.</td></tr>') + '</tbody></table></div>';
    return A('tickets', html);
  };
  routes['/admin/ticket'] = function (q) {
    if (needAdmin()) return; var t2 = byId('tickets', q.id); if (!t2) return A('tickets', '<h1>Not found</h1>');
    var c = byId('users', t2.userId) || {}, msgs = db.tmsgs.filter(function (m2) { return m2.ticketId === t2.id; }), team = db.users.filter(function (x) { return x.role === 'admin' || (isStaff(x) && x.staff.perms.indexOf('tickets') > -1); }), d = deskOf(t2.userId), s3 = sla(t2);
    var html = '<div class="crumbs"><a href="#/admin/tickets">Tickets</a><span>›</span><span>' + t2.number + '</span></div><div class="between"><div class="stack" style="gap:4px"><h1>' + esc(t2.subject) + '</h1><p class="muted small">' + t2.number + ' · ' + TCAT[t2.category] + ' · opened ' + istStr(t2.createdAt) + (s3 ? ' · <b style="color:' + (s3.overdue ? 'var(--red)' : 'inherit') + '">first response ' + (s3.overdue ? 'overdue' : 'due') + ' ' + ago(s3.due) + '</b>' : '') + '</p></div><span class="pill">' + TST[t2.status] + '</span></div>' +
      '<div class="lead-grid"><div class="stack-lg"><div class="card"><div class="stack">' + msgs.map(function (m2) { return '<div class="msg ' + (m2.staff ? 'staff' : '') + (m2.internal ? ' internal' : '') + '"><span class="meta">' + esc(userName(m2.authorId)) + (m2.internal ? ' · internal note, client can\'t see this' : '') + ' · ' + istStr(m2.at) + '</span><p style="white-space:pre-wrap">' + esc(m2.body) + '</p></div>'; }).join('') + '</div></div>' +
      '<form class="card form" id="rp"><div class="field"><label>Reply</label><textarea name="body" rows="4"></textarea></div><div class="row"><label class="check"><input type="checkbox" name="internal" value="1"><span>Internal note</span></label><select name="status" style="width:auto;min-height:38px;padding:6px 10px"><option value="">Keep status (' + TST[t2.status] + ')</option>' + Object.keys(TST).map(function (k) { return '<option value="' + k + '">' + TST[k] + '</option>'; }).join('') + '</select><button class="btn btn-dark btn-sm">Send</button></div><span class="xs muted">A reply sets the ticket to "Waiting on client" unless you choose another status. The client is emailed.</span></form></div>' +
      '<div class="stack-lg"><form class="card form" id="meta"><h3>Ticket</h3><div class="field"><label>Assigned to</label><select name="a"><option value="">Nobody</option>' + team.map(function (x) { return '<option value="' + x.id + '"' + (t2.assigneeId === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div><div class="f2"><div class="field"><label>Priority</label><select name="p">' + Object.keys(TPRI_L).map(function (k) { return '<option value="' + k + '"' + (t2.priority === k ? ' selected' : '') + '>' + TPRI_L[k] + '</option>'; }).join('') + '</select></div><div class="field"><label>Category</label><select name="c">' + Object.keys(TCAT).map(function (k) { return '<option value="' + k + '"' + (t2.category === k ? ' selected' : '') + '>' + TCAT[k] + '</option>'; }).join('') + '</select></div></div><button class="btn btn-ghost btn-sm" style="width:fit-content">Save</button></form>' +
      '<div class="card"><h3>Client</h3><dl class="dl"><dt>Name</dt><dd>' + esc(c.name) + '</dd><dt>Email</dt><dd>' + esc(c.email) + '</dd><dt>Phone</dt><dd class="mono">' + esc(c.phone || '') + '</dd>' + (d ? '<dt>Desk</dt><dd>' + esc(d.name) + ' · ' + d.seats + ' seats · <a class="link" href="' + link('/admin/credit?id=' + d.id) + '">credits</a></dd>' : '') + db.vos.filter(function (v) { return v.userId === c.id; }).map(function (v) { return '<dt>Virtual office</dt><dd><a class="link" href="' + link('/admin/vo?id=' + v.id) + '">' + esc(v.business) + '</a> · ' + (VST[v.status] || v.status) + '</dd>'; }).join('') + '</dl></div></div></div>';
    return A('tickets', html, function () {
      onSubmit($('#rp'), function (e) { var v = vals(e.target); if (!v.body && !v.status) return toast('Write a reply or change the status.'); if (v.body) { db.tmsgs.push({ id: ++db.seq, ticketId: t2.id, authorId: me().id, staff: true, internal: !!v.internal, body: v.body, at: NOW() }); if (!v.internal) { t2.firstResponseAt = t2.firstResponseAt || NOW(); outMail(c.email, 'Re: [' + t2.number + '] ' + t2.subject, 'ticket',v.body); } }
        t2.status = v.status || (v.body && !v.internal ? 'waiting' : t2.status); if (!t2.assigneeId) t2.assigneeId = me().id; t2.updatedAt = NOW(); save(); toast(v.body && !v.internal ? 'Reply sent' : 'Saved'); render(); });
      onSubmit($('#meta'), function (e) { var v = vals(e.target), ch = []; if ((+v.a || null) !== t2.assigneeId) ch.push('assigned to ' + (v.a ? userName(+v.a) : 'nobody')); if (v.p !== t2.priority) ch.push('priority ' + t2.priority + ' → ' + v.p); if (v.c !== t2.category) ch.push('category → ' + TCAT[v.c]);
        t2.assigneeId = +v.a || null; t2.priority = v.p; t2.category = v.c; t2.updatedAt = NOW(); if (ch.length) db.tmsgs.push({ id: ++db.seq, ticketId: t2.id, authorId: me().id, staff: true, internal: true, body: 'Changed: ' + ch.join(', '), at: NOW() }); save(); toast('Saved'); render(); });
    });
  };

  /* ---------------- desk members and credits ---------------- */
  routes['/admin/credits'] = function () {
    if (needAdmin()) return; var t = ist().date, s2 = db.settings, rows = db.deskClients.filter(function (d) { return !d.end || d.end >= t; });
    var used = function (d) { return -db.ledger.filter(function (x) { return x.dcId === d.id && x.reason === 'booking' && x.period === period(); }).reduce(function (n, x) { return n + x.delta; }, 0); };
    var buys = db.ledger.filter(function (x) { return x.reason === 'purchase'; }).slice(-15).reverse();
    var html = '<div class="stack" style="gap:4px"><h1>Desk members & meeting room credits</h1><p class="muted small">1 credit = ₹1 of meeting room time at list price, so a 4-seat room uses 400 credits an hour and the 10-seat boardroom 1,000. Monthly credits reset on the 1st; bought credits never expire.</p></div>' +
      '<form class="card form" id="cs" style="max-width:820px"><h3>Default allowance</h3><div class="f2"><div class="field"><label>Meeting room hours per desk seat, per month</label><input type="number" name="h" min="0" max="100" value="' + s2.hoursPerSeat + '"><span class="hint">Your rule: 1 seat = 1 hour. A 5-seat client gets 5 hours.</span></div><div class="field"><label>Credits per hour</label><input type="number" name="c" min="1" value="' + s2.creditsPerHour + '"><span class="hint">400 = one hour in a 4-seat room.</span></div></div><p class="small muted">Default for a 5-seat client: <b>' + (5 * s2.hoursPerSeat * s2.creditsPerHour).toLocaleString('en-IN') + ' credits</b> (₹' + (5 * s2.hoursPerSeat * s2.creditsPerHour).toLocaleString('en-IN') + ' of room time). Override per client after negotiation. Extra credits are bought online at ₹1 + GST each.</p><button class="btn btn-dark btn-sm" style="width:fit-content">Save</button></form>' +
      '<div class="tbl"><table class="dense"><thead><tr><th>Client</th><th>Centre</th><th class="num">Seats</th><th>Member login</th><th class="num">Monthly allowance</th><th class="num">Used this month</th><th class="num">Balance</th></tr></thead><tbody>' + rows.map(function (d) { var b = d.userId ? balance(d) : null; return '<tr><td><a class="link" href="' + link('/admin/credit?id=' + d.id) + '"><b>' + esc(d.name) + '</b></a></td><td class="small">' + esc(centre(d.centre).short) + '</td><td class="num">' + d.seats + '</td><td class="small">' + (d.userId ? esc(byId('users', d.userId).email) : '<span class="pill am">Not linked</span>') + '</td><td class="num">' + allot(d).toLocaleString('en-IN') + (d.monthlyCredits != null ? ' <span class="xs muted">custom</span>' : '') + '</td><td class="num">' + used(d).toLocaleString('en-IN') + '</td><td class="num"><b>' + (b ? b.total.toLocaleString('en-IN') : '—') + '</b></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="card"><h3>Recent credit purchases</h3>' + (buys.length ? buys.map(function (x) { return '<div class="doc-row"><span><b>' + esc((byId('deskClients', x.dcId) || {}).name || '') + '</b> · ' + x.delta.toLocaleString('en-IN') + ' credits</span><span class="xs muted">' + istStr(x.at) + '</span></div>'; }).join('') : '<p class="small muted">None yet. Members buy from Dashboard → Credits.</p>') + '</div>';
    return A('credits', html, function () { onSubmit($('#cs'), function (e) { var v = vals(e.target); s2.hoursPerSeat = Math.max(0, +v.h || 0); s2.creditsPerHour = Math.max(1, +v.c || 400); save(); toast('Saved. New allowances apply from the next allotment.'); render(); }); });
  };
  routes['/admin/credit'] = function (q) {
    if (needAdmin()) return; var d = byId('deskClients', q.id); if (!d) return A('credits', '<h1>Not found</h1>');
    var m = d.userId ? byId('users', d.userId) : null, b = m ? balance(d) : null, led = db.ledger.filter(function (x) { return x.dcId === d.id; }).slice().reverse();
    var html = '<div class="crumbs"><a href="#/admin/credits">Desk members</a><span>›</span><span>' + esc(d.name) + '</span></div><h1>' + esc(d.name) + '</h1><p class="muted small">' + d.seats + ' seats at ' + esc(centre(d.centre).name) + ' · from ' + d.start + (d.end ? ' to ' + d.end : '') + '</p>' +
      (b ? '<div class="kpis"><div class="kpi"><span>Monthly credits left</span><b>' + b.monthly.toLocaleString('en-IN') + '</b><small>of ' + allot(d).toLocaleString('en-IN') + ' · resets on the 1st</small></div><div class="kpi"><span>Bought credits</span><b>' + b.purchased.toLocaleString('en-IN') + '</b><small>never expire</small></div><div class="kpi"><span>Total</span><b>' + b.total.toLocaleString('en-IN') + '</b><small>≈ ' + Math.floor(b.total / 400) + ' h in a 4-seat room</small></div></div>' : '<p class="alert info">Link a member login so this client can book rooms with credits.</p>') +
      '<div class="g2" style="align-items:start"><form class="card form" id="cf"><h3>Member and allowance</h3><div class="field"><label>Member login email</label><input name="em" value="' + esc(m ? m.email : '') + '" placeholder="the email they sign up with"><span class="hint">Must already have an account on the website.</span></div><div class="f2"><div class="field"><label>Monthly credits (negotiated)</label><input type="number" name="mc" min="0" value="' + (d.monthlyCredits != null ? d.monthlyCredits : '') + '" placeholder="Default: ' + (d.seats * db.settings.hoursPerSeat * db.settings.creditsPerHour) + '"><span class="hint">Leave blank to use seats × hours × credits.</span></div><div class="field"><label>Monthly fee (₹)</label><input name="fee" value="' + (d.monthlyFee ? d.monthlyFee / 100 : '') + '"></div></div><button class="btn btn-dark btn-sm" style="width:fit-content">Save</button></form>' +
      '<form class="card form" id="gf"><h3>Allot or deduct credits</h3><div class="f2"><div class="field"><label>Credits</label><input type="number" name="n" placeholder="e.g. 800 or -400"></div><div class="field"><label>Into</label><select name="bk"><option value="purchased">Bought bucket (doesn\'t expire)</option><option value="monthly">This month only</option></select></div></div><div class="field"><label>Reason</label><input name="note" placeholder="Goodwill for the Wi-Fi outage"></div><button class="btn btn-ghost btn-sm" style="width:fit-content">Apply</button></form></div>' +
      '<div class="card"><h3>Ledger</h3><div class="tbl" style="border:0"><table class="dense"><thead><tr><th>When</th><th>What</th><th>Bucket</th><th class="num">Credits</th><th>By</th></tr></thead><tbody>' + led.map(function (x) { return '<tr><td class="small">' + istStr(x.at) + '</td><td class="small">' + esc(x.note || x.reason) + '</td><td class="small">' + x.bucket + '</td><td class="num" style="color:' + (x.delta < 0 ? 'var(--red)' : 'inherit') + '">' + (x.delta > 0 ? '+' : '') + x.delta.toLocaleString('en-IN') + '</td><td class="small">' + (x.actorId ? esc(userName(x.actorId)) : 'System') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    return A('credits', html, function () {
      onSubmit($('#cf'), function (e) { var v = vals(e.target); if (v.em) { var mu = db.users.filter(function (x) { return x.email.toLowerCase() === v.em.trim().toLowerCase(); })[0]; if (!mu) return toast('No account uses ' + v.em + '. Ask them to sign up first.'); d.userId = mu.id; } d.monthlyCredits = v.mc === '' ? null : Math.max(0, +v.mc); d.monthlyFee = rupeesIn(v.fee); save(); toast('Saved'); render(); });
      onSubmit($('#gf'), function (e) { var v = vals(e.target), n = parseInt(v.n, 10); if (!n || !v.note) return toast('Enter credits and a reason.'); grant(d.id, n, v.bk, 'adjustment', v.note, me().id); save(); toast((n > 0 ? 'Added ' : 'Deducted ') + Math.abs(n) + ' credits'); render(); });
    });
  };

  /* ---------------- coupons ---------------- */
  routes['/admin/coupons'] = function () {
    if (needAdmin()) return;
    var html = '<div class="stack" style="gap:4px"><h1>Discount codes</h1><p class="muted small">Codes customers enter at checkout. Featured codes show on the home page. Codes don\'t apply to credit top-ups.</p></div>' +
      '<div class="tbl"><table class="dense"><thead><tr><th>Code</th><th>Discount</th><th>Applies to</th><th>Minimum</th><th class="num">Used</th><th>Featured</th><th>Status</th><th></th></tr></thead><tbody>' + db.coupons.map(function (c, i) { return '<tr><td class="mono"><b>' + esc(c.code) + '</b><br><span class="xs muted" style="font-family:inherit">' + esc(c.desc || '') + '</span></td><td>' + (c.kind === 'percent' ? c.value + '%' : rs0(c.value)) + '</td><td class="small">' + (c.products === '*' ? 'Everything' : PROD[c.products]) + '</td><td class="small">' + (c.min ? rs0(c.min) : '—') + '</td><td class="num">' + (c.used || 0) + '</td><td>' + (c.featured ? '★' : '') + '</td><td><span class="pill ' + (c.active ? 'gr' : '') + '">' + (c.active ? 'Active' : 'Off') + '</span></td><td><button class="link small" data-tog="' + i + '">' + (c.active ? 'Turn off' : 'Turn on') + '</button></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<form class="card form" id="nc" style="max-width:860px"><h3>New code</h3><div class="f2"><div class="field"><label>Code</label><input name="code" maxlength="20" style="text-transform:uppercase" placeholder="DIWALI15"></div><div class="field"><label>Shown to customers as</label><input name="desc" placeholder="15% off virtual office plans"></div></div><div class="g4"><div class="field"><label>Type</label><select name="kind"><option value="percent">Percent</option><option value="flat">Flat ₹</option></select></div><div class="field"><label>Value</label><input name="value" inputmode="decimal" placeholder="15"></div><div class="field"><label>Applies to</label><select name="products"><option value="*">Everything</option>' + ['virtual_office', 'meeting_room', 'day_pass'].map(function (k) { return '<option value="' + k + '">' + PROD[k] + '</option>'; }).join('') + '</select></div><div class="field"><label>Minimum order (₹)</label><input name="min" inputmode="decimal" placeholder="0"></div></div><label class="check"><input type="checkbox" name="featured" value="1"><span>Feature on the home page</span></label><button class="btn btn-dark btn-sm" style="width:fit-content">Create code</button></form>';
    return A('coupons', html, function () {
      $$('[data-tog]').forEach(function (b) { b.onclick = function () { var c = db.coupons[+b.dataset.tog]; c.active = !c.active; save(); render(); }; });
      onSubmit($('#nc'), function (e) { var v = vals(e.target), code = (v.code || '').trim().toUpperCase(), val = parseFloat(v.value); if (!/^[A-Z0-9]{3,20}$/.test(code)) return toast('Code: 3 to 20 letters or digits.'); if (db.coupons.some(function (c) { return c.code === code; })) return toast('That code exists.'); if (!(val > 0) || (v.kind === 'percent' && val > 90)) return toast('Enter a value (percent up to 90).');
        db.coupons.push({ code: code, kind: v.kind, value: v.kind === 'percent' ? val : Math.round(val * 100), min: rupeesIn(v.min) || 0, products: v.products, desc: v.desc || '', featured: !!v.featured, active: true, used: 0 }); save(); toast('Created ' + code); render(); });
    });
  };

  /* ---------------- locations: draft documents ---------------- */
  var KIND_L = { lla: 'Leave & licence agreement', noc: 'NOC', owner_noc: 'Owners\' NOC', utility: 'Utility bill', tax: 'Property tax receipt', other: 'Other' };
  var baseCentre = routes['/admin/centre'];
  routes['/admin/centre'] = function (q) { var out = baseCentre(q); if (!out || q.key === 'new') return out; var bi = out.init; out.init = function () { if (bi) bi(); var st = $('.adm-main .stack-lg'); if (st) st.insertAdjacentHTML('beforeend', '<div class="card"><div class="between"><h3>Draft documents</h3><a class="btn btn-ghost btn-sm" href="' + link('/admin/docs?centre=' + q.key) + '">Edit drafts</a></div><p class="small muted">' + db.docs.filter(function (d) { return d.centre === q.key; }).length + ' templates: agreements and NOCs per plan. They drive the website preview and the documents generated for each client.</p></div>'); }; return out; };
  routes['/admin/docs'] = function (q) {
    if (needAdmin()) return; var ck = q.centre || db.centres[0].key, c = centre(ck), list = db.docs.filter(function (d) { return d.centre === ck; }).sort(function (a, b) { return a.plan.localeCompare(b.plan) || a.sort - b.sort; });
    var html = '<div class="crumbs"><a href="#/admin/centres">Locations</a><span>›</span><a href="' + link('/admin/centres/' + ck) + '">' + esc(c.name) + '</a><span>›</span><span>Draft documents</span></div><div class="between"><h1>Draft documents</h1><div class="row"><select id="cc" style="width:auto">' + db.centres.map(function (x) { return '<option value="' + x.key + '"' + (x.key === ck ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select><a class="btn btn-primary btn-sm" href="' + link('/admin/doc?centre=' + ck) + '">New document</a></div></div>' +
      '<p class="muted small">Based on your Gurugram and Delhi drafts. Use {{company}}, {{signatory}}, {{centre_address}}, {{start_date}}, {{term}}, {{fee}}, {{plan}} and {{date}}; they are filled for each client.</p>' +
      Object.keys(PLANS).map(function (pl) { var ds = list.filter(function (d) { return d.plan === pl; }); return '<div class="card"><h3>' + PLANS[pl].name + ' <span class="soft small">' + ds.length + ' documents</span></h3>' + (ds.length ? ds.map(function (d) { return '<div class="doc-row"><div class="stack" style="gap:2px"><a class="link" href="' + link('/admin/doc?id=' + d.id) + '"><b>' + esc(d.title) + '</b></a><span class="xs muted">' + KIND_L[d.kind] + ' · ' + (d.public ? 'shown on website' : 'internal') + ' · edited ' + ago(d.updatedAt) + (d.editor ? ' by ' + esc(userName(d.editor)) : '') + '</span></div><a class="btn btn-ghost btn-sm" href="' + link('/admin/doc?id=' + d.id) + '">Edit</a></div>'; }).join('') : '<p class="small muted">No drafts. Copy them from another centre or add one.</p>') + '</div>'; }).join('') +
      (list.length ? '' : '<div class="card"><h3>Copy drafts from another centre</h3><div class="row"><select id="from" style="width:auto">' + db.centres.filter(function (x) { return x.key !== ck; }).map(function (x) { return '<option value="' + x.key + '">' + esc(x.name) + '</option>'; }).join('') + '</select><button class="btn btn-dark btn-sm" id="copy">Copy all</button></div></div>');
    return A('centres', html, function () { $('#cc').onchange = function () { go('/admin/docs?centre=' + this.value); }; var cp = $('#copy'); if (cp) cp.onclick = function () { db.docs.filter(function (d) { return d.centre === $('#from').value; }).forEach(function (d) { db.docs.push(Object.assign({}, d, { id: ++db.seq, centre: ck, updatedAt: NOW(), editor: me().id })); }); save(); toast('Copied. Check addresses and utility details.'); render(); }; });
  };
  routes['/admin/doc'] = function (q) {
    if (needAdmin()) return; var d = q.id ? byId('docs', q.id) : { id: null, centre: q.centre || db.centres[0].key, plan: 'gst', kind: 'noc', title: '', body: '# Title\n\nThis is to certify that **{{company}}** …', public: true, sort: 9 };
    if (!d) return A('centres', '<h1>Not found</h1>'); var c = centre(d.centre);
    var html = '<div class="crumbs"><a href="' + link('/admin/docs?centre=' + d.centre) + '">Draft documents</a><span>›</span><span>' + esc(d.title || 'New') + '</span></div><h1>' + esc(d.title || 'New document') + '</h1>' +
      '<form class="card form" id="df"><div class="g4"><div class="field" style="grid-column:span 2"><label>Title</label><input name="title" value="' + esc(d.title) + '"></div><div class="field"><label>Plan</label><select name="plan">' + Object.keys(PLANS).map(function (k) { return '<option value="' + k + '"' + (d.plan === k ? ' selected' : '') + '>' + PLANS[k].name + '</option>'; }).join('') + '</select></div><div class="field"><label>Type</label><select name="kind">' + Object.keys(KIND_L).map(function (k) { return '<option value="' + k + '"' + (d.kind === k ? ' selected' : '') + '>' + KIND_L[k] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="mdedit"><div class="field"><label>Text <span class="soft">(# heading, **bold**, - list, | table |)</span></label><textarea name="body" rows="24" class="mono" style="font-size:.82rem">' + esc(d.body) + '</textarea></div><div class="field"><label>Preview for a sample client at ' + esc(c.name) + '</label><div class="page md" id="pv" style="max-height:560px;overflow:auto"></div></div></div>' +
      '<div class="row"><label class="check"><input type="checkbox" name="public" value="1"' + (d.public ? ' checked' : '') + '><span>Show on the website as a preview</span></label><button class="btn btn-dark">Save</button>' + (d.id ? '<button type="button" class="btn btn-danger btn-sm" id="del">Delete</button>' : '') + '</div></form>';
    return A('centres', html, function () {
      var f = $('#df'), fs = { company: 'Sample Ventures Private Limited', signatory: 'Rohan Sharma', date: fmtDay(ist().date), start_date: fmtDay(ist().date), centre_address: c.address, city: c.city, term: AGREEMENT_TERM, plan: PLANS[f.plan.value].name, fee: rs0(PLANS[f.plan.value].price) + ' per year' };
      var pv = function () { fs.plan = PLANS[f.plan.value].name; fs.fee = rs0(PLANS[f.plan.value].price) + ' per year'; $('#pv').innerHTML = MD.markdown(f.body.value, fs); }; f.addEventListener('input', pv); pv();
      onSubmit(f, function () { var v = vals(f); if (!v.title || (v.body || '').length < 20) return toast('Add a title and the document text.'); if (!d.id) { d.id = ++db.seq; db.docs.push(d); } Object.assign(d, { title: v.title, plan: v.plan, kind: v.kind, body: v.body, public: !!v.public, updatedAt: NOW(), editor: me().id }); save(); toast('Saved. The website preview uses it now.'); go('/admin/doc?id=' + d.id); });
      var dl = $('#del'); if (dl) dl.onclick = function () { db.docs = db.docs.filter(function (x) { return x.id !== d.id; }); save(); go('/admin/docs?centre=' + d.centre); };
    });
  };

  /* ---------------- content: blogs, case studies, clients ---------------- */
  var slugify = function (s2) { return String(s2).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80); };
  routes['/admin/content'] = function (q) {
    if (needAdmin()) return; var k = q.kind || 'blog', list = db.posts.filter(function (p) { return p.kind === k; }).sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    var html = '<div class="between"><h1>Blogs, case studies, clients</h1><a class="btn btn-primary btn-sm" href="' + link('/admin/post?kind=' + k) + '">New ' + (k === 'blog' ? 'blog post' : 'case study') + '</a></div><div class="tabs-sm"><a href="' + link('/admin/content?kind=blog') + '" class="' + (k === 'blog' ? 'on' : '') + '">Blog</a><a href="' + link('/admin/content?kind=case_study') + '" class="' + (k === 'case_study' ? 'on' : '') + '">Case studies</a><a href="' + link('/admin/content?kind=clients') + '" class="' + (k === 'clients' ? 'on' : '') + '">Client logos</a></div>';
    if (k === 'clients') {
      html += '<p class="muted small">Shown on the home page. <b>Get written permission before showing a client\'s logo.</b></p><div class="tbl"><table class="dense"><thead><tr><th>Client</th><th>Logo</th><th>Order</th><th>Shown</th><th></th></tr></thead><tbody>' + db.clients.slice().sort(function (a, b) { return a.sort - b.sort; }).map(function (c, i, arr) { return '<tr><td><b>' + esc(c.name) + '</b></td><td>' + (c.logo ? '<img src="' + c.logo + '" alt="" style="height:28px">' : '<span class="xs muted">Text wordmark</span>') + ' <label class="link small" style="cursor:pointer">Upload<input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" data-logo="' + c.id + '" hidden></label></td><td>' + (i ? '<button class="link small" data-up="' + c.id + '">↑</button>' : '') + (i < arr.length - 1 ? ' <button class="link small" data-dn="' + c.id + '">↓</button>' : '') + '</td><td><button class="link small" data-show="' + c.id + '">' + (c.active ? 'Yes' : 'No') + '</button></td><td><button class="link small" style="color:var(--red)" data-rm="' + c.id + '">Remove</button></td></tr>'; }).join('') + '</tbody></table></div><div class="row"><input id="cn" placeholder="Client name" style="max-width:320px"><button class="btn btn-dark btn-sm" id="ca">Add client</button></div>';
    } else html += '<div class="tbl"><table class="dense"><thead><tr><th>Title</th><th>Status</th><th>Updated</th><th>Link</th></tr></thead><tbody>' + list.map(function (p) { return '<tr><td><a class="link" href="' + link('/admin/post?id=' + p.id) + '"><b>' + esc(p.title) + '</b></a><br><span class="xs muted">' + esc(p.excerpt || '') + '</span></td><td><span class="pill ' + (p.status === 'published' ? 'gr' : '') + '">' + p.status + '</span></td><td class="small">' + ago(p.updatedAt) + '</td><td class="small">' + (p.status === 'published' ? '<a class="link" href="' + link('/post?slug=' + p.slug) + '">View</a>' : '') + '</td></tr>'; }).join('') + (list.length ? '' : '<tr><td colspan="4" class="muted">Nothing yet.</td></tr>') + '</tbody></table></div>';
    return A('content', html, function () {
      var ca = $('#ca'); if (!ca) return; var sorted = db.clients.slice().sort(function (a, b) { return a.sort - b.sort; });
      ca.onclick = function () { var n = $('#cn').value.trim(); if (n.length < 2) return toast('Enter the client name.'); db.clients.push({ id: ++db.seq, name: n, logo: null, url: '', active: true, sort: db.clients.length }); save(); render(); };
      var mv = function (id, dir) { var i = sorted.findIndex(function (c) { return c.id === id; }), j = i + dir; var a = sorted[i], b = sorted[j]; var t2 = a.sort; a.sort = b.sort; b.sort = t2; if (a.sort === b.sort) a.sort += dir; save(); render(); };
      $$('[data-up]').forEach(function (b) { b.onclick = function () { mv(+b.dataset.up, -1); }; }); $$('[data-dn]').forEach(function (b) { b.onclick = function () { mv(+b.dataset.dn, 1); }; });
      $$('[data-show]').forEach(function (b) { b.onclick = function () { var c = byId('clients', b.dataset.show); c.active = !c.active; save(); render(); }; });
      $$('[data-rm]').forEach(function (b) { b.onclick = function () { db.clients = db.clients.filter(function (c) { return c.id !== +b.dataset.rm; }); save(); render(); }; });
      $$('[data-logo]').forEach(function (i2) { i2.onchange = function () { var f = i2.files[0]; if (!f) return; if (f.size > 300 * 1024) return toast('Logo must be under 300 KB.'); var r = new FileReader(); r.onload = function () { byId('clients', i2.dataset.logo).logo = r.result; save(); toast('Logo uploaded'); render(); }; r.readAsDataURL(f); }; });
    });
  };
  routes['/admin/post'] = function (q) {
    if (needAdmin()) return; var p = q.id ? byId('posts', q.id) : { id: null, kind: q.kind === 'case_study' ? 'case_study' : 'blog', title: '', slug: '', excerpt: '', body: '', status: 'draft', seoTitle: '', seoDesc: '', client: '', author: me().name, cover: null };
    if (!p) return A('content', '<h1>Not found</h1>');
    var html = '<div class="crumbs"><a href="' + link('/admin/content?kind=' + p.kind) + '">' + (p.kind === 'blog' ? 'Blog' : 'Case studies') + '</a><span>›</span><span>' + esc(p.title || 'New') + '</span></div><h1>' + esc(p.title || (p.kind === 'blog' ? 'New blog post' : 'New case study')) + '</h1>' +
      '<form class="card form" id="pf"><div class="f2"><div class="field"><label>Title</label><input name="title" value="' + esc(p.title) + '"></div><div class="field"><label>URL</label><input name="slug" value="' + esc(p.slug) + '" placeholder="auto from title"><span class="hint">/' + (p.kind === 'blog' ? 'blog' : 'case-studies') + '/<span id="sl">' + esc(p.slug) + '</span>' + (p.id ? ' · changing it adds a redirect from the old URL' : '') + '</span></div></div>' +
      (p.kind === 'case_study' ? '<div class="field"><label>Client</label><input name="client" value="' + esc(p.client || '') + '"><span class="hint">Publish only with the client\'s written approval.</span></div>' : '') +
      '<div class="field"><label>Summary</label><input name="excerpt" maxlength="200" value="' + esc(p.excerpt || '') + '"></div><div class="field"><label>Cover image</label><input type="file" id="cov" accept="image/*"></div>' +
      '<div class="mdedit"><div class="field"><label>Article <span class="soft">(## heading, **bold**, - list, > quote, [link](url))</span></label><textarea name="body" rows="18">' + esc(p.body) + '</textarea></div><div class="field"><label>Preview</label><div class="prose card flat" id="pv" style="max-height:460px;overflow:auto"></div></div></div>' +
      '<h3>Search appearance</h3><div class="f2"><div class="field"><label>SEO title <span class="soft" id="tc"></span></label><input name="seoTitle" value="' + esc(p.seoTitle || '') + '" placeholder="Defaults to the title"></div><div class="field"><label>Meta description <span class="soft" id="dc"></span></label><input name="seoDesc" value="' + esc(p.seoDesc || '') + '"></div></div><div class="serp card flat"><span class="xs muted">livance.co.in › ' + (p.kind === 'blog' ? 'blog' : 'case-studies') + '</span><b id="st" style="color:var(--serp-link)"></b><span class="small muted" id="sd"></span></div>' +
      '<div class="row"><select name="status" style="width:auto"><option value="draft"' + (p.status === 'draft' ? ' selected' : '') + '>Draft</option><option value="published"' + (p.status === 'published' ? ' selected' : '') + '>Published</option></select><button class="btn btn-dark">Save</button>' + (p.id ? '<button type="button" class="btn btn-danger btn-sm" id="del">Delete</button>' : '') + '</div></form>';
    return A('content', html, function () {
      var f = $('#pf'), up = function () { $('#pv').innerHTML = MD.markdown(f.body.value || '*Start writing…*'); var t2 = f.seoTitle.value || f.title.value, dd = f.seoDesc.value || f.excerpt.value; $('#tc').textContent = t2.length + '/60'; $('#dc').textContent = dd.length + '/160'; $('#st').textContent = t2 || 'Title'; $('#sd').textContent = dd; $('#sl').textContent = f.slug.value || slugify(f.title.value); };
      f.addEventListener('input', up); up(); var cover = p.cover;
      $('#cov').onchange = function () { var fl = this.files[0]; if (!fl) return; if (fl.size > 1.5e6) return toast('Cover must be under 1.5 MB.'); var r = new FileReader(); r.onload = function () { cover = r.result; toast('Cover added'); }; r.readAsDataURL(fl); };
      onSubmit(f, function () { var v = vals(f), sl = slugify(v.slug || v.title); if (v.title.trim().length < 5 || (v.body || '').length < 30) return toast('Add a title and at least a paragraph.'); if (db.posts.some(function (x) { return x.slug === sl && x.id !== p.id; })) return toast('Another post uses that URL.');
        var base = p.kind === 'blog' ? '/blog/' : '/case-studies/'; if (p.id && p.slug && p.slug !== sl) db.redirects.push({ from: base + p.slug, to: '/post?slug=' + sl, code: 301, hits: 0 });
        if (!p.id) { p.id = ++db.seq; db.posts.push(p); } Object.assign(p, { title: v.title.trim(), slug: sl, excerpt: v.excerpt, body: v.body, client: v.client || p.client, seoTitle: v.seoTitle, seoDesc: v.seoDesc, cover: cover, updatedAt: NOW(), publishedAt: v.status === 'published' ? (p.publishedAt || NOW()) : p.publishedAt, status: v.status }); save(); toast(v.status === 'published' ? 'Published' : 'Saved as draft'); go('/admin/post?id=' + p.id); });
      var dl = $('#del'); if (dl) dl.onclick = function () { db.posts = db.posts.filter(function (x) { return x.id !== p.id; }); save(); go('/admin/content?kind=' + p.kind); };
    });
  };

  /* ---------------- SEO ---------------- */
  var SEO_PAGES = [['/', 'Home'], ['/virtual-office', 'Virtual office'], ['/meeting-rooms', 'Meeting rooms'], ['/day-pass', 'Day pass'], ['/dedicated-desk', 'Dedicated desk'], ['/locations', 'Locations'], ['/blog', 'Blog'], ['/case-studies', 'Case studies'], ['/contact', 'Contact']];
  routes['/admin/seo'] = function (q) {
    if (needAdmin()) return; var tab = q.tab || 'pages', s2 = db.settings;
    var html = '<div class="stack" style="gap:4px"><h1>SEO</h1><p class="muted small">Titles and descriptions for every page, redirects for old URLs, and the Google Search Console and Analytics tags. The sitemap and structured data are generated automatically.</p></div><div class="tabs-sm"><a href="#/admin/seo" class="' + (tab === 'pages' ? 'on' : '') + '">Pages</a><a href="' + link('/admin/seo?tab=redirects') + '" class="' + (tab === 'redirects' ? 'on' : '') + '">Redirects</a><a href="' + link('/admin/seo?tab=google') + '" class="' + (tab === 'google' ? 'on' : '') + '">Google</a></div>';
    if (tab === 'pages') html += '<div class="tbl"><table class="dense"><thead><tr><th>Page</th><th>Title</th><th>Description</th><th>Check</th><th></th></tr></thead><tbody>' + SEO_PAGES.map(function (pg) { var o = db.seo[pg[0]] || {}, t2 = o.title || '', d = o.desc || '', issues = []; if (!t2) issues.push('default title'); else if (t2.length > 60) issues.push('title long'); if (!d) issues.push('no description'); else if (d.length > 160) issues.push('description long'); if (o.noindex) issues.push('noindex');
        return '<tr><td><b>' + pg[1] + '</b><br><span class="xs muted mono">' + pg[0] + '</span></td><td class="small">' + esc(t2 || '—') + '</td><td class="small">' + esc(d || '—') + '</td><td>' + (issues.length ? issues.map(function (x) { return '<span class="pill am">' + x + '</span>'; }).join(' ') : '<span class="pill gr">Good</span>') + '</td><td><button class="link small" data-ed="' + pg[0] + '">Edit</button></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<form class="card form" id="sf" hidden style="max-width:820px"><h3 id="sf-h"></h3><input type="hidden" name="path"><div class="field"><label>Title <span class="soft" id="tc"></span></label><input name="title"></div><div class="field"><label>Description <span class="soft" id="dc"></span></label><textarea name="desc" rows="2"></textarea></div><div class="serp card flat"><span class="xs muted" id="su"></span><b id="st" style="color:var(--serp-link)"></b><span class="small muted" id="sd"></span></div><label class="check"><input type="checkbox" name="noindex" value="1"><span>Hide from search engines (noindex)</span></label><button class="btn btn-dark btn-sm" style="width:fit-content">Save</button></form>';
    if (tab === 'redirects') html += '<div class="tbl"><table class="dense"><thead><tr><th>From</th><th>To</th><th>Type</th><th class="num">Hits</th><th></th></tr></thead><tbody>' + db.redirects.map(function (r, i) { return '<tr><td class="mono small">' + esc(r.from) + '</td><td class="mono small">' + esc(r.to) + '</td><td>' + r.code + '</td><td class="num">' + r.hits + '</td><td><button class="link small" style="color:var(--red)" data-rd="' + i + '">Delete</button></td></tr>'; }).join('') + '</tbody></table></div><form class="card form" id="rf" style="max-width:820px"><h3>Add a redirect</h3><div class="f2"><div class="field"><label>Old path</label><input name="from" placeholder="/old-page"></div><div class="field"><label>New path</label><input name="to" placeholder="/virtual-office"></div></div><button class="btn btn-dark btn-sm" style="width:fit-content">Add</button><span class="xs muted">Try it: add one, then open #' + '/old-page in the site.</span></form>';
    if (tab === 'google') html += '<form class="card form" id="gf" style="max-width:820px"><div class="field"><label>Google Search Console verification code</label><input name="gsc" value="' + esc(s2.gsc || '') + '" placeholder="from the HTML tag method"></div><div class="field"><label>Google Analytics 4 measurement ID</label><input name="ga4" value="' + esc(s2.ga4 || '') + '" placeholder="G-XXXXXXX"></div><p class="small muted">Sitemap: livance.co.in/sitemap.xml (pages, locations, published posts). Submit it once in Search Console.</p><button class="btn btn-dark btn-sm" style="width:fit-content">Save</button></form>';
    return A('seo', html, function () {
      $$('[data-ed]').forEach(function (b) { b.onclick = function () { var pth = b.dataset.ed, o = db.seo[pth] || {}, f = $('#sf'); f.hidden = false; $('#sf-h').textContent = 'Edit ' + pth; f.path.value = pth; f.title.value = o.title || ''; f.desc.value = o.desc || ''; f.noindex.checked = !!o.noindex; $('#su').textContent = 'livance.co.in' + (pth === '/' ? '' : ' › ' + pth.slice(1)); f.dispatchEvent(new Event('input')); f.scrollIntoView({ behavior: 'smooth' }); }; });
      var sf = $('#sf'); if (sf) { sf.addEventListener('input', function () { $('#tc').textContent = sf.title.value.length + '/60'; $('#dc').textContent = sf.desc.value.length + '/160'; $('#st').textContent = sf.title.value || 'Livance Coworking'; $('#sd').textContent = sf.desc.value; }); onSubmit(sf, function () { db.seo[sf.path.value] = { title: sf.title.value.trim(), desc: sf.desc.value.trim(), noindex: sf.noindex.checked }; save(); toast('Saved'); render(); }); }
      $$('[data-rd]').forEach(function (b) { b.onclick = function () { db.redirects.splice(+b.dataset.rd, 1); save(); render(); }; });
      var rf = $('#rf'); if (rf) onSubmit(rf, function () { var fr = rf.from.value.trim(), to = rf.to.value.trim(); if (fr.charAt(0) !== '/' || to.charAt(0) !== '/' || fr === to) return toast('Both paths start with / and must differ.'); db.redirects.push({ from: fr, to: to, code: 301, hits: 0 }); save(); render(); });
      var gf = $('#gf'); if (gf) onSubmit(gf, function () { s2.gsc = gf.gsc.value.trim(); s2.ga4 = gf.ga4.value.trim(); save(); toast('Saved'); });
    });
  };

  /* ---------------- team and access ---------------- */
  routes['/admin/users'] = function () {
    if (needAdmin()) return; var team = db.users.filter(function (u) { return u.role === 'admin' || u.role === 'staff'; });
    var html = '<div class="between"><div class="stack" style="gap:4px"><h1>Team & access</h1><p class="muted small">Each person gets a role preset, which you can fine-tune. Sales executives see only their own leads; sales managers see their team\'s.</p></div><a class="btn btn-primary btn-sm" href="#/admin/user">Add a team member</a></div>' +
      '<div class="tbl"><table class="dense"><thead><tr><th>Name</th><th>Role</th><th>Reports to</th><th>Gets new leads</th><th>Access</th><th>Status</th></tr></thead><tbody>' + team.map(function (u) { return '<tr><td><a class="link" href="' + link('/admin/user?id=' + u.id) + '"><b>' + esc(u.name) + '</b></a><br><span class="xs muted">' + esc(u.email) + (u.staff && u.staff.title ? ' · ' + esc(u.staff.title) : '') + '</span></td><td class="small">' + esc(roleLabel(u)) + '</td><td class="small">' + (u.staff && u.staff.managerId ? esc(userName(u.staff.managerId)) : '—') + '</td><td>' + (u.staff && u.staff.rotation ? '✓' : '') + '</td><td class="xs muted">' + (u.role === 'admin' ? 'Everything' : u.staff.perms.length + ' permissions') + '</td><td>' + (u.role === 'admin' || u.staff.active ? '<span class="pill gr">Active</span>' : '<span class="pill">Off</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div class="card"><h3>What each role can do</h3><div class="tbl" style="border:0"><table class="dense"><thead><tr><th>Permission</th>' + Object.keys(ROLES).map(function (r) { return '<th class="small" style="text-align:center">' + ROLES[r].label.split(' (')[0] + '</th>'; }).join('') + '</tr></thead><tbody>' + Object.keys(PERMS).map(function (p) { return '<tr><td class="small">' + PERMS[p] + '</td>' + Object.keys(ROLES).map(function (r) { return '<td style="text-align:center">' + (ROLES[r].perms.indexOf(p) > -1 ? '✓' : '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
    return A('users', html);
  };
  routes['/admin/user'] = function (q) {
    if (needAdmin()) return; var u = q.id ? byId('users', q.id) : null, isNew = !u;
    if (u && u.role === 'admin') return A('users', '<div class="crumbs"><a href="#/admin/users">Team</a><span>›</span><span>' + esc(u.name) + '</span></div><h1>' + esc(u.name) + '</h1><p class="muted">Owner account. Has every permission and can\'t be restricted.</p>');
    var s2 = u ? u.staff : { role: 'sales', perms: ROLES.sales.perms.slice(), managerId: null, active: true, rotation: true, title: '' }, managers = db.users.filter(function (x) { return x.role === 'staff' && x.staff.perms.indexOf('crm.team') > -1 && (!u || x.id !== u.id); });
    var html = '<div class="crumbs"><a href="#/admin/users">Team</a><span>›</span><span>' + (isNew ? 'Add' : esc(u.name)) + '</span></div><h1>' + (isNew ? 'Add a team member' : esc(u.name)) + '</h1>' +
      '<form class="card form" id="uf" style="max-width:900px"><div class="f2"><div class="field"><label>Name</label><input name="name" value="' + esc(u ? u.name : '') + '"></div><div class="field"><label>Work email</label><input name="email" type="email" value="' + esc(u ? u.email : '') + '"' + (u ? ' readonly' : '') + '></div></div>' +
      '<div class="g4"><div class="field"><label>Role</label><select name="role" id="rl">' + Object.keys(ROLES).map(function (r) { return '<option value="' + r + '"' + (s2.role === r ? ' selected' : '') + '>' + ROLES[r].label + '</option>'; }).join('') + '</select></div><div class="field"><label>Title</label><input name="title" value="' + esc(s2.title || '') + '" placeholder="Sales, Gurugram"></div><div class="field"><label>Reports to</label><select name="mgr"><option value="">—</option>' + managers.map(function (x) { return '<option value="' + x.id + '"' + (s2.managerId === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div><div class="field"><label>Mobile</label><input name="phone" value="' + esc(u ? u.phone : '') + '"></div></div>' +
      '<h3>Access</h3><div class="perm-grid">' + Object.keys(PERMS).map(function (p) { return '<label class="check"><input type="checkbox" name="perm" value="' + p + '"' + (s2.perms.indexOf(p) > -1 ? ' checked' : '') + (p === 'users' && me().role !== 'admin' ? ' disabled' : '') + '><span>' + PERMS[p] + '</span></label>'; }).join('') + '</div>' +
      '<label class="check"><input type="checkbox" name="rot" value="1"' + (s2.rotation ? ' checked' : '') + '><span>Gets new website leads automatically (round robin)</span></label>' + (u ? '<label class="check"><input type="checkbox" name="active" value="1"' + (s2.active ? ' checked' : '') + '><span>Active. Unticking removes access immediately; their leads stay.</span></label>' : '') +
      '<div class="row"><button class="btn btn-dark">' + (isNew ? 'Add and send invite' : 'Save') + '</button>' + (isNew ? '<span class="xs muted">They get an email to set a password (email activation required).</span>' : '') + '</div></form>';
    return A('users', html, function () {
      $('#rl').onchange = function () { var ps = ROLES[this.value].perms; $$('input[name="perm"]').forEach(function (i2) { if (!i2.disabled) i2.checked = ps.indexOf(i2.value) > -1; }); };
      onSubmit($('#uf'), function (e) { var v = vals(e.target), perms = [].concat(v.perm || []); if ((v.name || '').trim().length < 2) return toast('Enter the name.');
        if(CONNECTED && isNew)return toast('Staff invitations require Supabase Auth provisioning and staff RLS; no demo account was created.');
        if (isNew) { if (emailError(v.email)) return toast(emailError(v.email)); if (db.users.some(function (x) { return x.email.toLowerCase() === v.email.toLowerCase(); })) return toast('That email already has an account.'); u = { id: ++db.seq, email: v.email.trim().toLowerCase(), password: 'team12345', name: '', phone: '', role: 'staff', staff: {} }; db.users.push(u); outMail(u.email, 'You\'re invited to the Livance admin portal', 'invite'); }
        u.name = v.name.trim(); u.phone = digits10(v.phone || '') || u.phone; u.staff = { role: v.role, perms: perms, managerId: +v.mgr || null, active: isNew ? true : !!v.active, rotation: !!v.rot, title: v.title || '' }; save(); toast(isNew ? 'Added. Invite sent to ' + u.email : 'Saved'); go('/admin/users'); });
    });
  };

  if(!CONNECTED){ try { db=JSON.parse(localStorage.getItem(KEY)||'null'); } catch(e) {db=null;} }
  if(!db) seed();
  if(typeof migrateDemo==='function')migrateDemo();
  if(window.LIVANCE_START&&current==='/'){current=window.LIVANCE_START;if(!CONNECTED&&typeof startAs==='function')startAs();}
  if(CONNECTED){liveReady=false;db.session=null;render();refreshLive();}
  else render();
})();
