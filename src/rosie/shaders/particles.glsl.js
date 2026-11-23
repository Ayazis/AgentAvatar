// Particles: soft points, coloured by index, hidden by the jacket when they are behind it.
import { jacketGLSL } from './jacket.glsl.js';

export const PARTICLE_VERT = `
attribute vec3 aPos;   // picture x, picture y, depth (−front … +behind the lapels)
attribute vec3 aMeta;  // size (px), brightness, colour index
uniform vec2 view;     // aspect, scale
uniform vec2 light;    // 1 when drawing into the light buffer, point-size factor
varying vec2 vSt; varying float vZ, vA; varying vec3 vCol;
void main(){
  vec2 q = vec2((aPos.x-.5)/1.5, .5-aPos.y);
  vec2 sc = q*view.y;
  gl_Position = vec4((sc.x/view.x)*2., sc.y*2., 0., 1.);
  gl_PointSize = light.x > .5 ? min(aMeta.x*light.y, 64.) : aMeta.x;
  vSt = aPos.xy; vZ = aPos.z; vA = aMeta.y;
  float c = aMeta.z;
  vCol = c < .5 ? vec3(1.,.42,.58) : c < 1.5 ? vec3(1.,.74,.62) : c < 2.5 ? vec3(1.,.92,.95) : c < 3.5 ? vec3(.92,.22,.42)
       : c < 4.5 ? vec3(.62,.44,1.) : c < 5.5 ? vec3(.48,.62,1.) : vec3(.9,.3,.88);   // violet, periwinkle, magenta
}`;

export const particleFrag = (spans) => `
precision highp float;
${jacketGLSL(spans)}
uniform vec2 light;
varying vec2 vSt; varying float vZ, vA; varying vec3 vCol;
void main(){
  float r = length(gl_PointCoord - .5)*2.;
  if (r > 1.) discard;
  if (light.x > .5) {                       // light buffer: a wide soft falloff; behind the lapels it only rims them
    float k = vZ > 0. ? .45 : 1.;
    gl_FragColor = vec4(vCol*vA*k*exp(-r*r*4.)*(1. - r)*.05, 1.);   // thousands overlap: keep each faint
    return;
  }
  float a = exp(-r*r*3.5) + .6*exp(-r*r*28.);
  float den = M(vSt).r;
  float occ = vZ > 0. ? 1. - den : 1.;      // hidden behind the lapels when it is behind them
  gl_FragColor = vec4(vCol*a*vA*occ, 1.);
}`;
