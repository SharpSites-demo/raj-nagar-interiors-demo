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

vec2 unproject (vec2 p, float z) {
  return uVanish + (p - uVanish) * (uPersp - z) / uPersp;
}

void main () {
  if (vUv.x > uMaxX) {
    outColor = vec4(0.0);
    return;
  }

  vec2 pos = vUv * uResolution;
  float halfSize = uTilePx * 0.5 - uGapPx * 0.5;

  float bestZ = -1e6;
  float edgeSd = 1.0;
  ivec2 bestIdx = ivec2(-1);
  vec2 bestW = pos;
  float bestLift = 0.0;
  bool bestIsWall = false;
  vec2 wallN = vec2(0.0);
  ivec2 lastIdx = ivec2(-9999);

  for (int k = 0; k < 8; k++) {
    float probeZ = (float(k) / 3.5 - 1.0) * uLiftPx;
    ivec2 idx = clamp(
      ivec2(floor(unproject(pos, probeZ) / uTilePx)),
      ivec2(0), uGridTiles - 1
    );
    if (all(equal(idx, lastIdx))) continue;
    lastIdx = idx;

    float lift = tileLift(idx);
    float h = lift * uLiftPx;

    if (h <= bestZ) continue;

    vec2 wh = unproject(pos, h);
    float sdTop = tileSd(wh, idx, halfSize);

    if (sdTop < 0.75) {
      bestZ = h;
      edgeSd = sdTop;
      bestIdx = idx;
      bestW = wh;
      bestLift = lift;
      bestIsWall = false;
    } else if (h > 0.0) {
      float sd0 = tileSd(pos, idx, halfSize);
      if (sd0 < 0.75) {
        float za = 0.0;
        float zb = h;
        for (int r = 0; r < 3; r++) {
          float zm = (za + zb) * 0.5;
          float sm = tileSd(unproject(pos, zm), idx, halfSize);
          if (sm < 0.0) { za = zm; } else { zb = zm; }
        }
        float zStar = (za + zb) * 0.5;
        if (zStar > bestZ) {
          vec2 wz = unproject(pos, zStar);
          vec2 e = vec2(0.75, 0.0);
          wallN = normalize(vec2(
            tileSd(wz + e.xy, idx, halfSize) - tileSd(wz - e.xy, idx, halfSize),
            tileSd(wz + e.yx, idx, halfSize) - tileSd(wz - e.yx, idx, halfSize)
          ) + 1e-5);
          bestZ = zStar;
          edgeSd = sd0;
          bestIdx = idx;
          bestW = wz;
          bestLift = lift;
          bestIsWall = true;
        }
      }
    }
  }

  if (bestIdx.x < 0) {
    outColor = vec4(0.0);
    return;
  }
  float mask = 1.0 - smoothstep(-0.75, 0.75, edgeSd);
  if (mask <= 0.0) {
    outColor = vec4(0.0);
    return;
  }

  vec2 tileOrigin = vec2(bestIdx) * uTilePx;
  vec2 samplePos = clamp(bestW, tileOrigin + 0.5, tileOrigin + uTilePx - 0.5);
  vec2 sampleUv = samplePos / uResolution;
  sampleUv.x = min(sampleUv.x, uMaxX - 0.002);
  vec4 content;
  if (uHasContent > 0.5) {
    content = texture(uContent, vec2(sampleUv.x, 1.0 - sampleUv.y));
  } else {
    float liftAmt = clamp(abs(bestLift), 0.0, 1.0);
    content = vec4(
      mix(vec3(0.62), uTint, clamp(uTintStrength, 0.0, 1.0)),
      liftAmt * 0.55);
  }

  float t = clamp(bestLift, 0.0, 1.0) * uTintStrength;
  vec3 col;
  float alpha;

  if (bestIsWall) {
    vec2 lightDir = normalize(vec2(-0.55, 0.8));
    float facing = dot(wallN, lightDir);
    float shade = 1.0 - (0.5 - 0.32 * facing) * uShading;
    col = content.rgb * shade;

    alpha = uHasContent > 0.5 ? max(content.a, 0.85) : min(content.a * 1.5, 0.85);
  } else {
    float gx = tileLift(bestIdx + ivec2(1, 0)) - tileLift(bestIdx - ivec2(1, 0));
    float gy = tileLift(bestIdx + ivec2(0, 1)) - tileLift(bestIdx - ivec2(0, 1));
    float shade = (gy - gx) * 0.25 * uShading;
    shade += clamp(bestLift, -1.0, 1.0) * 0.1 * uShading;
    col = content.rgb * (1.0 + shade * 0.85) + shade * 0.12;
    alpha = clamp(content.a + t + abs(shade) * 0.5, 0.0, 1.0);
  }

  col = mix(col, uTint, t);
  float aOut = alpha * mask;
  outColor = vec4(col * aOut, aOut);
}`;function fe(){if(typeof document=="undefined")return!1;let h=document.createElement("canvas"),T=h.getContext("2d");return!!(T&&typeof T.drawElementImage=="function"&&typeof h.requestPaint=="function")}function ce(h,T={}){var le;let r={...Ee,...T},{source:f,content:B,output:o}=h,e=o.getContext("webgl2",{alpha:!0,depth:!1,stencil:!1,antialias:!1,premultipliedAlpha:!0});if(!e||e.isContextLost())return null;let _=f.getContext("2d"),A=f,g=!!(_&&typeof _.drawElementImage=="function"&&typeof A.requestPaint=="function"),w=!1,V=()=>{};g&&(A.onpaint=()=>{try{_.reset(),_.drawElementImage(B,0,0),w=!0,V()}catch{}});function Z(t,a){let n=e.createShader(t);return e.shaderSource(n,a),e.compileShader(n),e.getShaderParameter(n,e.COMPILE_STATUS)||console.error("Grid shader error:",e.getShaderInfoLog(n)),n}function J(t){let a=Z(e.VERTEX_SHADER,ge),n=Z(e.FRAGMENT_SHADER,t),i=e.createProgram();e.attachShader(i,a),e.attachShader(i,n),e.linkProgram(i);let u={},S=e.getProgramParameter(i,e.ACTIVE_UNIFORMS);for(let v=0;v<S;v++){let p=e.getActiveUniform(i,v);u[p.name]=e.getUniformLocation(i,p.name)}return{program:i,uniforms:u,vertexShader:a,fragmentShader:n}}let l=J(Re),c=J(be),Q=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,Q),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0);let L=e.createTexture();e.bindTexture(e.TEXTURE_2D,L),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));let E=new Float32Array(M*4),U=e.createTexture();e.bindTexture(e.TEXTURE_2D,U),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA32F,M,1,0,e.RGBA,e.FLOAT,E);function K(){return Math.min(window.devicePixelRatio||1,2)}let d=null,x=null,b=0,R=0;function me(){let t=Math.max(r.tileSize,8)*K(),a=Math.max(1,Math.ceil(o.width/t)),n=Math.max(1,Math.ceil(o.height/t));d&&a===b&&n===R||(b=a,R=n,d&&e.deleteTexture(d),x&&e.deleteFramebuffer(x),d=e.createTexture(),e.bindTexture(e.TEXTURE_2D,d),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,b,R,0,e.RGBA,e.UNSIGNED_BYTE,null),x=e.createFramebuffer(),e.bindFramebuffer(e.FRAMEBUFFER,x),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,d,0),e.bindFramebuffer(e.FRAMEBUFFER,null))}let $=1;function N(){let t=K(),a=Math.max(1,Math.round(o.clientWidth*t)),n=Math.max(1,Math.round(o.clientHeight*t));if((o.width!==a||o.height!==n)&&(o.width=a,o.height=n),$=Math.min(1,Math.max(.05,B.clientWidth/Math.max(o.clientWidth,1))),g){let i=Math.max(1,Math.round(f.clientWidth)),u=Math.max(1,Math.round(f.clientHeight));(f.width!==i*t||f.height!==u*t)&&(f.width=i*t,f.height=u*t),A.requestPaint()}}N();function de(){!g||!w||(w=!1,e.bindTexture(e.TEXTURE_2D,L),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,f))}let s=[],I=null,H=se,C=0;function ee(t){s.length>=M&&s.shift(),s.push(t)}function he(t){let a=Math.max(r.fadeTime,.1)*4;for(let i=s.length-1;i>=0;i--)s[i].age+=t,s[i].age>a&&s.splice(i,1);if(H+=t,r.idleRipples>0&&H>=se&&(C+=t,C>=r.idleRipples)){C=0;let i=Math.max(o.clientWidth,1)/Math.max(o.clientHeight,1);ee({x:(.2+Math.random()*.6)*i,y:.2+Math.random()*.6,age:0,strength:.8+Math.random()*.3})}let n=Math.min(s.length,M);for(let i=0;i<n;i++){let u=i*4;E[u]=s[i].x,E[u+1]=s[i].y,E[u+2]=s[i].age,E[u+3]=s[i].strength}return e.bindTexture(e.TEXTURE_2D,U),e.texSubImage2D(e.TEXTURE_2D,0,0,0,M,1,e.RGBA,e.FLOAT,E),n}let D=.5,F=.5,y=.5,X=.5;function Te(t,a){de(),me();let n=o.width/Math.max(o.clientWidth,1),i=Math.max(r.tileSize,8)*n,u=1-Math.exp(-a*4);D+=(y-D)*u,F+=(X-F)*u,e.useProgram(c.program),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,U),e.uniform1i(c.uniforms.uTrail,0),e.uniform1i(c.uniforms.uTrailCount,t),e.uniform1f(c.uniforms.uWorldPerTile,i/o.height),e.uniform1f(c.uniforms.uWaveSpeed,Math.max(r.waveSpeed,.01)),e.uniform1f(c.uniforms.uFrequency,r.frequency),e.uniform1f(c.uniforms.uWaveWidth,Math.max(r.waveWidth,.01)),e.uniform1f(c.uniforms.uFadeTime,Math.max(r.fadeTime,.1)),e.uniform1f(c.uniforms.uAmplitude,r.amplitude),e.uniform1f(c.uniforms.uJitter,r.jitter),e.uniform1f(c.uniforms.uMaxLift,Math.max(r.maxLift,.01)),e.bindFramebuffer(e.FRAMEBUFFER,x),e.viewport(0,0,b,R),e.drawArrays(e.TRIANGLE_STRIP,0,4),e.useProgram(l.program),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,L),e.uniform1i(l.uniforms.uContent,0),e.uniform1f(l.uniforms.uHasContent,g?1:0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,d),e.uniform1i(l.uniforms.uTiles,1),e.activeTexture(e.TEXTURE0),e.uniform2f(l.uniforms.uResolution,o.width,o.height),e.uniform2i(l.uniforms.uGridTiles,b,R),e.uniform1f(l.uniforms.uTilePx,i),e.uniform1f(l.uniforms.uGapPx,Math.max(r.gap,0)*n),e.uniform1f(l.uniforms.uCornerPx,Math.max(r.cornerRadius,0)*n),e.uniform1f(l.uniforms.uLiftPx,Math.max(r.liftHeight,0)*n),e.uniform1f(l.uniforms.uPersp,Math.max(r.perspective,100)*n),e.uniform2f(l.uniforms.uVanish,(.5+(D-.5)*r.tilt)*o.width,(.5+(.5-F)*r.tilt)*o.height),e.uniform1f(l.uniforms.uShading,r.shading),e.uniform3f(l.uniforms.uTint,r.tint[0],r.tint[1],r.tint[2]),e.uniform1f(l.uniforms.uTintStrength,r.tintStrength),e.uniform1f(l.uniforms.uMaxX,$),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,o.width,o.height),e.drawArrays(e.TRIANGLE_STRIP,0,4)}let q=0,k=performance.now(),j=!1,G=!1,z=!0,W=window.matchMedia("(prefers-reduced-motion: reduce)"),P=W.matches;function te(t){if(j)return;if(!z){G=!1;return}let a=Math.min((t-k)/1e3,1/30);k=t;let n=P?0:he(a);Te(n,a);let i=Math.abs(D-y)+Math.abs(F-X)>.001;if(!(!P&&(n>0||r.idleRipples>0||i))&&!w){G=!1;return}q=requestAnimationFrame(te)}function m(){j||G||!z||(G=!0,k=performance.now(),q=requestAnimationFrame(te))}V=m,m();function ie(){P=W.matches,P&&(s.length=0),m()}W.addEventListener("change",ie);let Y=new ResizeObserver(()=>{N(),m()});Y.observe(o),Y.observe(B);let ne=new IntersectionObserver(t=>{var a,n;z=(n=(a=t[t.length-1])==null?void 0:a.isIntersecting)!=null?n:!0,z&&m()});ne.observe(o);let O=(le=o.parentElement)!=null?le:o,re=ue(o);function ae(t){if(P)return;let a=re.current,n=Math.max(a.width,1)/Math.max(a.height,1),i=(t.clientX-a.left)/Math.max(a.width,1),u=(t.clientY-a.top)/Math.max(a.height,1);y=i,X=u;let S=i*n,v=1-u,p=.2;if(I){let xe=S-I.x,ve=v-I.y;if(p=Math.hypot(xe,ve),p<pe){m();return}}ee({x:S,y:v,age:0,strength:Math.min(Math.max(p*6,.25),1.2)}),I={x:S,y:v},H=0,C=0,m()}function oe(){y=.5,X=.5,m()}return O.addEventListener("pointermove",ae,{passive:!0}),O.addEventListener("pointerleave",oe,{passive:!0}),{setOptions(t){Object.entries(t).some(([a,n])=>r[a]!==n)&&(Object.assign(r,t),m())},resize(){N(),m()},destroy(){j=!0,re.destroy(),cancelAnimationFrame(q),Y.disconnect(),ne.disconnect(),W.removeEventListener("change",ie),O.removeEventListener("pointermove",ae),O.removeEventListener("pointerleave",oe),e.deleteTexture(L),e.deleteTexture(U),d&&e.deleteTexture(d),x&&e.deleteFramebuffer(x);for(let t of[l,c])e.deleteProgram(t.program),e.deleteShader(t.vertexShader),e.deleteShader(t.fragmentShader);e.deleteBuffer(Q),g&&(A.onpaint=null)}}}window.CanvasGrid={createGrid:ce,supportsHtmlInCanvas:fe};})();
