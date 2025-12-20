(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const navCollapseEl = document.getElementById("nav");
  if (!navCollapseEl) return;

  const hideNav = () => {
    if (!navCollapseEl.classList.contains("show")) return;
    const Collapse = window.bootstrap?.Collapse;
    if (!Collapse) return;
    const instance = Collapse.getOrCreateInstance(navCollapseEl, { toggle: false });
    instance.hide();
  };

  navCollapseEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("a.nav-link, a.btn")) return;
    hideNav();
  });
})();
