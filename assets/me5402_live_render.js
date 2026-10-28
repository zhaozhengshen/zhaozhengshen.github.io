/* ME5402 online-replanning replay renderer: the WebGL2 mesh renderer of the ATELIER / LIVE experiment
   (source: atelier_live/mesh_viewer.js), unchanged except for the entry point:
   window.initLiveRender(canvas, notice) is called lazily by me5402_live.js once the mesh data has loaded.
   Original MuJoCo visual meshes (UR5e, Robotiq 2F-85), full joint poses, depth and shadow maps; no CDN. */
window.initLiveRender=function(canvas,notice){'use strict';
const L=window.SITE.L,asset=window.LAB_MESH,gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});
if(!gl){canvas.style.display='none';notice.textContent=L('This browser cannot create a WebGL2 context; the recorded videos below still play.','当前浏览器无法创建 WebGL2 上下文；下方录制的视频仍可播放。');return {draw(){},available:false}}
const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;layout(location=1) in vec3 normal;
uniform mat4 model,viewProjection,lightProjection;
out vec3 worldPos,worldNormal;out vec4 lightPos;
void main(){vec4 p=model*vec4(position,1.);worldPos=p.xyz;worldNormal=normalize(mat3(transpose(inverse(model)))*normal);lightPos=lightProjection*p;gl_Position=viewProjection*p;}`;
const FS=`#version 300 es
precision highp float;
in vec3 worldPos,worldNormal;in vec4 lightPos;out vec4 fragColor;
uniform vec4 color;uniform vec3 eye;uniform float gloss,emission;uniform sampler2D shadowMap;
float visibility(vec3 n,vec3 l){vec3 p=lightPos.xyz/lightPos.w*.5+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;float bias=max(.0006,.0018*(1.-dot(n,l)));float v=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float d=texture(shadowMap,p.xy+vec2(x,y)/2048.).r;v+=p.z-bias>d?.32:1.;}return v/9.;}
vec3 aces(vec3 c){return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);}
void main(){vec3 n=normalize(worldNormal);if(!gl_FrontFacing)n=-n;vec3 l=normalize(vec3(-1.3,-1.1,2.8)-worldPos),v=normalize(eye-worldPos);float shadow=visibility(n,l);vec3 base=pow(color.rgb,vec3(2.2));float hemi=.36+.26*max(n.z,0.);float key=max(dot(n,l),0.)*shadow;float rim=max(dot(n,normalize(vec3(1.,1.5,1.3))),0.);float spec=pow(max(dot(n,normalize(l+v)),0.),mix(22.,135.,gloss));vec3 c=base*(vec3(hemi)+key*vec3(2.,1.87,1.7)+rim*vec3(.30,.64,.95))+vec3(spec*shadow*(.22+gloss*.7))+base*emission;c=pow(aces(c),vec3(1./2.2));float fog=1.-exp(-length(eye-worldPos)*.025);c=mix(c,vec3(.035,.065,.10),fog);fragColor=vec4(c,color.a);}`;
const DVS=`#version 300 es
layout(location=0) in vec3 position;uniform mat4 model,viewProjection;void main(){gl_Position=viewProjection*model*vec4(position,1.);}`;
const DFS=`#version 300 es
precision highp float;void main(){}`;
function program(v,f){function shader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}let p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,v));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));let u={};for(let n of ['model','viewProjection','lightProjection','color','eye','gloss','emission','shadowMap'])u[n]=gl.getUniformLocation(p,n);return {p,u}}
const main=program(VS,FS),depth=program(DVS,DFS);
function floats(b){const s=atob(b),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return new Float32Array(a.buffer)}
function buffer(data,count){let vao=gl.createVertexArray();gl.bindVertexArray(vao);let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);return {vao,count}}
const meshes={};for(let [id,m] of Object.entries(asset.meshes))meshes[id]=buffer(floats(m.data),m.count);
const cube=[];for(let [n,a,b] of [[[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[0,0,1],[1,0,0]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[0,1,0],[1,0,0]]]){let p=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>n.map((v,i)=>v+x*a[i]+y*b[i]));for(let j of [0,1,2,0,2,3])cube.push(...p[j],...n)}
meshes.box=buffer(new Float32Array(cube),36);
function mult(a,b){let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function transform(pos,q,scale=[1,1,1]){let [w,x,y,z]=q;return new Float32Array([(1-2*y*y-2*z*z)*scale[0],(2*x*y+2*w*z)*scale[0],(2*x*z-2*w*y)*scale[0],0,(2*x*y-2*w*z)*scale[1],(1-2*x*x-2*z*z)*scale[1],(2*y*z+2*w*x)*scale[1],0,(2*x*z+2*w*y)*scale[2],(2*y*z-2*w*x)*scale[2],(1-2*x*x-2*y*y)*scale[2],0,...pos,1])}
function sub(a,b){return a.map((x,i)=>x-b[i])}function dot(a,b){return a.reduce((v,x,i)=>v+x*b[i],0)}function norm(a){let n=Math.hypot(...a);return a.map(x=>x/n)}function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function look(eye,target){let z=norm(sub(eye,target)),x=norm(cross([0,0,1],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1])}
function perspective(aspect){let f=1/Math.tan(41*Math.PI/360),n=.02,z=15;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(z+n)/(n-z),-1,0,0,2*z*n/(n-z),0])}
function ortho(){let s=1.2,n=.1,f=5;return new Float32Array([1/s,0,0,0,0,1/s,0,0,0,0,-2/(f-n),0,0,0,-(f+n)/(f-n),1])}
const lightProjection=mult(ortho(),look([-1.3,-1.1,2.8],[.38,0,.25]));
const shadow=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadow);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,2048,2048,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadow,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Shadow framebuffer is incomplete');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
const poses={};for(let [k,p] of Object.entries(asset.poses))poses[k]=floats(p.data);
const local={};for(let [seed,l] of Object.entries(asset.layouts))local[seed]=l.geoms.map(g=>({...g,local:transform(g.pos,g.quat,g.type===7?[1,1,1]:g.type===0?[4,4,.002]:g.size)}));
function interpolate(a,b,t){let d=dot(a,b)<0?-1:1;return norm(a.map((v,i)=>v*(1-t)+b[i]*t*d))}
function draw(record,index,o){const key=record.seed+'_'+record.method,p=poses[key],n=asset.layouts[record.seed].bodies,count=asset.poses[key].frames,i=Math.min(count-1,Math.floor(index)),j=Math.min(count-1,i+1),t=index-i,body=[];
 for(let k=0;k<n;k++){let a=(i*n+k)*7,b=(j*n+k)*7;let pos=[0,1,2].map(h=>p[a+h]*(1-t)+p[b+h]*t),q=interpolate(Array.from(p.slice(a+3,a+7)),Array.from(p.slice(b+3,b+7)),t);body.push(transform(pos,q))}
 const el=Math.min(1.565,o.elevation),angle=o.yaw-.43,d=(o.focus!=null?.62:2.45)/o.zoom,target=o.focus!=null?record.walls[o.focus].pos:[.38,0,.36],eye=[target[0]+d*Math.cos(angle)*Math.cos(el),target[1]+d*Math.sin(angle)*Math.cos(el),target[2]+d*Math.sin(el)];
 let ratio=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
 const vp=mult(perspective(w/h),look(eye,target)),opaque=[],glass=[];
 for(let g of local[record.seed]){if(o.searchMode&&g.body!==0)continue;let m=mult(body[g.body],g.local),c=g.rgba.slice(),emission=0;
  if(asset.profile!=='atelier'&&g.name.startsWith('maze_')){c=[.22,.48,.60,o.opacity/100]}
  if(g.name.startsWith('edge_')){c=[.18,.83,.91,1];emission=.7}
  let item={m,c,mesh:g.type===7?meshes[g.mesh]:meshes.box,gloss:g.shininess,emission};(c[3]<.99?glass:opaque).push(item)
 }
 function marker(pos,size,color){opaque.push({m:transform(pos,[1,0,0,0],size),c:color,mesh:meshes.box,gloss:.1,emission:.4})}
 if(o.searchMode){let b=window.LAB_DATA.find(r=>r.seed===record.seed&&r.method==='baseline'),sp=o.searchMethod==='astar'?b.plan:b.dijkstra;for(let [x,y] of sp.visited.slice(0,Math.floor(o.searchIndex)))marker([.25+x*.12,-.36+y*.18,.004],[.042,.068,.002],[.10,.47,.70,1])}
 function segment(a,b,color){let dif=sub(b,a),length=Math.hypot(...dif);if(length<1e-7)return;let z=norm(dif),q=norm([1+z[2],-z[1],z[0],0]);opaque.push({m:transform(a.map((x,i)=>(x+b[i])/2),q,[.0015,.0015,length/2]),c:color,mesh:meshes.box,gloss:.1,emission:.6})}
 if(!o.searchMode&&o.showTrail!==false){let path=record.plan.xyz;for(let k=1;k<path.length;k++)segment([path[k-1][0],path[k-1][1],.005],[path[k][0],path[k][1],.005],[1,.65,.22,1]);let trace=record.trace.slice(0,i+1).filter(s=>s.stage==='CARRY');for(let k=3;k<trace.length;k+=3)segment(trace[k-3].object,trace[k].object,[.22,.93,.72,1])}
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.depthMask(true);
 gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.viewport(0,0,2048,2048);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(depth.p);gl.uniformMatrix4fv(depth.u.viewProjection,false,lightProjection);
 for(let it of opaque){gl.uniformMatrix4fv(depth.u.model,false,it.m);gl.bindVertexArray(it.mesh.vao);gl.drawArrays(gl.TRIANGLES,0,it.mesh.count)}
 gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.clearColor(.035,.06,.09,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(main.p);gl.uniformMatrix4fv(main.u.viewProjection,false,vp);gl.uniformMatrix4fv(main.u.lightProjection,false,lightProjection);gl.uniform3fv(main.u.eye,eye);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadow);gl.uniform1i(main.u.shadowMap,0);
 function paint(it){gl.uniformMatrix4fv(main.u.model,false,it.m);gl.uniform4fv(main.u.color,it.c);gl.uniform1f(main.u.gloss,it.gloss);gl.uniform1f(main.u.emission,it.emission);gl.bindVertexArray(it.mesh.vao);gl.drawArrays(gl.TRIANGLES,0,it.mesh.count)}
 opaque.forEach(paint);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
 glass.sort((a,b)=>Math.hypot(b.m[12]-eye[0],b.m[13]-eye[1],b.m[14]-eye[2])-Math.hypot(a.m[12]-eye[0],a.m[13]-eye[1],a.m[14]-eye[2]));glass.forEach(paint);gl.depthMask(true);gl.disable(gl.BLEND);
}
notice.textContent=L(`Original meshes · ${asset.triangles.toLocaleString()} triangles · real-time shadows · full joint replay`,`原始模型 · ${asset.triangles.toLocaleString()} 个三角面 · 实时阴影 · 全关节回放`);
return {draw,available:true,triangles:asset.triangles};
};
