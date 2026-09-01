import readline from 'node:readline';

const origin = process.argv[2];
if (!origin) throw new Error('Usage: node tools/remote-smoke.mjs <origin>');

const input = readline.createInterface({ input: process.stdin, terminal: false });
const password = await new Promise((resolve) => {
  input.once('line', (line) => {
    input.close();
    resolve(line);
  });
});

const login = await fetch(`${origin}/yc.php/login`, {
  method: 'POST',
  body: new URLSearchParams({ username: 'admin', password }),
  redirect: 'manual',
});
if (login.status !== 303) throw new Error(`Login returned ${login.status}`);
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
if (!cookie) throw new Error('Login did not return a session cookie');

const dashboard = await fetch(`${origin}/yc.php`, { headers: { Cookie: cookie } });
const dashboardHtml = await dashboard.text();
const csrf = dashboardHtml.match(/name="csrf" value="([^"]+)"/)?.[1];
if (!dashboard.ok || !csrf || !dashboardHtml.includes('产品管理')) {
  throw new Error('Admin dashboard validation failed');
}

const title = `Deployment verification ${Date.now()}`;
let productId = 0;

try {
  const save = await fetch(`${origin}/yc.php/products/save`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: new URLSearchParams({
      csrf,
      category_id: '4',
      title,
      price: '1.23',
      status: '1',
    }),
    redirect: 'manual',
  });
  productId = Number(new URL(save.headers.get('location') || '/', origin).searchParams.get('id'));
  if (save.status !== 303 || !productId) throw new Error(`Product save returned ${save.status}`);

  const edit = await fetch(`${origin}/yc.php/products/${productId}/edit`, { headers: { Cookie: cookie } });
  const editHtml = await edit.text();
  if (!edit.ok || !editHtml.includes(title)) throw new Error('Created product could not be reopened');
} finally {
  if (productId) {
    const remove = await fetch(`${origin}/yc.php/products/${productId}/delete`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: new URLSearchParams({ csrf }),
      redirect: 'manual',
    });
    if (remove.status !== 303) throw new Error(`Product cleanup returned ${remove.status}`);
  }
}

process.stdout.write(`${JSON.stringify({ login: login.status, dashboard: dashboard.status, productWorkflow: true })}\n`);
