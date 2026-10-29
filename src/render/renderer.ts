// Rendu WebGL 2 de la scène : calque de dessin texturé, formes et capsules instanciées,
// dans l'ordre des couches, sur fond transparent ou coloré.

import type { PixelRect } from '../model/drawing-layer';
import { createCamera } from './camera';
import type { Rgba } from './color';
import { FLOATS_PER_CAPSULE, FLOATS_PER_SHAPE, packCapsules, packShapes } from './scene';
import type { SceneLayer } from './scene-layers';
import capsuleFragment from './shaders/capsule.frag.glsl?raw';
import capsuleVertex from './shaders/capsule.vert.glsl?raw';
import imageFragment from './shaders/image.frag.glsl?raw';
import imageVertex from './shaders/image.vert.glsl?raw';
import shapeFragment from './shaders/shape.frag.glsl?raw';
import shapeVertex from './shaders/shape.vert.glsl?raw';

export class WebGLUnavailableError extends Error {
  override name = 'WebGLUnavailableError';
}

/** Image du calque de dessin et zone à renvoyer au GPU depuis la dernière fois. */
export interface DrawingSource {
  canvas: TexImageSource & { width: number; height: number };
  /** Rectangle du calque dans le monde (coin bas-gauche, taille). */
  bounds: { x: number; y: number; width: number; height: number };
  /** Zone modifiée depuis le dernier appel (puis l'oublie) ; `null` si rien n'a changé. */
  takeDirty(): PixelRect | null;
  /** Repart de zéro : tout le calque est à renvoyer (contexte restauré). */
  markAllDirty(): void;
}

export interface DrawOptions {
  /** Fond opaque ; `null` laisse voir la page sous le canvas. */
  background: Rgba | null;
  drawing: DrawingSource | null;
  /** Hauteur du monde montrée (cadre du format et sa marge). */
  worldHeight: number;
}

export interface StageRenderer {
  /** Dessine les couches à la taille actuelle du canvas (`canvas.width` × `canvas.height`). */
  draw(layers: readonly SceneLayer[], options: DrawOptions): void;
  /** Couleur affichée au pixel (x, y) du canvas (pixels physiques, origine en haut à gauche). */
  readPixel(x: number, y: number): Rgba | null;
  destroy(): void;
}

export interface StageRendererOptions {
  /** Appelé quand le contexte WebGL est restauré après une perte : il faut redessiner. */
  onContextRestored?: () => void;
}

/** Doit correspondre aux `layout(location = …)` des shaders. */
const CAPSULE_ATTRIBUTES: ReadonlyArray<[location: number, size: number, offset: number]> = [
  [1, 2, 0], // départ
  [2, 2, 2], // arrivée
  [3, 1, 4], // rayon
  [4, 4, 5], // couleur
  [5, 4, 9], // axe de découpe (départ, arrivée)
  [6, 2, 13], // tranche gardée (de, à)
];
const SHAPE_ATTRIBUTES: ReadonlyArray<[location: number, size: number, offset: number]> = [
  [1, 2, 0], // centre
  [2, 2, 2], // demi-taille
  [3, 1, 4], // rotation
  [4, 1, 5], // sorte
  [5, 1, 6], // épaisseur
  [6, 4, 7], // remplissage
  [7, 4, 11], // contour
];
const CORNER_LOCATION = 0;
const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;
const QUAD_CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

interface Program {
  program: WebGLProgram;
  vertexArray: WebGLVertexArrayObject;
  instanceBuffer: WebGLBuffer | null;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

interface GpuResources {
  cornerBuffer: WebGLBuffer;
  capsules: Program;
  shapes: Program;
  image: Program;
  texture: WebGLTexture;
  /** Taille de la texture allouée ; 0 tant qu'aucun calque n'y a été chargé. */
  textureSize: { width: number; height: number };
}

export function createStageRenderer(canvas: HTMLCanvasElement, options: StageRendererOptions = {}): StageRenderer {
  const context = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!context) throw new WebGLUnavailableError("WebGL 2 n'est pas disponible dans ce navigateur.");
  const gl: WebGL2RenderingContext = context;

  let resources: GpuResources | null = createResources(gl);
  let last: { layers: readonly SceneLayer[]; options: DrawOptions } | null = null;

