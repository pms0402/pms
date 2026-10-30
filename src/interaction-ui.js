import { keyLabel } from "./control-bindings.js";
import { text, attr, toggle, disabled } from "./dom-update.js";
export function createInteractionUi(game) {
  const root = document.getElementById("interaction-prompt"),
    button = document.getElementById("interact-npc"),
    key = button.querySelector("kbd"),
    label = button.querySelector("span");
  return {
    update() {
      const target = game.interactionTarget();
      toggle(root, "hidden", !target);
      toggle(button, "hidden", !target);
      disabled(button, !target);
      if (!target) return;
      const binding = keyLabel(game.bindings.interact),
        title = `${target.name} · ${target.verb}`;
      text(key, binding);
      text(label, title);
      attr(button, "aria-label", `${binding} · ${title}`);
      attr(button, "title", `${binding} · ${title}`);
    },
  };
}
