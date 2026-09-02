const PLACEHOLDER = "/placeholder.svg";
const DEFAULT_CNY_PER_USD = 7.2;

export function formatUsdFromCny(value, settings = {}) {
  const configuredRate = Number.parseFloat(String(settings.cny_per_usd || ""));
  const rate = Number.isFinite(configuredRate) && configuredRate > 0 ? configuredRate : DEFAULT_CNY_PER_USD;
  return (Math.max(0, Number(value) || 0) / rate).toFixed(2);
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function safeUrl(value, fallback = "#") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw.replace(/[\"'<>`]/g, "");
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return fallback;
  }
  return fallback;
}

export function productUrl(product) {
  const slug = String(product.category_slug || "AllProducts").replace(/[^a-z0-9-]/gi, "") || "AllProducts";
  return `/${slug}/${Number(product.id)}.html`;
}

function head({ title, description, canonical, css = "home", image = "", type = "website" }, settings) {
  const siteName = "CnBuyCha";
  const pageTitle = title ? `${title} | ${siteName}` : `China Shopping Spreadsheet 2026: W2C & QC Finds | ${siteName}`;
  const summary = description || settings.web_description || "China shopping spreadsheet finds";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(summary)}">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#0a192f">
  <link rel="canonical" href="${escapeHtml(canonical || "/")}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(summary)}">
  <meta property="og:type" content="${escapeHtml(type)}">
  <meta property="og:site_name" content="CnBuyCha">
  <meta property="og:url" content="${escapeHtml(canonical || "/")}">
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="/template/moban/pc/static/css/header.css?v=5">
  <link rel="stylesheet" href="/template/moban/pc/static/css/${css}.css?v=5">
  <link rel="stylesheet" href="/site.css?v=5">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>`;
}

function header(settings) {
  const first = settings.brand_first || "Cnbuy";
  const second = settings.brand_second || "Sheet";
  return `<header>
  <nav class="glass-nav" aria-label="Main navigation">
    <a href="/" class="logo-link"><div class="logo">${escapeHtml(first)}<span class="highlight">${escapeHtml(second)}</span></div></a>
    <button class="menu-toggle" type="button" aria-label="Toggle navigation"><i class="fas fa-bars"></i></button>
    <ul class="nav-links"><div class="nav-links-inner">
      <li><a href="/"><span class="link-text">Home</span></a></li>
      <li><a href="/AllProducts/"><span class="link-text">All Products</span></a></li>
      <li><a href="/#agents"><span class="link-text">Agents</span></a></li>
      <li><a href="/#about"><span class="link-text">About</span></a></li>
      <li class="login-item"><a href="/yc.php" class="login-button"><span class="link-text">Admin</span></a></li>
    </div></ul>
  </nav>
</header>
<div class="floating-buttons">
  <div class="floating-btn-wrapper">
    <a href="${escapeHtml(safeUrl(settings.contact_url, "#"))}" target="_blank" rel="nofollow noopener noreferrer" class="floating-btn telegram" aria-label="Contact us"><i class="fab fa-whatsapp"></i></a>
    <span class="floating-btn-label">Contact us</span>
  </div>
</div>`;
}

function footer(settings) {
  return `<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-brand">${escapeHtml(settings.brand_first || "Cnbuy")}<span>${escapeHtml(settings.brand_second || "Sheet")}</span></div>
    <p>China shopping spreadsheet finds for global buyers.</p>
    <nav class="breadcrumb" aria-label="Shopping guides"><a href="/w2c-spreadsheet/">W2C Spreadsheet</a> · <a href="/qc-photos/">QC Photos</a> · <a href="/weidian-spreadsheet/">Weidian</a> · <a href="/taobao-spreadsheet/">Taobao</a> · <a href="/reps-glossary/">Shopping Terms</a></nav>
    <p class="copyright">© ${new Date().getUTCFullYear()} CnBuyCha</p>
  </div>
</footer>
<script src="/app.js?v=7" defer></script>
</body></html>`;
}

const categoryIcons = {
  shoes: "fa-shoe-prints",
  "hoodies-sweaters": "fa-mitten",
  "t-shirts": "fa-shirt",
  jackets: "fa-vest",
  "pants-shorts": "fa-grip-lines-vertical",
  headwear: "fa-hat-cowboy",
  accessories: "fa-gem",
  jersey: "fa-person-running",
  electronics: "fa-laptop",
  "other-stuff": "fa-ellipsis",
  "short-sets": "fa-layer-group",
};

function productCard(product, settings, className = "product-card glass-card") {
  const url = productUrl(product);
  const image = safeUrl(product.main_image, PLACEHOLDER);
  return `<article class="${className}">
    <a href="${url}" class="product-image"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.title)}" width="600" height="600" loading="lazy" decoding="async"></a>
    <div class="product-info">
      <a href="${url}" class="product-title"><h3>${escapeHtml(product.title)}</h3></a>
      <div class="product-meta">
        <div class="product-price" data-currency="USD" title="Converted from CNY">${formatUsdFromCny(product.price, settings)}</div>
        <div class="product-views"><i class="fas fa-eye"></i><span>${Number(product.views || 0)}</span></div>
      </div>
      <a href="${url}" class="add-to-cart-btn">Check the details</a>
    </div>
  </article>`;
}

export function renderHome({ settings, categories, products, origin }) {
  const categoryCards = categories.filter((category) => category.parent_id === 1 || category.id > 3).map((category) => {
    const icon = categoryIcons[category.slug] || "fa-tags";
    return `<a href="/${escapeHtml(category.slug)}/" class="category-item glass-card">
      <div class="category-icon"><i class="fas ${icon}"></i></div>
      <h3>${escapeHtml(category.name)}</h3>
      <span class="category-count">${Number(category.product_count || 0)} finds</span>
    </a>`;
  }).join("");
  return `${head({
    title: "China Shopping Spreadsheet 2026: W2C & QC Finds",
    description: "Browse thousands of China shopping finds with product photos, source prices, Weidian links and purchase options for leading shopping agents.",
    canonical: `${origin}/`,
  }, settings)}