  const onLost = (event: Event): void => {
    event.preventDefault();
    resources = null;
  };
  const onRestored = (): void => {
    resources = createResources(gl);
    last?.options.drawing?.markAllDirty();
    options.onContextRestored?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  function draw(layers: readonly SceneLayer[], drawOptions: DrawOptions): void {
    last = { layers, options: drawOptions };
    const { width, height } = canvas;
    if (!resources || width === 0 || height === 0) return;
    const gpu = resources;

    gl.viewport(0, 0, width, height);
    const [r, g, b, a] = drawOptions.background ?? [0, 0, 0, 0];
    gl.clearColor(r * a, g * a, b * a, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const camera = createCamera({ width, height }, drawOptions.worldHeight);
    const use = (program: Program): void => {
      gl.useProgram(program.program);
      gl.uniformMatrix3fv(program.uniforms.viewProjection ?? null, false, camera.viewProjection);
      gl.uniform1f(program.uniforms.pixelsPerUnit ?? null, camera.pixelsPerUnit);
      gl.bindVertexArray(program.vertexArray);
    };

    for (const layer of layers) {
      if (layer.kind === 'drawing') {
        const source = drawOptions.drawing;
        if (!source || layer.opacity <= 0) continue;
        uploadDrawing(gl, gpu, source);
        use(gpu.image);
        const { x, y, width: w, height: h } = source.bounds;
        gl.uniform4f(gpu.image.uniforms.bounds ?? null, x, y, w, h);
        gl.uniform1f(gpu.image.uniforms.opacity ?? null, layer.opacity);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
        gl.uniform1i(gpu.image.uniforms.image ?? null, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      } else if (layer.kind === 'shapes') {
        if (layer.shapes.length === 0) continue;
        use(gpu.shapes);
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.shapes.instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, packShapes(layer.shapes), gl.DYNAMIC_DRAW);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, layer.shapes.length);
      } else {
        if (layer.capsules.length === 0) continue;
        use(gpu.capsules);
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.capsules.instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, packCapsules(layer.capsules), gl.DYNAMIC_DRAW);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, layer.capsules.length);
      }
    }
    gl.bindVertexArray(null);
  }

  return {
    draw,
    readPixel(x, y) {
      // Le tampon n'est pas conservé entre deux images : on redessine, puis on lit tout de suite.
      if (!resources || !last) return null;
      draw(last.layers, last.options);
      const pixel = new Uint8Array(4);
      gl.readPixels(Math.floor(x), canvas.height - 1 - Math.floor(y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const [r = 0, g = 0, b = 0, a = 0] = pixel;
      // Sortie prémultipliée : on retrouve la couleur d'origine.
      return a === 0 ? [0, 0, 0, 0] : [r / a, g / a, b / a, a / 255];
    },
    destroy() {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (resources) {
        for (const program of [resources.capsules, resources.shapes, resources.image]) {
          gl.deleteProgram(program.program);
          gl.deleteVertexArray(program.vertexArray);
          if (program.instanceBuffer) gl.deleteBuffer(program.instanceBuffer);
        }
        gl.deleteBuffer(resources.cornerBuffer);
        gl.deleteTexture(resources.texture);
        resources = null;
      }
      // Rend le contexte au navigateur tout de suite (il en limite le nombre), sans attendre le ramasse-miettes.
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/** Renvoie au GPU la zone modifiée du calque de dessin (tout le calque la première fois). */
function uploadDrawing(gl: WebGL2RenderingContext, gpu: GpuResources, source: DrawingSource): void {
  const { width, height } = source.canvas;
  gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  if (gpu.textureSize.width !== width || gpu.textureSize.height !== height) {
    source.takeDirty();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.canvas);
    gpu.textureSize = { width, height };
    return;
  }
  const dirty = source.takeDirty();
  if (!dirty) return;
  // Seule la zone modifiée est copiée (un trait ne touche qu'une petite partie du calque).
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, dirty.x);
  gl.pixelStorei(gl.UNPACK_SKIP_ROWS, dirty.y);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, width);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, dirty.x, dirty.y, dirty.width, dirty.height, gl.RGBA, gl.UNSIGNED_BYTE, source.canvas);
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
  gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
}

function createResources(gl: WebGL2RenderingContext): GpuResources {
  const cornerBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const resources: GpuResources = {
    cornerBuffer,
    capsules: createProgram(gl, cornerBuffer, capsuleVertex, capsuleFragment, CAPSULE_ATTRIBUTES, FLOATS_PER_CAPSULE, []),
    shapes: createProgram(gl, cornerBuffer, shapeVertex, shapeFragment, SHAPE_ATTRIBUTES, FLOATS_PER_SHAPE, []),
    image: createProgram(gl, cornerBuffer, imageVertex, imageFragment, [], 0, ['bounds', 'opacity', 'image']),
    texture,
    textureSize: { width: 0, height: 0 },
  };
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return resources;
}

/** Programme dessinant un quad par instance ; `floatsPerInstance` à 0 = un seul quad, sans instances. */
function createProgram(
  gl: WebGL2RenderingContext,
  cornerBuffer: WebGLBuffer,
  vertex: string,
  fragment: string,
  attributes: ReadonlyArray<[location: number, size: number, offset: number]>,
  floatsPerInstance: number,
  extraUniforms: readonly string[],
): Program {
  const program = linkProgram(gl, vertex, fragment);
  const vertexArray = gl.createVertexArray();
  gl.bindVertexArray(vertexArray);

  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.enableVertexAttribArray(CORNER_LOCATION);
  gl.vertexAttribPointer(CORNER_LOCATION, 2, gl.FLOAT, false, 0, 0);

  let instanceBuffer: WebGLBuffer | null = null;
  if (floatsPerInstance > 0) {
    instanceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
    const stride = floatsPerInstance * FLOAT_BYTES;
    for (const [location, size, offset] of attributes) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset * FLOAT_BYTES);
      gl.vertexAttribDivisor(location, 1);
    }
  }

  const uniforms: Record<string, WebGLUniformLocation | null> = {
    viewProjection: gl.getUniformLocation(program, 'u_viewProjection'),
    pixelsPerUnit: gl.getUniformLocation(program, 'u_pixelsPerUnit'),
  };
  for (const name of extraUniforms) uniforms[name] = gl.getUniformLocation(program, `u_${name}`);
  return { program, vertexArray, instanceBuffer, uniforms };
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
