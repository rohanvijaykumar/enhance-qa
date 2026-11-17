// Corner Shop: a tiny web shop used as a bug-zoo fixture for enhance-qa.
// Run: node server.js  (http://localhost:4310). No dependencies.
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 4310);

// ---- data (in memory; reset on restart) -------------------------------------------------------
const users = [
  { id: 1, email: 'qa-user-a@example.test', name: 'Alex', password: hash('test-pass-a'), role: 'customer', address: '' },
  { id: 2, email: 'qa-user-b@example.test', name: 'Blair', password: hash('test-pass-b'), role: 'customer', address: '12 Oak Lane' },
];
const products = [
  { id: 1, name: 'Ceramic mug', price: 12.0, stock: 8 },
  { id: 2, name: 'Linen tea towel', price: 9.5, stock: 0 },
  { id: 3, name: 'Walnut spoon', price: 18.0, stock: 3 },
];
const orders = [
  { id: 101, userId: 1, items: [{ productId: 1, qty: 2 }], total: 24.0, shipTo: 'Alex, 4 Elm Road' },
  { id: 102, userId: 2, items: [{ productId: 3, qty: 1 }], total: 18.0, shipTo: 'Blair, 12 Oak Lane' },
];
const sessions = new Map(); // token -> userId
const carts = new Map(); // userId or "guest:<token>" -> [{productId, qty}]

function hash(p) {
  return crypto.createHash('sha256').update('corner:' + p).digest('hex');
}

// ---- helpers ----------------------------------------------------------------------------------
function page(title, body, user) {
  const nav = user
    ? `<a href="/">Shop</a> · <a href="/cart">Cart (<span id="cart-count" aria-label="Cart items">${cartCount(user.id)}</span>)</a> · <a href="/account">Account</a> · <a href="/orders">Orders</a> · <form method="post" action="/logout" style="display:inline"><button>Sign out</button></form>`
    : `<a href="/">Shop</a> · <a href="/login">Sign in</a> · <a href="/signup">Sign up</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Corner Shop</title><link rel="stylesheet" href="/static/style.css"></head>
<body><header><strong>Corner Shop</strong> <nav>${nav}</nav></header><main>${body}</main>
<footer><a href="/pricing">Pricing</a> · <a href="/terms">Terms</a> · <a href="/privacy">Privacy</a></footer>
<script src="/static/app.js"></script></body></html>`;
}

function cartKey(user, token) {
  return user ? String(user.id) : 'guest:' + token;
}
function cartCount(userId) {
  return (carts.get(String(userId)) || []).reduce((n, i) => n + i.qty, 0);
}
function currentUser(req) {
  const token = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith('sid='));
  if (!token) return null;
  const id = sessions.get(token.slice(4));
  return users.find((u) => u.id === id) || null;
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      const type = req.headers['content-type'] || '';
      if (type.includes('application/json')) {
        try { return resolve(JSON.parse(data || '{}')); } catch { return resolve({}); }
      }
      resolve(Object.fromEntries(new URLSearchParams(data)));
    });
  });
}
function send(res, status, body, type = 'text/html; charset=utf-8', headers = {}) {
  res.writeHead(status, Object.assign({ 'Content-Type': type }, headers));
  res.end(body);
}
function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json');
}
function money(n) {
  return '$' + n.toFixed(2);
}

