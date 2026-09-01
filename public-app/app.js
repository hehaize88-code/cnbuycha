document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav-links");
  menuButton?.addEventListener("click", () => {
    const open = nav?.classList.toggle("active");
    menuButton.setAttribute("aria-expanded", open ? "true" : "false");
  });

  const loadImage = (image) => {
    if (!image.dataset.src) return;
    image.src = image.dataset.src;
    delete image.dataset.src;
  };
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        loadImage(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "300px" });
    document.querySelectorAll("img[data-src]").forEach((image) => observer.observe(image));
  } else {
    document.querySelectorAll("img[data-src]").forEach(loadImage);
  }

  const track = document.querySelector(".carousel-track");
  const scrollTrack = (direction) => track?.scrollBy({ left: direction * Math.max(280, track.clientWidth * 0.75), behavior: "smooth" });
  document.querySelector(".carousel-prev")?.addEventListener("click", () => scrollTrack(-1));
  document.querySelector(".carousel-next")?.addEventListener("click", () => scrollTrack(1));

  const mainImage = document.getElementById("mainProductImage");
  document.querySelectorAll("[data-gallery-src]").forEach((button) => {
    button.addEventListener("click", () => {
      if (mainImage) mainImage.src = button.dataset.gallerySrc;
      document.querySelectorAll("[data-gallery-src]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });

  const modal = document.getElementById("platformModal");
  const closeModal = () => {
    if (modal) modal.hidden = true;
    document.body.classList.remove("modal-open");
  };
  document.querySelector("[data-open-platforms]")?.addEventListener("click", () => {
    if (modal) modal.hidden = false;
    document.body.classList.add("modal-open");
  });
  document.querySelector("[data-close-modal]")?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  document.querySelector("[data-copy-url]")?.addEventListener("click", async (event) => {
    const value = event.currentTarget.dataset.copyUrl;
    await navigator.clipboard.writeText(value);
    const notice = document.getElementById("copySuccess");
    notice?.classList.add("show");
    window.setTimeout(() => notice?.classList.remove("show"), 1800);
  });
});
