(()=>{function ue(h){let T=h.getBoundingClientRect(),r=()=>{T=h.getBoundingClientRect()},f=new ResizeObserver(r);return f.observe(h),window.addEventListener("resize",r,{passive:!0}),window.addEventListener("scroll",r,{capture:!0,passive:!0}),{get current(){return T},destroy(){f.disconnect(),window.removeEventListener("resize",r),window.removeEventListener("scroll",r,!0)}}}var Ee={tileSize:150,gap:0,cornerRadius:0,amplitude:2.5,waveSpeed:.5,frequency:12,waveWidth:.05,fadeTime:.2,maxLift:1,jitter:0,liftHeight:60,perspective:1200,tilt:1,shading:.05,tint:[0,.33,1],tintStrength:.1,idleRipples:0},M=64,pe=.03,se=3,ge=`#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main () {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`,be=`#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uTrail;
uniform int uTrailCount;
uniform float uWorldPerTile;
uniform float uWaveSpeed;
uniform float uFrequency;
uniform float uWaveWidth;
uniform float uFadeTime;
uniform float uAmplitude;
uniform float uJitter;
uniform float uMaxLift;

vec2 hash2 (vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123) - 0.5;
}

void main () {
  vec2 tile = floor(gl_FragCoord.xy);
  vec2 world = (tile + 0.5) * uWorldPerTile + hash2(tile) * uJitter * 0.12;

  float waveHeight = 0.0;
  float totalWeight = 0.0;

  for (int i = 0; i < 64; i++) {
    if (i >= uTrailCount) break;

    vec4 td = texelFetch(uTrail, ivec2(i, 0), 0);
    vec2 delta = world - td.xy;
    float dist = length(delta);
    float relDist = dist - uWaveSpeed * td.z;

    float window = exp(-(relDist * relDist) / (uWaveWidth * uWaveWidth));

    float fade = exp(-td.z / uFadeTime);
    float atten = 1.0 / (1.0 + dist * 3.0);
    float weight = fade * window * atten * td.w;
    waveHeight += weight * cos(uFrequency * relDist);
    totalWeight += weight;
  }

  float lift = clamp(
    waveHeight / max(totalWeight, 1.0) * uAmplitude, -uMaxLift, uMaxLift
  );

  outColor = vec4(lift * 0.5 + 0.5, 0.0, 0.0, 1.0);
}`,Re=`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uContent;
uniform sampler2D uTiles;
uniform vec2 uResolution;
uniform ivec2 uGridTiles;
uniform float uTilePx;
uniform float uGapPx;
uniform float uCornerPx;
uniform float uLiftPx;
uniform float uPersp;
uniform vec2 uVanish;
uniform float uShading;
uniform vec3 uTint;
uniform float uTintStrength;
uniform float uMaxX;
uniform float uHasContent;

float tileLift (ivec2 idx) {
  idx = clamp(idx, ivec2(0), uGridTiles - 1);
  return texelFetch(uTiles, idx, 0).r * 2.0 - 1.0;
}

float roundedBox (vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float tileSd (vec2 w, ivec2 idx, float halfSize) {
  vec2 center = (vec2(idx) + 0.5) * uTilePx;
  return roundedBox(w - center, vec2(halfSize), min(uCornerPx, halfSize));
}

vec2 unproject (vec2 w, float lift) {
  vec2 vanish = uVanish;
  float persp = uPersp;
  float k = lift * uLiftPx;
  float denom = max(persp, 1.0);
  vec2 d = w - vanish;
  return vanish + d * (denom / max(denom - k, 1.0));
}

void main () {
  vec2 w = vUv * uResolution;
  float lift = tileLift(ivec2(floor(w / uTilePx)));
  vec2 wTop = unproject(w, lift);
  ivec2 idxTop = ivec2(floor(wTop / uTilePx));
  float halfSize = (uTilePx - uGapPx) * 0.5;
  float sdTop = tileSd(wTop, idxTop, halfSize);
  float edge = 1.0;
  float shade = 0.0;
  vec4 content = texture(uContent, vUv / max(uMaxX, 1e-4) * vec2(uMaxX, 1.0));
  float alpha = content.a;
  if (uHasContent == 1.0 && sdTop > 0.0) {
    vec2 wSide = wTop;
    ivec2 idxSide = idxTop;
    float sdSide = sdTop;
    if (lift > 0.0 && wTop.y > float(idxTop.y) * uTilePx) {
      idxSide = ivec2(idxTop.x, idxTop.y - 1);
      sdSide = tileSd(wTop, idxSide, halfSize);
    } else if (lift < 0.0 && wTop.y < float(idxTop.y + 1) * uTilePx) {
      idxSide = ivec2(idxTop.x, idxTop.y + 1);
      sdSide = tileSd(wTop, idxSide, halfSize);
    }
    if (sdSide <= 0.0) {
      vec2 uvSide = (vec2(idxSide) * uTilePx + (wTop - vec2(idxSide) * uTilePx)) / uResolution;
      content = texture(uContent, uvSide / max(uMaxX, 1e-4) * vec2(uMaxX, 1.0));
      alpha = content.a;
      shade = -abs(lift) * uShading;
      edge = 0.0;
    } else {
      vec2 uvTop = wTop / uResolution;
      content = texture(uContent, uvTop / max(uMaxX, 1e-4) * vec2(uMaxX, 1.0));
      alpha = content.a;
      shade = abs(lift) * uShading;
    }
  }
  float t = clamp(abs(lift) * uTintStrength, 0.0, 1.0);
  vec3 col = content.rgb;
  if (uHasContent == 1.0) {
    float bestLift = lift;
    ivec2 idx = ivec2(floor(w / uTilePx));
    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        float l = tileLift(idx + ivec2(dx, dy));
        if (abs(l) > abs(bestLift)) bestLift = l;
      }
    }
    shade += clamp(bestLift, -1.0, 1.0) * 0.1 * uShading;
    col = content.rgb * (1.0 + shade * 0.85) + shade * 0.12;
    alpha = clamp(content.a + t + abs(shade) * 0.5, 0.0, 1.0);
  }

  col = mix(col, uTint, t);
  float aOut = alpha * mask;
  outColor = vec4(col * aOut, aOut);
}`;
/* MIT + Commons Clause — (c) 2026 David Haz, github.com/DavidHDev/canvas-ui (Canvas UI, Grid vanilla WebGL build) */
function supportsHtmlInCanvas(){if(typeof document=="undefined")return!1;let e=document.createElement("canvas"),t=e.getContext("2d");return!!(t&&typeof t.drawElementImage=="function"&&typeof e.requestPaint=="function")}function createGrid(e,t={}){let o={...Ee,...t},{source:n,content:a,output:r}=e,i=r.getContext("webgl2",{alpha:!0,depth:!1,stencil:!1,antialias:!1,premultipliedAlpha:!0});if(!i||i.isContextLost())return null;let s=n.getContext("2d"),l=n,c=!!(s&&typeof s.drawElementImage=="function"&&typeof l.requestPaint=="function"),u=!1,d=()=>{};if(c){l.onpaint=()=>{try{s.reset(),s.drawElementImage(a,0,0),u=!0,d()}catch{}}}function p(e,t){let o=i.createShader(e);return i.shaderSource(o,t),i.compileShader(o),i.getShaderParameter(o,i.COMPILE_STATUS)||console.error("Grid shader error:",i.getShaderInfoLog(o)),o}function g(t){let o=p(i.VERTEX_SHADER,ge),n=p(i.FRAGMENT_SHADER,t),a=i.createProgram();i.attachShader(a,o),i.attachShader(a,n),i.linkProgram(a);let r={};let m=i.getProgramParameter(a,i.ACTIVE_UNIFORMS);for(let e=0;e<m;e++){let t=i.getActiveUniform(a,e).name;r[t]=i.getUniformLocation(a,t)}return{program:a,uniforms:r}}let m=g(be),h=g(Re),y=i.createBuffer();i.bindBuffer(i.ARRAY_BUFFER,y),i.bufferData(i.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),i.STATIC_DRAW);let f=i.createTexture();i.bindTexture(i.TEXTURE_2D,f),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MAG_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE);let w=i.createTexture(),T=i.createTexture(),x=null,v=null;function b(){if(x&&v)return;let e=Math.ceil(o.tileSize*2),t=Math.ceil(o.tileSize*2);x=i.createFramebuffer(),v=i.createTexture(),i.bindTexture(i.TEXTURE_2D,v),i.texImage2D(i.TEXTURE_2D,0,i.RGBA,e,t,0,i.RGBA,i.UNSIGNED_BYTE,null),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MAG_FILTER,i.NEAREST),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),i.bindFramebuffer(i.FRAMEBUFFER,x),i.framebufferTexture2D(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,v,0),i.bindFramebuffer(i.FRAMEBUFFER,null)}let S=createRectCache(a),A=null;function L(){let e=r.clientWidth,t=r.clientHeight;if(!e||!t)return;if(r.width!==e*devicePixelRatio||r.height!==t*devicePixelRatio){r.width=e*devicePixelRatio,r.height=t*devicePixelRatio}A=Math.min(1,Math.max(.05,a.clientWidth/Math.max(r.clientWidth,1)));if(c){let e=Math.max(1,Math.round(n.clientWidth)),t=Math.max(1,Math.round(n.clientHeight));if(n.width!==e*devicePixelRatio||n.height!==t*devicePixelRatio){n.width=e*devicePixelRatio,n.height=t*devicePixelRatio}l.requestPaint()}}L();function C(){if(!c||!u)return;u=!1,i.bindTexture(i.TEXTURE_2D,f),i.texImage2D(i.TEXTURE_2D,0,i.RGBA,i.RGBA,i.UNSIGNED_BYTE,n)}let P=[],I=0,O=3;function D(e,t,o,n){P.push({x:e,y:t,age:0,str:n}),P.length>M&&P.shift()}function R(e){let t=[];for(let o of P){o.age+=e;let n=Math.exp(-o.age/o.str);n>.01&&t.push(o)}return P=t,t}function _(e,t,o,n){i.useProgram(m.program),i.bindFramebuffer(i.FRAMEBUFFER,v),i.viewport(0,0,x.width,x.height),i.clearColor(0,0,0,0),i.clear(i.COLOR_BUFFER_BIT),i.useProgram(m.program),i.uniform1f(m.uniforms.uWorldPerTile,o),i.uniform1f(m.uniforms.uWaveSpeed,o.waveSpeed),i.uniform1f(m.uniforms.uFrequency,o.frequency),i.uniform1f(m.uniforms.uWaveWidth,o.waveWidth),i.uniform1f(m.uniforms.uFadeTime,o.fadeTime),i.uniform1f(m.uniforms.uAmplitude,o.amplitude),i.uniform1f(m.uniforms.uJitter,o.jitter),i.uniform1f(m.uniforms.uMaxLift,o.maxLift),i.uniform1i(m.uniforms.uTrailCount,n),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,w),i.uniform1i(m.uniforms.uTrail,0),i.drawArrays(i.TRIANGLE_STRIP,0,4),i.bindFramebuffer(i.FRAMEBUFFER,null)}function k(e,t){i.bindTexture(i.TEXTURE_2D,w),i.texSubImage2D(i.TEXTURE_2D,0,0,0,e,t,1,1,i.RGBA,i.UNSIGNED_BYTE,new Uint8Array([t.x*255,t.y*255,t.age*60,t.str*255]))}let z=null,W={x:0,y:0,str:1};function U(e){let t=r.getBoundingClientRect(),o=(e.clientX-t.left)/t.width,n=(e.clientY-t.top)/t.height;D(o,n,1,1)}let G=r.parentElement??r;G.addEventListener("pointermove",U,{passive:!0}),G.addEventListener("pointerleave",()=>{z=null},{passive:!0});let j=0,q=performance.now(),F=!1,B=!1,V=!0,H=window.matchMedia("(prefers-reduced-motion: reduce)"),J=H.matches;function X(e){if(F)return;if(!V){B=!1;return}let t=Math.min((e-q)/1e3,1/30);q=e;let n=J?0:R(t);if(c&&C(),i.viewport(0,0,r.width,r.height),i.clearColor(0,0,0,0),i.clear(i.COLOR_BUFFER_BIT),!c&&!n.length){B=!1;return}b(),i.useProgram(m.program),i.bindFramebuffer(i.FRAMEBUFFER,x),i.viewport(0,0,v.width,v.height),i.clear(i.COLOR_BUFFER_BIT),i.uniform1i(m.uniforms.uTrailCount,n.length),i.uniform1f(m.uniforms.uWorldPerTile,1/o.tileSize),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,w),i.uniform1i(m.uniforms.uTrail,0),n.forEach((e,t)=>k(t,e)),i.bindFramebuffer(i.FRAMEBUFFER,null),i.useProgram(h.program),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,f),i.uniform1i(h.uniforms.uContent,0),i.uniform1f(h.uniforms.uHasContent,c?1:0),i.activeTexture(i.TEXTURE1),i.bindTexture(i.TEXTURE_2D,v),i.uniform1i(h.uniforms.uTiles,1),i.activeTexture(i.TEXTURE0),i.uniform2f(h.uniforms.uResolution,r.width,r.height),i.uniform2i(h.uniforms.uGridTiles,Math.ceil(r.width/(o.tileSize*devicePixelRatio)),Math.ceil(r.height/(o.tileSize*devicePixelRatio))),i.uniform1f(h.uniforms.uTilePx,o.tileSize*devicePixelRatio),i.uniform1f(h.uniforms.uGapPx,o.gap*devicePixelRatio),i.uniform1f(h.uniforms.uCornerPx,o.cornerRadius*devicePixelRatio),i.uniform1f(h.uniforms.uLiftPx,o.liftHeight*devicePixelRatio),i.uniform1f(h.uniforms.uPersp,o.perspective),i.uniform2f(h.uniforms.uVanish,.5+(W.x-.5)*o.tilt*.2,.5+(W.y-.5)*o.tilt*.2),i.uniform1f(h.uniforms.uShading,o.shading),i.uniform3f(h.uniforms.uTint,o.tint[0],o.tint[1],o.tint[2]),i.uniform1f(h.uniforms.uTintStrength,o.tintStrength),i.uniform1f(h.uniforms.uMaxX,A),i.bindBuffer(i.ARRAY_BUFFER,y),i.enableVertexAttribArray(0),i.vertexAttribPointer(0,2,i.FLOAT,!1,0,0),i.drawArrays(i.TRIANGLE_STRIP,0,4)}function Y(){if(F||B)return;B=!0,q=performance.now(),j=requestAnimationFrame(X)}d=Y,Y();function Z(){J=H.matches,J&&(P.length=0),Y()}H.addEventListener("change",Z);let K=new ResizeObserver(()=>{L(),Y()});K.observe(r),K.observe(a);let Q=new IntersectionObserver(e=>{V=e[e.length-1]?.isIntersecting??!0,V?Y():B=!1},{threshold:0});Q.observe(r);let ee=new MutationObserver(()=>{L(),Y()});ee.observe(a,{attributes:!0,childList:!0,subtree:!0});let te=setInterval(()=>{if(o.idleRipples<=0)return;let e=performance.now();if(e-I>o.idleRipples*1e3&&e-q>1e3*(J?0:O)){I=e;let t=.2+Math.random()*.6,o=.2+Math.random()*.6;D(t,o,1,.6)}},500);return{setOptions(e){Object.assign(o,e)},destroy(){F=!0,S.destroy(),cancelAnimationFrame(j),K.disconnect(),Q.disconnect(),ee.disconnect(),clearInterval(te),H.removeEventListener("change",Z),G.removeEventListener("pointermove",U),G.removeEventListener("pointerleave",U),i.deleteTexture(f),i.deleteTexture(w),v&&i.deleteTexture(v),x&&i.deleteFramebuffer(x);for(let e of[m,h])i.deleteProgram(e.program),i.deleteShader(e.vertexShader),i.deleteShader(e.fragmentShader);i.deleteBuffer(y),c&&(l.onpaint=null)}}}window.CanvasGrid={createGrid,supportsHtmlInCanvas};
