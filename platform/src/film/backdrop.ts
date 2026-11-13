import { hexToRgb } from './looks'

/**
 * The air behind the film: slow smoke drawn by a small WebGL shader. Colours
 * drift when the mood changes, snap when a playful scene cuts to a flat
 * colour, and swell slightly with the music. Without WebGL, the CSS gradient
 * under the canvas shows instead.
 */

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
const FRAG = `
precision mediump float;
uniform vec2 r;uniform float t;uniform vec3 a;uniform vec3 b;uniform vec3 c;uniform float pulse;uniform float flat;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,s=.5;for(int i=0;i<5;i++){v+=s*n(p);p=p*2.03+vec2(1.7,9.2);s*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r;vec2 q=uv;q.x*=r.x/r.y;
  float w=fbm(q*1.5+vec2(t*.035,-t*.02));
  float m=fbm(q*2.1+w*1.6+vec2(-t*.025,t*.03));
  vec3 col=mix(a,b,smoothstep(.25,.8,m));
  float hot=pow(smoothstep(.5,.95,m*(.6+w)),1.6);
  col=mix(col,c,hot*(.42+.3*pulse));
  float v=smoothstep(1.15,.2,length((uv-.5)*vec2(1.25,1.5)));
  col*=mix(.5,1.,v);
  col=mix(col,b,flat);
  gl_FragColor=vec4(col,1.);
}`

type Rgb = [number, number, number]

export class Backdrop {
  ok = false
  private gl: WebGLRenderingContext | null = null
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private from: Rgb[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  private to: Rgb[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  private now: Rgb[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  private mix = 1
  private flatTo = 0
  private flat = 0
  private time = 0
  private last = 0
  private frame = 0
  private paused = false
  pulse = 0
  still = false

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) return
    const program = gl.createProgram()
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      gl.attachShader(program, shader)
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS)
    }
    if (!compile(gl.VERTEX_SHADER, VERT) || !compile(gl.FRAGMENT_SHADER, FRAG)) return
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(program, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    for (const name of ['r', 't', 'a', 'b', 'c', 'pulse', 'flat']) this.uniforms[name] = gl.getUniformLocation(program, name)
    this.gl = gl
    this.ok = true
    canvas.addEventListener('webglcontextlost', () => {
      this.ok = false
      canvas.style.display = 'none'
    })
  }

  /** Drift to a smoky palette, or `flat` to one solid colour. `cut` skips the drift. */
  set(colors: { a: string; b: string; c: string }, options: { flat?: boolean; cut?: boolean } = {}) {
    this.from = this.now.map((v) => [...v] as Rgb)
    this.to = [hexToRgb(colors.a), hexToRgb(colors.b), hexToRgb(colors.c)]
    this.mix = options.cut ? 1 : 0
    this.flatTo = options.flat ? 1 : 0
    if (options.cut) {
      this.flat = this.flatTo
      this.now = this.to.map((v) => [...v] as Rgb)
    }
  }

  start() {
    if (!this.ok || this.frame) return
    this.last = performance.now()
    const tick = (now: number) => {
      this.frame = requestAnimationFrame(tick)
      const dt = Math.min(0.1, (now - this.last) / 1000)
      this.last = now
      if (!this.paused && !this.still) this.time += dt
      this.draw(dt)
    }
    this.frame = requestAnimationFrame(tick)
  }

  setPaused(paused: boolean) {
    this.paused = paused
  }

  stop() {
    cancelAnimationFrame(this.frame)
    this.frame = 0
  }

  private draw(dt: number) {
    const gl = this.gl
    if (!gl || !this.ok) return
    // Half resolution: smoke has no fine detail, and phones stay cool.
    const width = Math.max(2, Math.round(this.canvas.clientWidth / 2))
    const height = Math.max(2, Math.round(this.canvas.clientHeight / 2))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      gl.viewport(0, 0, width, height)
    }
    if (this.mix < 1) {
      this.mix = Math.min(1, this.mix + dt / 1.6)
      const k = this.mix * this.mix * (3 - 2 * this.mix)
      this.now = this.from.map((f, i) => f.map((v, j) => v + (this.to[i][j] - v) * k) as Rgb)
    }
    this.flat += (this.flatTo - this.flat) * Math.min(1, dt * 14)
    const u = this.uniforms
    gl.uniform2f(u.r, width, height)
    gl.uniform1f(u.t, this.time)
    gl.uniform3fv(u.a, this.now[0])
    gl.uniform3fv(u.b, this.now[1])
    gl.uniform3fv(u.c, this.now[2])
    gl.uniform1f(u.pulse, this.pulse)
    gl.uniform1f(u.flat, this.flat)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