// ---- routes -----------------------------------------------------------------------------------
async function handle(req, res) {
  const u = url.parse(req.url, true);
  const user = currentUser(req);
  const p = u.pathname;

  if (p.startsWith('/static/')) {
    const file = path.join(__dirname, 'static', path.basename(p));
    if (!fs.existsSync(file)) return send(res, 404, 'Not found', 'text/plain');
    const type = file.endsWith('.css') ? 'text/css' : 'application/javascript';
    return send(res, 200, fs.readFileSync(file), type);
  }

  if (p === '/' && req.method === 'GET') {
    const q = u.query.q || '';
    const list = products.filter((x) => x.name.toLowerCase().includes(String(q).toLowerCase()));
    const items = list.map((x) => `<li class="product"><a href="/product/${x.id}">${x.name}</a> · ${money(x.price)} ${x.stock === 0 ? '<em>Out of stock</em>' : ''}</li>`).join('');
    // BUG(search-xss): the query is echoed without escaping.
    const heading = q ? `<p>Results for <b>${q}</b></p>` : '';
    const empty = list.length ? '' : '<p class="empty">No products match your search.</p>';
    return send(res, 200, page('Shop', `<h1>Shop</h1><form action="/"><label>Search <input name="q" value=""></label> <button>Search</button></form>${heading}<ul>${items}</ul>${empty}`, user));
  }

  if (p.startsWith('/product/') && req.method === 'GET') {
    const prod = products.find((x) => x.id === Number(p.split('/')[2]));
    if (!prod) return send(res, 404, page('Not found', '<h1>Product not found</h1>', user));
    const btn = prod.stock > 0
      ? `<form method="post" action="/cart/add"><input type="hidden" name="productId" value="${prod.id}"><button>Add to cart</button></form>`
      : '<p>Out of stock</p>';
    return send(res, 200, page(prod.name, `<h1>${prod.name}</h1><p class="price">${money(prod.price)}</p>${btn}<div id="reviews" data-product="${prod.id}"></div>`, user));
  }

  if (p === '/cart/add' && req.method === 'POST') {
    const body = await readBody(req);
    if (!user) return send(res, 302, '', 'text/plain', { Location: '/login?next=/cart' });
    const key = cartKey(user);
    const cart = carts.get(key) || [];
    const line = cart.find((i) => i.productId === Number(body.productId));
    if (line) line.qty += 1; else cart.push({ productId: Number(body.productId), qty: 1 });
    carts.set(key, cart);
    return send(res, 302, '', 'text/plain', { Location: '/cart' });
  }

  if (p === '/cart' && req.method === 'GET') {
    if (!user) return send(res, 302, '', 'text/plain', { Location: '/login?next=/cart' });
    const cart = carts.get(cartKey(user)) || [];
    const rows = cart.map((i) => {
      const prod = products.find((x) => x.id === i.productId);
      return `<tr><td>${prod.name}</td><td><form method="post" action="/cart/update" class="qty"><input type="hidden" name="productId" value="${prod.id}"><input aria-label="Quantity for ${prod.name}" name="qty" type="number" value="${i.qty}"><button>Update</button></form></td><td>${money(prod.price * i.qty)}</td><td><form method="post" action="/cart/remove"><input type="hidden" name="productId" value="${prod.id}"><button>Remove</button></form></td></tr>`;
    }).join('');
    const total = cart.reduce((s, i) => s + products.find((x) => x.id === i.productId).price * i.qty, 0);
    // BUG(empty-cart): an empty cart renders "undefined" instead of a friendly message.
    const message = cart.length ? '' : `<p class="cart-message">${cart.message}</p>`;
    const table = cart.length ? `<table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '';
    return send(res, 200, page('Cart', `<h1>Your cart</h1>${message}${table}<p class="total">Total: ${money(total)}</p><div class="checkout-bar"><a class="button" href="/checkout">Checkout</a></div>`, user));
  }

  if (p === '/cart/update' && req.method === 'POST') {
    if (!user) return send(res, 302, '', 'text/plain', { Location: '/login' });
    const body = await readBody(req);
    const cart = carts.get(cartKey(user)) || [];
    const line = cart.find((i) => i.productId === Number(body.productId));
    // BUG(negative-qty): no validation; negative quantities make the total negative.
    if (line) line.qty = parseInt(body.qty, 10);
    return send(res, 302, '', 'text/plain', { Location: '/cart' });
  }

  if (p === '/cart/remove' && req.method === 'POST') {
    if (!user) return send(res, 302, '', 'text/plain', { Location: '/login' });
    const body = await readBody(req);
    const key = cartKey(user);
    carts.set(key, (carts.get(key) || []).filter((i) => i.productId !== Number(body.productId)));
    return send(res, 302, '', 'text/plain', { Location: '/cart' });
  }

  if (p === '/checkout' && req.method === 'GET') {
    if (!user) return send(res, 302, '', 'text/plain', { Location: '/login?next=/checkout' });
    const cart = carts.get(cartKey(user)) || [];
    if (!cart.length) return send(res, 200, page('Checkout', '<h1>Checkout</h1><p>Your cart is empty. <a href="/">Continue shopping</a></p>', user));
    const total = cart.reduce((s, i) => s + products.find((x) => x.id === i.productId).price * i.qty, 0);
    return send(res, 200, page('Checkout', `<h1>Checkout</h1><p>Total: ${money(total)}</p><form method="post" action="/checkout"><label>Ship to <input name="shipTo" value="${user.address || ''}" required></label><button class="pay">Place order (test mode)</button></form>`, user));
  }

  if (p === '/checkout' && req.method === 'POST') {
    if (!user) return send(res, 302, '', 'text/plain', { Location: '/login' });
    const body = await readBody(req);
    const cart = carts.get(cartKey(user)) || [];
    if (!cart.length) return send(res, 302, '', 'text/plain', { Location: '/cart' });
    const total = cart.reduce((s, i) => s + products.find((x) => x.id === i.productId).price * i.qty, 0);
    const order = { id: 100 + orders.length + 1, userId: user.id, items: cart, total, shipTo: body.shipTo || '' };
    orders.push(order);
    carts.set(cartKey(user), []);
    return send(res, 200, page('Thank you', `<h1>Thank you!</h1><p>Order #${order.id} is confirmed. Total ${money(total)}.</p><p><a href="/orders">Your orders</a></p>`, user));
  }

  if (p === '/orders' && req.method === 'GET') {
    if (!user) return send(res, 302, '', 'text/plain', { Location: '/login?next=/orders' });
    const mine = orders.filter((o) => o.userId === user.id);
    const list = mine.map((o) => `<li><a href="/orders/${o.id}">Order #${o.id}</a> · ${money(o.total)}</li>`).join('') || '<li>No orders yet.</li>';
    return send(res, 200, page('Orders', `<h1>Your orders</h1><ul>${list}</ul>`, user));
  }

  if (p.startsWith('/orders/') && req.method === 'GET') {
    if (!user) return send(res, 302, '', 'text/plain', { Location: '/login' });
    const order = orders.find((o) => o.id === Number(p.split('/')[2]));
    if (!order || order.userId !== user.id) return send(res, 404, page('Not found', '<h1>Order not found</h1>', user));
    return send(res, 200, page('Order', `<h1>Order #${order.id}</h1><p>Ship to: ${order.shipTo}</p><p>Total: ${money(order.total)}</p>`, user));
  }

  if (p.startsWith('/api/orders/') && req.method === 'GET') {
    if (!user) return json(res, 401, { error: 'Sign in required' });
    const order = orders.find((o) => o.id === Number(p.split('/')[3]));
    // BUG(idor): no ownership check on the API, so any signed-in user can read any order.
    if (!order) return json(res, 404, { error: 'Not found' });
    return json(res, 200, order);
  }

  if (p === '/api/products' && req.method === 'GET') {
    return json(res, 200, products);
  }

  if (p === '/login' && req.method === 'GET') {
    const next = u.query.next || '/';
    return send(res, 200, page('Sign in', `<h1>Sign in</h1><form method="post" action="/login"><input type="hidden" name="next" value="${next}"><label>Email <input name="email" type="email"></label><label>Password <input name="password" type="password"></label><button>Sign in</button></form><p><a href="/reset">Forgot password?</a></p>`, null));
  }

  if (p === '/login' && req.method === 'POST') {
    const body = await readBody(req);
    const found = users.find((x) => x.email === String(body.email || '').trim().toLowerCase());
    if (!found) return send(res, 200, page('Sign in', '<h1>Sign in</h1><p class="error">Incorrect email or password</p><p><a href="/login">Try again</a></p>', null));
    // BUG(wrong-password-500): a wrong password for a real account crashes instead of showing the message.
    if (found.password !== hash(body.password)) {
      throw new TypeError('user.compare is not a function');
    }
    const token = crypto.randomBytes(16).toString('hex');
    sessions.set(token, found.id);
    return send(res, 302, '', 'text/plain', { Location: body.next || '/', 'Set-Cookie': `sid=${token}; Path=/; HttpOnly; SameSite=Lax` });
  }

  if (p === '/logout' && req.method === 'POST') {
    return send(res, 302, '', 'text/plain', { Location: '/', 'Set-Cookie': 'sid=; Path=/; Max-Age=0' });
  }

  if (p === '/signup' && req.method === 'GET') {
    return send(res, 200, page('Sign up', '<h1>Create an account</h1><form method="post" action="/signup"><label>Name <input name="name"></label><label>Email <input name="email"></label><label>Password <input name="password" type="password"></label><button>Create account</button></form>', null));
  }

  if (p === '/signup' && req.method === 'POST') {
    const body = await readBody(req);
    // BUG(signup-empty-email): no validation; an empty or malformed email creates an account.
    if (String(body.password || '').length < 8) return send(res, 200, page('Sign up', '<h1>Create an account</h1><p class="error">Password must be at least 8 characters</p><p><a href="/signup">Back</a></p>', null));
    const nu = { id: users.length + 1, email: String(body.email || '').trim().toLowerCase(), name: body.name || '', password: hash(body.password), role: 'customer', address: '' };
    users.push(nu);
    const token = crypto.randomBytes(16).toString('hex');
    sessions.set(token, nu.id);
    return send(res, 302, '', 'text/plain', { Location: '/account', 'Set-Cookie': `sid=${token}; Path=/; HttpOnly; SameSite=Lax` });
  }

  if (p === '/account' && req.method === 'GET') {
    if (!user) return send(res, 302, '', 'text/plain', { Location: '/login?next=/account' });
    const saved = u.query.saved ? '<p class="toast" role="status">Address saved</p>' : '';
    return send(res, 200, page('Account', `<h1>Hi ${user.name || 'there'}</h1>${saved}<form method="post" action="/account/address"><label>Shipping address <input name="address" value="${user.address}"></label><button>Save address</button></form>`, user));
  }

  if (p === '/account/address' && req.method === 'POST') {
    if (!user) return send(res, 302, '', 'text/plain', { Location: '/login' });
    await readBody(req);
    // BUG(address-not-saved): shows "Address saved" but never stores it.
    return send(res, 302, '', 'text/plain', { Location: '/account?saved=1' });
  }

  if (p === '/admin' && req.method === 'GET') {
    // BUG(admin-open): the admin page is only hidden from the nav; any signed-in user can open it.
    if (!user) return send(res, 302, '', 'text/plain', { Location: '/login?next=/admin' });
    const rows = users.map((x) => `<tr><td>${x.id}</td><td>${x.email}</td><td>${x.role}</td></tr>`).join('');
    return send(res, 200, page('Admin', `<h1>Admin</h1><table><tr><th>ID</th><th>Email</th><th>Role</th></tr>${rows}</table>`, user));
  }

  if (p === '/pricing' && req.method === 'GET') {
    // BUG(pricing-typo): "Recieve" in the shop's own copy.
    return send(res, 200, page('Pricing', '<h1>Pricing</h1><p>Shipping is free on orders over $50. Recieve your order in 3–5 working days.</p>', user));
  }

  if (p === '/privacy' && req.method === 'GET') {
    return send(res, 200, page('Privacy', '<h1>Privacy</h1><p>We only use your data to process your orders.</p>', user));
  }

  if (p === '/reset' && req.method === 'GET') {
    return send(res, 200, page('Reset password', '<h1>Reset your password</h1><form method="post" action="/reset"><label>Email <input name="email" type="email"></label><button>Send reset link</button></form>', user));
  }

  if (p === '/reset' && req.method === 'POST') {
    await readBody(req);
    return send(res, 200, page('Reset password', '<h1>Check your email</h1><p>If that email has an account, we sent a reset link.</p>', user));
  }

  // BUG(terms-404): the footer links to /terms, which doesn't exist.
  return send(res, 404, page('Not found', '<h1>Page not found</h1><p><a href="/">Back to the shop</a></p>', user));
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('Unhandled error:', err.stack || err.message);
    send(res, 500, '<!doctype html><title>500</title><h1>500 Internal Server Error</h1>', 'text/html');
  });
});
server.listen(PORT, () => console.log(`Corner Shop ready on http://localhost:${PORT}`));