<body><div id="particles-js"></div>${header(settings)}
<main>
  <section id="home" class="hero">
    <div class="hero-content">
      <span class="subheading">cnbuyshop</span>
      <h1>The best <span class="highlight">China shopping</span> spreadsheet</h1>
      <p>Spreadsheets turned into web pages help you buy faster and smarter from a variety of platforms.</p>
      <div class="button-container"><a href="/AllProducts/" class="glow-button"><span class="btn-icon"><i class="fas fa-shopping-cart"></i></span><span class="btn-text">Shop Now</span></a></div>
    </div>
    <div class="hero-decoration"><div class="floating-shape shape1"></div><div class="floating-shape shape2"></div><div class="floating-shape shape3"></div></div>
  </section>
  <section id="categories" class="categories"><div class="container"><div class="category-grid">${categoryCards}</div></div></section>
  <section id="featured-products" class="featured-products"><div class="container">
    <div class="section-header"><span class="section-tag">Latest</span><h2>Latest Products</h2><p>Latest collection of products</p></div>
    <div class="product-carousel-container"><button class="carousel-arrow carousel-prev" aria-label="Previous"><i class="fas fa-chevron-left"></i></button><div class="products-carousel"><div class="carousel-track">${products.map((product) => productCard(product, settings)).join("")}</div></div><button class="carousel-arrow carousel-next" aria-label="Next"><i class="fas fa-chevron-right"></i></button></div>
    <div class="view-all-container"><a href="/AllProducts/" class="view-all-btn">View All Products <i class="fas fa-arrow-right"></i></a></div>
  </div></section>
  <section id="tutorial" class="tutorial-module"><div class="container"><div class="section-header"><span class="section-tag">Auto Purchase Tool</span><h2>How to bypass “Non-purchasable item” warnings automatically</h2></div><div class="glass-tutorial-container"><div class="tutorial-buttons"><a href="/video" class="tutorial-btn primary-btn"><span class="btn-icon"><i class="fas fa-play-circle"></i></span><span class="btn-text">Watch Tutorial</span></a><a href="https://chromewebstore.google.com/detail/risk-reminder-remover/afgegfoedkeffjkkkjkbpnegceleakeo" class="tutorial-btn secondary-btn" rel="noopener noreferrer"><span class="btn-icon"><i class="fab fa-chrome"></i></span><span class="btn-text">Download Extension</span></a></div></div></div></section>
  <section id="about" class="about"><div class="container"><div class="section-header"><span class="section-tag">About Us</span></div><div class="about-container"><div class="about-content glass-card"><h3>Why choose cnbuyshop.com</h3><p>cnbuyshop provides Chinese product spreadsheet links for global buyers. Browse products from multiple Chinese purchasing platforms in one fast, searchable site.</p><div class="stats-container"><div class="stat-item"><span class="stat-number">${products.length ? "3K+" : "0"}</span><span class="stat-text">Products</span></div><div class="stat-item"><span class="stat-number">10+</span><span class="stat-text">Categories</span></div><div class="stat-item"><span class="stat-number">20+</span><span class="stat-text">Agents</span></div></div></div></div></div></section>
  <section id="agents" class="services"><div class="container"><div class="section-header"><span class="section-tag">Agent</span><h2>What agent platforms do we support?</h2><p>Compatible with major overseas shopping platforms.</p></div><div class="platform-showcase glass-card"><div class="platform-grid">${["Kakobuy", "CNFans", "Oopbuy", "Mulebuy", "Superbuy", "Sugargoo", "AllChinaBuy", "LoveGoBuy", "Hoobuy", "OrientDig"].map((name) => `<span class="platform-item">${name}</span>`).join("")}</div></div></div></section>
