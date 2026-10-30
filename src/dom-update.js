/** Diff small HUD values against the live DOM; other UI owners cannot stale a cache. */
export const text = (node, value) => {
  value = String(value);
  if (node.textContent !== value) node.textContent = value;
};
export const attr = (node, name, value) => {
  value = String(value);
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
};
export const style = (node, name, value) => {
  value = String(value);
  if (node.style.getPropertyValue(name) !== value)
    node.style.setProperty(name, value);
};
export const toggle = (node, name, value) => {
  value = !!value;
  if (node.classList.contains(name) !== value)
    node.classList.toggle(name, value);
};
export const disabled = (node, value) => {
  value = !!value;
  if (node.disabled !== value) node.disabled = value;
};
