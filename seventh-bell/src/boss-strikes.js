import {REGISTERED_WEAPONS} from './boss-registration.js';
import {MINIBOSS_RIG} from './miniboss-registration.js';
import {bossPose} from './boss-motion.js';
import {minibossPose} from './miniboss-motion.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function registeredWeaponTip(e){const pose=e.miniboss?minibossPose(e):bossPose(e);if(!pose)return null;const trace=e.miniboss?MINIBOSS_RIG[e.type]?.tips?.[pose.row]?.[pose.col]:REGISTERED_WEAPONS[pose.sheet===e.id+'-motion'?e.id:pose.sheet]?.[pose.row]?.[pose.col]?.tip;if(!trace)return null;const scale=pose.size/(e.miniboss?128:192);return{x:e.x+(trace[0]-pose.root)*scale*e.dir,y:e.y+(trace[1]-pose.foot)*scale,pose};}
export function bossSteel(e,length=110,y=42,slope=0){const tip=registeredWeaponTip(e)||{x:e.x+e.dir*length,y:e.y-y+slope},pose=tip.pose;return{ax:e.x+e.dir*12,ay:e.y-43,bx:e.x+e.dir*Math.min(length,Math.max(25,Math.abs(tip.x-e.x))),by:tip.y,ghost:{id:e.id,x:e.x,y:e.y,dir:e.dir,row:pose?.row||0,col:pose?.col||0}};}
export function minibossSteel(e,a){const tip=registeredWeaponTip(e)||{x:e.x+e.dir*a.reach,y:e.y-25},reach=Math.min(Math.abs(tip.x-e.x),a.reach);return{ax:e.x+e.dir*8,ay:e.y-Math.min(e.h*.55,40),bx:e.x+e.dir*reach,by:clamp(tip.y,e.y-e.h-5,e.y-6)};}
