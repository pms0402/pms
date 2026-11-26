// The input window follows animation time, so hitstop cannot shorten it.
export const COMBO_WINDOW=.18;
export const nextBasicAttack=kind=>kind==='light1'?'light3':kind==='light3'?'light1':null;
export function comboWindowOpen(action){return !!nextBasicAttack(action?.kind)&&action.t>=Math.max(action.spec.end,action.spec.duration-COMBO_WINDOW)-1e-9&&action.t<action.spec.duration;}
