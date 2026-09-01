document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!window.confirm(form.dataset.confirm || "确定继续吗？")) event.preventDefault();
    });
  });

  const upload = document.querySelector('input[type="file"][name="images"]');
  upload?.addEventListener("change", () => {
    const tooLarge = Array.from(upload.files || []).find((file) => file.size > 1.5 * 1024 * 1024);
    if (tooLarge) {
      window.alert(`${tooLarge.name} 超过 1.5MB，请压缩后再上传。`);
      upload.value = "";
    }
  });
});