</main>${footer(settings)}`;
}

function pagination({ page, pages, baseUrl, query, sort }) {
  if (pages <= 1) return "";
  const values = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pages, page + 2);
  for (let value = start; value <= end; value += 1) values.push(value);
  const link = (value, label = String(value)) => {
    const params = new URLSearchParams();
    if (value > 1) params.set("page", String(value));
    if (query) params.set("q", query);
    if (sort && sort !== "new") params.set("sort", sort);
    const suffix = params.toString() ? `?${params}` : "";
    return `<a class="page-link${value === page ? " active" : ""}" href="${baseUrl}${suffix}">${label}</a>`;
  };
  return `<nav class="pagination" aria-label="Product pages">${page > 1 ? link(page - 1, "‹") : ""}${values.map((value) => link(value)).join("")}${page < pages ? link(page + 1, "›") : ""}</nav>`;
}

export function renderProductList({ settings, categories, currentCategory, products, total, page, pageSize, query, sort, origin, pathname }) {
  const title = currentCategory?.name || (query ? `Search: ${query}` : "All Products");
  const seoTitle = query ? `Search results for ${query}` : currentCategory ? `${currentCategory.name} W2C Spreadsheet` : "China Shopping Spreadsheet – All Products";
  const description = currentCategory?.seo_description || `Browse ${total} China shopping spreadsheet finds with product photos, source prices and direct seller links.`;
  const baseUrl = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const categoryButtons = [`<a class="filter-btn${!currentCategory ? " active" : ""}" href="/AllProducts/"><span class="btn-text">ALL</span></a>`]
    .concat(categories.filter((item) => item.id > 3).map((item) => `<a class="filter-btn${currentCategory?.id === item.id ? " active" : ""}" href="/${escapeHtml(item.slug)}/"><span class="btn-text">${escapeHtml(item.name)}</span></a>`)).join("");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const sortLink = (value, icon, label) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (value !== "new") params.set("sort", value);
    return `<a class="sort-btn${sort === value ? " active" : ""}" href="${baseUrl}${params.toString() ? `?${params}` : ""}"><i class="fas ${icon}"></i><span class="btn-text">${label}</span></a>`;
  };
  return `${head({ title: seoTitle, description, canonical: `${origin}${pathname}`, css: "list" }, settings)}
<body><div id="particles-js"></div>${header(settings)}
<main>
  <div class="page-header"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>
  <section class="list-container">
    <div class="filter-bar"><div class="filter-section"><div class="filter-options">${categoryButtons}</div><div class="filter-actions"><div class="sort-options">${sortLink("new", "fa-clock", "Latest")}${sortLink("click", "fa-fire", "Popular")}${sortLink("price", "fa-sort-amount-up", "Price")}</div><form class="search-bar" action="/AllProducts/" method="get"><i class="fas fa-search search-icon"></i><input type="search" name="q" value="${escapeHtml(query)}" placeholder="Search products…"><button type="submit" class="search-btn"><i class="fas fa-arrow-right"></i></button></form></div></div></div>
    <div class="results-summary">${Number(total).toLocaleString("en-US")} products</div>
    <div class="product-grid">${products.length ? products.map((product) => productCard(product, settings)).join("") : `<div class="empty-state"><h2>No products found</h2><p>Try another search or category.</p></div>`}</div>
    ${pagination({ page, pages, baseUrl, query, sort })}
  </section>
</main>${footer(settings)}`;
}

function purchasePlatforms(sourceId) {
  const id = encodeURIComponent(sourceId || "");
  const weidian = encodeURIComponent(`https://weidian.com/item.html?itemID=${sourceId || ""}`);
  return [
    ["Litbuy", "/template/moban/pc/static/images/litbuy.webp", `https://litbuy.com/product/weidian/${id}?inviteCode=787S6YCQZ`],
    ["USFans", "/template/moban/pc/static/images/usfans.webp", `https://www.usfans.com/product/3/${id}?ref=SWD92F`],
    ["Mulebuy", "/template/moban/pc/static/images/mulebuy.webp", `https://mulebuy.com/zh/product/?shop_type=weidian&id=${id}&ref=200232406`],
    ["Hoobuy", "/template/moban/pc/static/images/hoobuy.webp", `https://hoobuy.com/product/2/${id}?inviteCode=vXpLpmrX`],
    ["Oopbuy", "/template/moban/pc/static/images/oopbuy.webp", `https://oopbuy.com/product/weidian/${id}?inviteCode=U68CWQBN5`],
    ["AllChinaBuy", "/template/moban/pc/static/images/allchinabuy.webp", `https://www.allchinabuy.com/en/page/buy/?url=${weidian}&partnercode=wbVgOT`],
    ["Kakobuy", "/template/moban/pc/static/images/kakobuy.webp", `https://kakobuy.com/item/details?url=${weidian}&affcode=rf8x8`],
    ["OOTDBuy", "/template/moban/pc/static/images/ootdbuy.png", `https://www.ootdbuy.com/goods/details?id=${id}&channel=weidian&inviteCode=179LQ1SVA`],
    ["OrientDig", "/template/moban/pc/static/images/orientdig.webp", `https://orientdig.com/product/?shop_type=weidian&id=${id}&ref=100114240`],
    ["Superbuy", "/template/moban/pc/static/images/superbuy.webp", `https://www.superbuy.com/en/page/buy/?url=${weidian}&partnercode=ES7pVI`],
    ["Sugargoo", "/template/moban/pc/static/images/sugargoo.webp", `https://www.sugargoo.com/#/home/productDetail?productLink=${weidian}&memberId=1771881989097259278`],
    ["LoveGoBuy", "/template/moban/pc/static/images/lovegobuy.webp", `https://www.lovegobuy.com/product?id=${id}&shop_type=weidian&invite_code=161CPG`],
  ];
}

