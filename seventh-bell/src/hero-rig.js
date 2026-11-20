// Calibrate each source sheet once against the same adult standing height.
// Never fit an individual pose to its bounds: crouches and raised arms must
// retain their motion instead of changing the character's anatomical scale.
export const HERO_HEIGHT=60;
// The original 64px standing cell has its crown at 2 and soles at 62.
export const HERO_BASE_SIZE=Math.round(HERO_HEIGHT*64/(62-2));
const register=(sheet,col,row,crown,foot)=>({sheet,col,row,crown,foot,size:Math.round(HERO_HEIGHT*128/(foot-crown))});
export const HERO_RIG={
 gaitWalk:register("gait-walk",0,0,6,125),
 // Same bones and source scale as walking; don't enlarge a leaning run pose.
 gaitRun:{sheet:'gait-run',reference:'gait-walk',size:Math.round(HERO_HEIGHT*128/(125-6))},
 gaitTransitions:register("gait-transitions",0,0,5,123),
 idle:register("cut-body",0,3,19,121),
 light1:register("cut-light1",5,3,7,123),
 light2:register("cut-light2",5,3,10,123),
 light3:register("cut-light3",5,3,8,124),
 heavy:register("cut-heavy",5,3,7,124),
 air:register("cut-air",5,3,8,124),
 plunge:register("cut-plunge",5,3,8,123),
 thrust:register("cut-thrust",5,3,13,125),
 brake:register("motion-extras",7,1,17,120),
 heal:register("motion-extras",0,2,14,121),
 skill:register("motion-extras",0,3,16,121)
};
// Sole positions measured on the actual hard-alpha 128px runtime cells.
export const HERO_FEET={"light1":[123,123,123,123,123,123,123,123,123,123,123,123,123,123,123,123,123,123,123,123,123,123,123,123],"light2":[123,123,123,123,123,123,122,123,123,123,122,123,123,123,123,123,123,123,123,123,123,123,123,123],"light3":[124,124,124,124,124,124,123,123,123,123,123,123,123,124,123,123,123,123,124,124,124,124,124,124],"heavy":[124,124,124,124,124,124,123,123,124,124,123,123,123,123,124,124,124,124,124,123,123,124,124,124],"air":[123,117,115,114,116,118,117,114,117,122,123,123,123,123,124,124,124,124,124,124,124,124,124,124],"plunge":[121,112,120,124,128,128,124,124,124,124,124,124,123,123,123,123,123,123,123,123,123,123,123,123],"thrust":[125,125,125,125,125,125,125,125,125,125,125,125,125,125,125,125,125,125,125,125,125,125,125,125],"idle":[121,121,121,122,122,122,121,121],"brake":[119,117,120,120,120,120,120,120],"heal":[121,121,121,121,121,121,121,121],"skill":[121,121,121,121,121,121,121,121]};
