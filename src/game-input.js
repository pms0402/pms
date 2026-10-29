const koreanKeys = {
  ㅍ: "f",
  ㅎ: "g",
  ㅈ: "w",
  ㅁ: "a",
  ㄴ: "s",
  ㅇ: "d",
  ㄷ: "e",
  ㄱ: "r",
  ㅠ: "b",
};
// Physical keys still work when a Korean IME reports “ㅍ” or “Process”.
export function gameKey(event) {
  if (/^Key[A-Z]$/.test(event.code || ""))
    return event.code.slice(3).toLowerCase();
  if (event.code === "Space") return " ";
  if (/^Arrow(Up|Down|Left|Right)$/.test(event.code || ""))
    return event.code.toLowerCase();
  const key = (event.key || "").toLowerCase();
  return koreanKeys[key] || key;
}

export function isTypingTarget(target) {
  return !!target?.closest?.(
    'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
  );
}

export function isGameShortcut(event) {
  return (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !isTypingTarget(event.target)
  );
}