export function renderProductDetail({ settings, product, related, origin }) {
  const canonical = `${origin}${productUrl(product)}`;
  const gallery = [product.main_image, ...product.images.map((image) => image.url)]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
  if (!gallery.length) gallery.push(PLACEHOLDER);
  const hasMultipleImages = gallery.length > 1;
  const gallerySlides = gallery.map((image, index) => `<div class="gallery-slide" data-gallery-slide role="group" aria-label="${index + 1} of ${gallery.length}"><img${index === 0 ? " id=\"mainProductImage\"" : ""} itemprop="image" src="${escapeHtml(safeUrl(image, PLACEHOLDER))}" alt="${escapeHtml(product.title)} ${index + 1}" draggable="false" ${index === 0 ? "fetchpriority=\"high\"" : "loading=\"lazy\""} decoding="async"></div>`).join("");
  const galleryThumbnails = gallery.map((image, index) => `<button class="thumbnail${index === 0 ? " active" : ""}" type="button" data-gallery-index="${index}" aria-label="Show product image ${index + 1}" aria-current="${index === 0 ? "true" : "false"}"><img src="${escapeHtml(safeUrl(image, PLACEHOLDER))}" alt="" loading="lazy" decoding="async"></button>`).join("");
  const platforms = purchasePlatforms(product.source_id);
  const sourceUrl = safeUrl(product.source_url || `https://weidian.com/item.html?itemID=${encodeURIComponent(product.source_id || "")}`);
  const usdPrice = formatUsdFromCny(product.price, settings);
  const description = product.seo_description || `View ${product.title} photos, source price, Weidian link and purchase options. Browse more ${product.category_name || "China shopping"} finds on CnBuyCha.`;
  return `${head({ title: product.seo_title || `${product.title} – W2C Link & Photos`, description, canonical, css: "detail", image: safeUrl(gallery[0], ""), type: "product" }, settings)}
<body><div id="particles-js"></div>${header(settings)}
<main class="detail-container">
  <div class="breadcrumb" itemscope itemtype="https://schema.org/BreadcrumbList"><span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a itemprop="item" href="/"><span itemprop="name">Home</span></a><meta itemprop="position" content="1"></span> / <span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><a itemprop="item" href="/${escapeHtml(product.category_slug)}/"><span itemprop="name">${escapeHtml(product.category_name)}</span></a><meta itemprop="position" content="2"></span> / <span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span itemprop="name">${escapeHtml(product.title)}</span><meta itemprop="position" content="3"></span></div>
  <section class="product-detail" itemscope itemtype="https://schema.org/Product">
    <link itemprop="url" href="${escapeHtml(canonical)}">
    <meta itemprop="sku" content="${escapeHtml(product.source_id || String(product.id))}">
    <meta itemprop="description" content="${escapeHtml(description)}">
    <div class="product-gallery" data-product-gallery>
      <div class="main-image gallery-viewport" data-gallery-viewport tabindex="0" role="region" aria-roledescription="carousel" aria-label="Product image gallery">
        <div class="gallery-track" data-gallery-track>${gallerySlides}</div>
        ${hasMultipleImages ? `<button class="gallery-nav gallery-prev" type="button" data-gallery-prev aria-label="Previous product image"><i class="fas fa-chevron-left" aria-hidden="true"></i></button><button class="gallery-nav gallery-next" type="button" data-gallery-next aria-label="Next product image"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>` : ""}
        <div class="gallery-counter" aria-live="polite"><span data-gallery-current>1</span><span aria-hidden="true"> / </span>${gallery.length}</div>
        ${hasMultipleImages ? `<div class="gallery-swipe-hint" aria-hidden="true"><i class="fas fa-arrows-left-right"></i><span>Swipe or drag</span></div>` : ""}
      </div>
      <div class="thumbnail-container" data-gallery-thumbnails aria-label="Product image thumbnails">${galleryThumbnails}</div>
    </div>
    <div class="product-info"><h1 class="product-title" itemprop="name">${escapeHtml(product.title)}</h1><div class="product-id">ID: ${escapeHtml(product.source_id)}</div><div class="product-meta"><div class="product-price" data-currency="USD" title="Converted from CNY" itemprop="offers" itemscope itemtype="https://schema.org/Offer"><link itemprop="url" href="${escapeHtml(canonical)}"><meta itemprop="priceCurrency" content="USD"><meta itemprop="price" content="${usdPrice}"><link itemprop="availability" href="https://schema.org/InStock">${usdPrice}</div><div class="product-views"><i class="fas fa-eye"></i><span>${Number(product.views || 0)}</span></div></div>
      <div class="product-actions"><button class="action-btn buy-now-btn" type="button" data-open-platforms><i class="fas fa-shopping-cart"></i> Buy Link</button><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="nofollow noopener noreferrer" class="action-btn weidian-btn"><i class="fas fa-store"></i> Weidian Link</a><div class="actions-row"><button class="action-btn copy-link-btn" type="button" data-copy-url="${escapeHtml(canonical)}"><i class="fas fa-share-alt"></i> Share</button></div></div>
      <div class="product-info-section"><div class="product-description">How to bypass “Non-purchasable item” warnings automatically!</div><a href="/video" class="action-btn how-to-buy-btn"><i class="fas fa-question-circle"></i> Tutorial</a></div>
    </div>
  </section>
  ${product.description ? `<section class="product-copy glass-card"><h2>Product information</h2><p>${escapeHtml(product.description).replaceAll("\n", "<br>")}</p></section>` : ""}
  <section class="product-list"><h2 class="section-title">Related Products</h2><div class="product-grid">${related.map((item) => productCard(item, settings)).join("")}</div></section>
</main>
<div class="platform-modal" id="platformModal" hidden><div class="platform-modal-content"><button class="close-modal" type="button" data-close-modal>&times;</button><h3>Select Purchase Platform</h3><p class="modal-note">Choose an agent to open its purchase page.</p><div class="platform-list">${platforms.map(([name, image, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="nofollow noopener noreferrer" class="platform-option"><img src="${image}" alt=""><span>${name}</span></a>`).join("")}</div></div></div>
<div class="copy-success" id="copySuccess"><i class="fas fa-check-circle"></i> Link copied</div>
${footer(settings)}`;
}

export const SEO_GUIDES = {
  "/w2c-spreadsheet/": {
    title: "W2C Spreadsheet 2026: Product Links, Photos & Finds",
    heading: "W2C Spreadsheet for China Shopping Finds",
    description: "Use a searchable W2C spreadsheet with product photos, source prices, Weidian links and category filters for faster China shopping research.",
    intro: "W2C means where to cop: where a product can be found and which source link opens the original listing. CnBuyCha turns spreadsheet-style product research into searchable web pages so you can compare images, prices and categories before choosing a shopping agent.",
    sections: [
      ["What a useful W2C entry includes", "A useful entry should identify the product, show clear source images, display the original CNY price, provide a stable seller link and keep the product in the correct category. Those fields make it easier to compare finds without opening dozens of unrelated tabs."],
      ["How to use the spreadsheet", "Start with a category such as shoes, hoodies, jackets or accessories. Open the product page to review every available image, then use the Weidian link to check the source listing. When you are ready, the purchase button lets you choose from supported shopping agents."],
      ["Check before ordering", "Seller stock, colors, sizes and prices can change. Treat the spreadsheet as a discovery tool and confirm the current listing inside your selected agent before payment. Review warehouse photos when they become available and compare them with the seller images."],
    ],
  },
  "/rep-spreadsheet/": {
    title: "Rep Spreadsheet 2026: Product Finds & Source Links",
    heading: "Rep Spreadsheet with Searchable Product Finds",
    description: "Browse spreadsheet-style product finds with images, source prices, categories and direct seller links in one searchable catalog.",
    intro: "A rep spreadsheet is most useful when it helps shoppers verify a product rather than presenting a long list of unexplained links. CnBuyCha organizes finds by category and gives each item its own page with images, a source ID, pricing information and agent purchase options.",
    sections: [
      ["Search by product type", "Use category pages to narrow the catalog before opening individual products. This reduces duplicate searching and makes it easier to compare similar shoes, clothing, accessories and other finds."],
      ["Verify the source", "Open the original seller link and confirm that the listing still matches the title and images shown here. Product availability and seller terms are controlled by the source marketplace and can change after a spreadsheet entry is published."],
      ["Use photos as evidence", "Compare seller images with later warehouse QC photos whenever possible. Look at shape, materials, stitching, labels, measurements and visible defects instead of relying only on a product title."],
    ],
  },
  "/qc-photos/": {
    title: "QC Photos Guide: How to Check Product Images",
    heading: "How to Check QC Photos Before Shipping",
    description: "Learn how to review QC photos for shape, stitching, labels, color, measurements and visible defects before shipping a purchase.",
    intro: "QC photos are warehouse images taken after an item arrives from the seller. They help you decide whether the received item broadly matches the listing before it is packed for international shipping.",
    sections: [
      ["Start with the full shape", "Check the front, back and side profile first. Compare the overall proportions, symmetry and color with the seller images. Lighting can alter color, so use several photos rather than judging from one frame."],
      ["Inspect construction details", "Zoom in on seams, stitching, print alignment, hardware, soles, labels and edges. Look for stains, glue marks, loose threads, dents or damage that could affect use."],
      ["Confirm measurements", "For clothing and shoes, request or review measurement photos when sizing matters. Compare those measurements with an item you already own; size labels alone are not a reliable international standard."],
      ["Make a practical decision", "Separate cosmetic differences from functional problems. If an important detail is unclear, request an additional photo through the shopping agent before accepting or returning the item."],
    ],
  },
  "/weidian-spreadsheet/": {
    title: "Weidian Spreadsheet 2026: Product Links & Finds",
    heading: "Weidian Spreadsheet and Product Link Guide",
    description: "Browse Weidian product finds with source IDs, images, prices and purchase links for supported China shopping agents.",
    intro: "Weidian listings are commonly identified by an item ID inside the seller URL. CnBuyCha keeps that source ID with each product so the same listing can be opened directly or transferred to a supported shopping agent.",
    sections: [
      ["Read the source link", "A Weidian product URL normally contains an itemID value. Confirm that the ID, product images and current listing title match before placing an order."],
      ["Why agent links are offered", "Many international shoppers use a purchasing agent to place the domestic order, receive the item at a warehouse and arrange international shipping. The product page lets you select an agent without changing the underlying source item ID."],
      ["Listings can change", "A seller may change stock, options, price or even remove a listing. Always verify the live source page and the final agent order summary rather than relying on an older spreadsheet snapshot."],
    ],
  },
  "/taobao-spreadsheet/": {
    title: "Taobao Spreadsheet 2026: China Shopping Finds",
    heading: "Taobao Spreadsheet for Searchable Finds",
    description: "Use category filters, product images and source information to research Taobao and China shopping finds before ordering through an agent.",
    intro: "A Taobao spreadsheet should make product discovery easier while keeping enough source information for verification. Search by category, compare product images and check the current marketplace listing before ordering.",
    sections: [
      ["Find the right category", "Begin with the product type instead of a broad keyword. Category pages make it easier to compare similar items and avoid unrelated results."],
      ["Compare listing details", "Check available variants, seller photos, domestic shipping terms and the current price on the source page. Translated titles may differ, so images and item identifiers are important verification signals."],
      ["Review the warehouse result", "After the seller ships to the agent warehouse, use QC photos and measurements to confirm the received item before international parcel submission."],
    ],
  },
  "/how-to-buy/": {
    title: "How to Buy from China: W2C & Shopping Agent Guide",
    heading: "How to Use China Shopping Links",
    description: "A practical guide to finding a product, checking the seller link, choosing an agent, reviewing QC photos and preparing international shipping.",
    intro: "The usual process has five stages: find a source listing, submit it to a shopping agent, wait for domestic delivery, review warehouse QC photos and then select an international shipping option.",
    sections: [
      ["1. Find and verify", "Open a product page, review its images and source price, then open the original listing. Confirm the product options and seller information before continuing."],
      ["2. Choose an agent", "Use the purchase platform selector to open the same source item with a supported agent. Review the agent order page carefully because service fees, payment options and supported routes vary."],
      ["3. Review warehouse photos", "When the item arrives at the warehouse, compare QC photos and measurements with the source listing. Request more evidence if an important detail is not visible."],
      ["4. Prepare the parcel", "Confirm weight, dimensions, packaging choices, route restrictions, declared value and estimated charges before submitting international shipping."],
    ],
  },
  "/reps-glossary/": {
    title: "W2C, QC, GP, GL & RL Meaning: Shopping Terms",
    heading: "W2C and QC Shopping Terms Explained",
    description: "Understand common spreadsheet terms including W2C, QC, GP, GL, RL, batch and haul before using China shopping links.",
    intro: "Spreadsheet communities use short terms to describe product discovery and quality checks. Understanding them makes product pages, warehouse photos and buying discussions easier to follow.",
    sections: [
      ["W2C", "Where to cop. This normally refers to the source link or seller listing for a product."],
      ["QC", "Quality check. In shopping-agent use, this usually means the warehouse photos reviewed before international shipping."],
      ["GP", "Guinea pig. A shopper who orders a less-tested listing first and shares the result may be described as GPing the item."],
      ["GL and RL", "Green light and red light. GL generally means the item is acceptable to the buyer; RL means the buyer wants to reject, return or exchange it."],
      ["Batch and haul", "Batch identifies a production version or source grouping. A haul is a group of purchased items shipped or presented together."],
    ],
  },
};

export function renderSeoGuide({ settings, guide, origin, pathname }) {
  const sections = guide.sections.map(([heading, body]) => `<section><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></section>`).join("");
  return `${head({ title: guide.title, description: guide.description, canonical: `${origin}${pathname}`, css: "list" }, settings)}
