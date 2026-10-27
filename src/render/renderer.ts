// Rendu WebGL 2 de la scène : capsules instanciées sur fond transparent.

import { createCamera, STAGE_WORLD_HEIGHT } from './camera';
import type { Rgba } from './color';
import { FLOATS_PER_CAPSULE, packCapsules, type Capsule } from './scene';
import fragmentSource from './shaders/capsule.frag.glsl?raw';
import vertexSource from './shaders/capsule.vert.glsl?raw';

export class WebGLUnavailableError extends Error {
  override name = 'WebGLUnavailableError';
}

/** Un groupe de capsules d'une même couleur. Les couches sont dessinées dans l'ordre. */
export interface DrawLayer {
  capsules: readonly Capsule[];
  color: Rgba;
}

export interface StageRenderer {
  /** Dessine les couches à la taille actuelle du canvas (`canvas.width` × `canvas.height`). */
  draw(layers: readonly DrawLayer[]): void;
  destroy(): void;
}

export interface StageRendererOptions {
  /** Appelé quand le contexte WebGL est restauré après une perte : il faut redessiner. */
  onContextRestored?: () => void;
}

/** Doit correspondre aux `layout(location = …)` de `capsule.vert.glsl`. */
const ATTRIBUTE = { corner: 0, start: 1, end: 2, radius: 3 } as const;
const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const QUAD_CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

interface GpuResources {
  program: WebGLProgram;
  vertexArray: WebGLVertexArrayObject;
  cornerBuffer: WebGLBuffer;
  instanceBuffer: WebGLBuffer;
  uniforms: {
    viewProjection: WebGLUniformLocation | null;
    pixelsPerUnit: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
  };
}

export function createStageRenderer(canvas: HTMLCanvasElement, options: StageRendererOptions = {}): StageRenderer {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) throw new WebGLUnavailableError("WebGL 2 n'est pas disponible dans ce navigateur.");

  let resources: GpuResources | null = createResources(gl);

  const onLost = (event: Event): void => {
    event.preventDefault();
    resources = null;
  };
  const onRestored = (): void => {
    resources = createResources(gl);
    options.onContextRestored?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    draw(layers) {
      const { width, height } = canvas;
      if (!resources || width === 0 || height === 0) return;

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const camera = createCamera({ width, height }, STAGE_WORLD_HEIGHT);
      const { program, vertexArray, instanceBuffer, uniforms } = resources;

      gl.useProgram(program);
      gl.uniformMatrix3fv(uniforms.viewProjection, false, camera.viewProjection);
      gl.uniform1f(uniforms.pixelsPerUnit, camera.pixelsPerUnit);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(vertexArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);

      for (const { capsules, color } of layers) {
        if (capsules.length === 0) continue;
        gl.uniform4fv(uniforms.color, color);
        gl.bufferData(gl.ARRAY_BUFFER, packCapsules(capsules), gl.DYNAMIC_DRAW);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, capsules.length);
      }

      gl.bindVertexArray(null);
    },
    destroy() {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (resources) {
        gl.deleteProgram(resources.program);
        gl.deleteVertexArray(resources.vertexArray);
        gl.deleteBuffer(resources.cornerBuffer);
        gl.deleteBuffer(resources.instanceBuffer);
        resources = null;
      }
    },
  };
}

function createResources(gl: WebGL2RenderingContext): GpuResources {
  const program = linkProgram(gl, vertexSource, fragmentSource);

  const vertexArray = gl.createVertexArray();
  const cornerBuffer = gl.createBuffer();
  const instanceBuffer = gl.createBuffer();
  gl.bindVertexArray(vertexArray);

  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(ATTRIBUTE.corner);
  gl.vertexAttribPointer(ATTRIBUTE.corner, 2, gl.FLOAT, false, 0, 0);

  // Disposition par instance : [départ.x, départ.y, arrivée.x, arrivée.y, rayon] (voir scene.ts).
  const stride = FLOATS_PER_CAPSULE * FLOAT_BYTES;
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  const instanceAttributes: Array<[location: number, size: number, offset: number]> = [
    [ATTRIBUTE.start, 2, 0],
    [ATTRIBUTE.end, 2, 2],
    [ATTRIBUTE.radius, 1, 4],
  ];
  for (const [location, size, offset] of instanceAttributes) {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * FLOAT_BYTES);
    gl.vertexAttribDivisor(location, 1);
  }

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return {
    program,
    vertexArray,
    cornerBuffer,
    instanceBuffer,
    uniforms: {
      viewProjection: gl.getUniformLocation(program, 'u_viewProjection'),
      pixelsPerUnit: gl.getUniformLocation(program, 'u_pixelsPerUnit'),
      color: gl.getUniformLocation(program, 'u_color'),
    },
  };
}

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Impossible de créer le shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Échec de compilation du shader : ${log ?? ''}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertex);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Échec de liaison du programme : ${log ?? ''}`);
  }
  return program;
}
