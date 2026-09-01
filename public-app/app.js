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

  const gallery = document.querySelector("[data-product-gallery]");
  if (gallery) {
    const viewport = gallery.querySelector("[data-gallery-viewport]");
    const galleryTrack = gallery.querySelector("[data-gallery-track]");
    const slides = [...gallery.querySelectorAll("[data-gallery-slide]")];
    const thumbnails = [...gallery.querySelectorAll("[data-gallery-index]")];
    const thumbnailsTrack = gallery.querySelector("[data-gallery-thumbnails]");
    const previousButton = gallery.querySelector("[data-gallery-prev]");
    const nextButton = gallery.querySelector("[data-gallery-next]");
    const currentLabel = gallery.querySelector("[data-gallery-current]");
    let currentIndex = 0;
    let scrollFrame = 0;
    let drag = null;

    const normalizedIndex = (value) => Math.min(slides.length - 1, Math.max(0, Number(value) || 0));
    const updateGalleryState = (value, focusThumbnail = false) => {
      currentIndex = normalizedIndex(value);
      if (currentLabel) currentLabel.textContent = String(currentIndex + 1);
      if (previousButton) previousButton.disabled = currentIndex === 0;
      if (nextButton) nextButton.disabled = currentIndex === slides.length - 1;
      thumbnails.forEach((thumbnail, index) => {
        const active = index === currentIndex;
        thumbnail.classList.toggle("active", active);
        thumbnail.setAttribute("aria-current", active ? "true" : "false");
      });
      const activeThumbnail = thumbnails[currentIndex];
      if (activeThumbnail && thumbnailsTrack) {
        const left = activeThumbnail.offsetLeft - (thumbnailsTrack.clientWidth - activeThumbnail.offsetWidth) / 2;
        thumbnailsTrack.scrollTo({ left: Math.max(0, left), behavior: focusThumbnail ? "smooth" : "auto" });
      }
    };
    const goToImage = (value, behavior = "smooth") => {
      const nextIndex = normalizedIndex(value);
      galleryTrack?.scrollTo({ left: nextIndex * galleryTrack.clientWidth, behavior });
      updateGalleryState(nextIndex, behavior === "smooth");
    };

    previousButton?.addEventListener("click", () => goToImage(currentIndex - 1));
    nextButton?.addEventListener("click", () => goToImage(currentIndex + 1));
    thumbnails.forEach((thumbnail) => {
      thumbnail.addEventListener("click", () => goToImage(thumbnail.dataset.galleryIndex));
    });
    viewport?.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      goToImage(currentIndex + (event.key === "ArrowRight" ? 1 : -1));
    });
    galleryTrack?.addEventListener("scroll", () => {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = window.requestAnimationFrame(() => {
        if (!galleryTrack.clientWidth) return;
        updateGalleryState(Math.round(galleryTrack.scrollLeft / galleryTrack.clientWidth));
      });
    }, { passive: true });

    galleryTrack?.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      drag = { id: event.pointerId, startX: event.clientX, startScroll: galleryTrack.scrollLeft, moved: false };
      galleryTrack.setPointerCapture(event.pointerId);
      galleryTrack.classList.add("dragging");
    });
    galleryTrack?.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const distance = event.clientX - drag.startX;
      if (Math.abs(distance) > 4) drag.moved = true;
      galleryTrack.scrollLeft = drag.startScroll - distance;
      if (drag.moved) event.preventDefault();
    });
    const finishDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const moved = drag.moved;
      drag = null;
      galleryTrack.classList.remove("dragging");
      if (galleryTrack.hasPointerCapture(event.pointerId)) galleryTrack.releasePointerCapture(event.pointerId);
      if (moved && galleryTrack.clientWidth) goToImage(Math.round(galleryTrack.scrollLeft / galleryTrack.clientWidth));
    };
    galleryTrack?.addEventListener("pointerup", finishDrag);
    galleryTrack?.addEventListener("pointercancel", finishDrag);
    galleryTrack?.addEventListener("dragstart", (event) => event.preventDefault());

    if ("ResizeObserver" in window && galleryTrack) {
      new ResizeObserver(() => goToImage(currentIndex, "auto")).observe(galleryTrack);
    }
    updateGalleryState(0);
  }

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