<body><div id="particles-js"></div>${header(settings)}
<main class="detail-container">
  <div class="breadcrumb"><a href="/">Home</a> / <span>${escapeHtml(guide.heading)}</span></div>
  <div class="page-header"><h1>${escapeHtml(guide.heading)}</h1><p>${escapeHtml(guide.description)}</p></div>
  <article class="product-copy glass-card"><p>${escapeHtml(guide.intro)}</p>${sections}<p><a href="/AllProducts/">Browse all product finds</a> or start with <a href="/shoes/">shoes</a>, <a href="/hoodies-sweaters/">hoodies and sweaters</a>, <a href="/jackets/">jackets</a> and <a href="/accessories/">accessories</a>.</p></article>
</main>${footer(settings)}`;
}

function adminLayout(title, body, { session, notice = "", error = "" } = {}) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - Cnbuycha 后台</title><link rel="stylesheet" href="/admin.css?v=3"></head><body class="admin-body">
  ${session ? `<header class="admin-header"><a href="/yc.php" class="admin-brand">Cnbuycha 后台</a><nav><a href="/yc.php">商品</a><a href="/yc.php/products/new">增加产品</a><a href="/" target="_blank">查看前台</a><form method="post" action="/yc.php/logout"><input type="hidden" name="csrf" value="${escapeHtml(session.csrf)}"><button type="submit" class="link-button">退出</button></form></nav></header>` : ""}
  <main class="admin-main">${notice ? `<div class="notice success">${escapeHtml(notice)}</div>` : ""}${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ""}${body}</main>
  <script src="/admin.js?v=3" defer></script></body></html>`;
}

export function renderLogin({ error = "", configured = true } = {}) {
  const content = `<section class="login-card"><div class="login-logo">Cnbuy<span>Sheet</span></div><h1>后台登录</h1><p>登录后可以增加、编辑和删除产品。</p>${!configured ? `<div class="notice error">后台密码尚未配置，请先在 Cloudflare 中设置密钥。</div>` : ""}<form method="post" action="/yc.php/login"><label>用户名<input name="username" autocomplete="username" required value="admin"></label><label>密码<input type="password" name="password" autocomplete="current-password" required></label><button class="primary-button" type="submit" ${configured ? "" : "disabled"}>登录</button></form><a class="back-link" href="/">← 返回前台</a></section>`;
  return adminLayout("登录", content, { error });
}

export function renderAdminProducts({ session, products, total, page, query, cnyPerUsd = 7.2, notice = "" }) {
  const rows = products.map((product) => `<tr><td><img class="admin-thumb" src="${escapeHtml(safeUrl(product.main_image, PLACEHOLDER))}" alt=""></td><td><strong>${escapeHtml(product.title)}</strong><small>ID ${Number(product.id)} · ${escapeHtml(product.source_id)}</small></td><td>${escapeHtml(product.category_name || "")}</td><td>¥${Number(product.price || 0).toFixed(2)}</td><td><span class="status ${product.status ? "live" : "hidden"}">${product.status ? "显示" : "隐藏"}</span></td><td class="row-actions"><a href="/yc.php/products/${Number(product.id)}/edit">编辑</a><form method="post" action="/yc.php/products/${Number(product.id)}/delete" data-confirm="确定删除这个产品吗？"><input type="hidden" name="csrf" value="${escapeHtml(session.csrf)}"><button type="submit" class="danger-link">删除</button></form></td></tr>`).join("");
  const body = `<div class="admin-title-row"><div><h1>产品管理</h1><p>共 ${Number(total).toLocaleString("zh-CN")} 个产品；后台价格均为人民币</p></div><a class="primary-button" href="/yc.php/products/new">＋ 增加产品</a></div><form class="currency-form" method="post" action="/yc.php/settings/currency"><input type="hidden" name="csrf" value="${escapeHtml(session.csrf)}"><label>前台美元换算汇率：1 USD = ¥ <input type="number" name="cny_per_usd" min="1" max="20" step="0.01" value="${escapeHtml(cnyPerUsd)}" required></label><button type="submit">保存汇率</button></form><form class="admin-search" method="get" action="/yc.php"><input type="search" name="q" value="${escapeHtml(query)}" placeholder="搜索标题或商品 ID"><button type="submit">搜索</button></form><div class="table-card"><table><thead><tr><th>图片</th><th>产品</th><th>分类</th><th>价格（人民币）</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="empty-cell">没有找到产品</td></tr>`}</tbody></table></div>${page > 1 ? `<a class="page-link" href="/yc.php?page=${page - 1}&q=${encodeURIComponent(query)}">上一页</a>` : ""}${products.length === 60 ? `<a class="page-link" href="/yc.php?page=${page + 1}&q=${encodeURIComponent(query)}">下一页</a>` : ""}`;
  return adminLayout("产品管理", body, { session, notice });
}

export function renderProductForm({ session, categories, product = null, error = "" }) {
  const isEdit = Boolean(product);
  const imageRows = (product?.images || []).map((image) => `<label class="existing-image"><img src="${escapeHtml(safeUrl(image.url, PLACEHOLDER))}" alt=""><span><input type="checkbox" name="delete_image" value="${Number(image.id)}"> 删除</span></label>`).join("");
  const categoryOptions = categories.filter((category) => category.id > 3).map((category) => `<option value="${Number(category.id)}" ${Number(product?.category_id) === Number(category.id) ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("");
  const body = `<div class="admin-title-row"><div><h1>${isEdit ? "编辑产品" : "增加产品"}</h1><p>${isEdit ? `产品 ID ${Number(product.id)}` : "填写产品资料并上传图片"}</p></div><a class="secondary-button" href="/yc.php">返回列表</a></div>
  <form class="product-form" method="post" action="/yc.php/products/save" enctype="multipart/form-data"><input type="hidden" name="csrf" value="${escapeHtml(session.csrf)}"><input type="hidden" name="id" value="${isEdit ? Number(product.id) : ""}">
    <section class="form-card"><h2>基本信息</h2><div class="form-grid"><label class="span-2">产品标题<input name="title" required maxlength="200" value="${escapeHtml(product?.title || "")}"></label><label>分类<select name="category_id" required>${categoryOptions}</select></label><label>状态<select name="status"><option value="1" ${product?.status !== 0 ? "selected" : ""}>显示</option><option value="0" ${product?.status === 0 ? "selected" : ""}>隐藏</option></select></label><label>价格（人民币 ¥）<input type="number" name="price" min="0" step="0.01" value="${escapeHtml(product?.price || 0)}"></label><label>划线价（人民币 ¥）<input type="number" name="crossed_price" min="0" step="0.01" value="${escapeHtml(product?.crossed_price || 0)}"></label><label>商品平台 ID<input name="source_id" maxlength="100" value="${escapeHtml(product?.source_id || "")}"></label><label>原始购买链接<input type="url" name="source_url" value="${escapeHtml(product?.source_url || "")}"></label><label class="span-2">副标题<input name="subtitle" maxlength="200" value="${escapeHtml(product?.subtitle || "")}"></label></div></section>
    <section class="form-card"><h2>图片</h2><p class="field-help">可直接上传 JPG、PNG、WEBP 或 GIF。单张不超过 1.5MB；新图片会存入 D1，不需要 R2。</p><label>主图网址<input name="main_image" value="${escapeHtml(product?.main_image || "")}" placeholder="/uploads/... 或 https://..."></label><label>上传新图片<input type="file" name="images" accept="image/jpeg,image/png,image/webp,image/gif" multiple></label><label>附加图片网址（每行一个）<textarea name="image_urls" rows="5" placeholder="https://example.com/image.jpg"></textarea></label>${imageRows ? `<div class="existing-images">${imageRows}</div>` : ""}</section>
    <section class="form-card"><h2>SEO 与说明</h2><label>SEO 标题<input name="seo_title" maxlength="200" value="${escapeHtml(product?.seo_title || "")}"></label><label>SEO 关键词<input name="seo_keywords" maxlength="300" value="${escapeHtml(product?.seo_keywords || "")}"></label><label>SEO 描述<textarea name="seo_description" rows="3">${escapeHtml(product?.seo_description || "")}</textarea></label><label>产品说明<textarea name="description" rows="8">${escapeHtml(product?.description || "")}</textarea></label></section>
    <div class="form-actions"><button class="primary-button" type="submit">${isEdit ? "保存修改" : "增加产品"}</button></div>
  </form>`;
  return adminLayout(isEdit ? "编辑产品" : "增加产品", body, { session, error });
}

export function renderErrorPage(status, message, settings = {}) {
  return `${head({ title: String(status), description: message, css: "common" }, settings)}<body>${header(settings)}<main class="error-page"><span>${status}</span><h1>${escapeHtml(message)}</h1><a href="/">Return home</a></main>${footer(settings)}`;
}
