import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import {
  GLASS_FINISH_SPECS,
  type GlassFinishId,
  type CameraPresetId,
  type GlyphWordId,
  type LedgerEntryItem,
} from '../utils/ledgerLogic';

// Pre-allocated scratch math objects at module scope (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();

export interface GlassTypoScene3DProps {
  glyphWord: GlyphWordId;
  glassFinish: GlassFinishId;
  explodedAmount: number; // 0 to 100
  cameraPreset: CameraPresetId;
  entries: LedgerEntryItem[];
  onSelectGlyphOrShard?: (info: string) => void;
}

// Procedural 2D vector glyph builder for beveled 3D Glass Typography
function createGlyphShape(letter: string): THREE.Shape {
  const s = new THREE.Shape();
  const w = 1.1;
  const h = 1.65;
  const t = 0.28;

  switch (letter.toUpperCase()) {
    case 'A': {
      s.moveTo(-w * 0.5, -h * 0.5);
      s.lineTo(-w * 0.14, h * 0.5);
      s.lineTo(w * 0.14, h * 0.5);
      s.lineTo(w * 0.5, -h * 0.5);
      s.lineTo(w * 0.22, -h * 0.5);
      s.lineTo(w * 0.13, -h * 0.16);
      s.lineTo(-w * 0.13, -h * 0.16);
      s.lineTo(-w * 0.22, -h * 0.5);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(-w * 0.08, 0.06);
      hole.lineTo(0, h * 0.28);
      hole.lineTo(w * 0.08, 0.06);
      hole.closePath();
      s.holes.push(hole);
      break;
    }
    case 'P': {
      s.moveTo(-w * 0.45, -h * 0.5);
      s.lineTo(-w * 0.45, h * 0.5);
      s.lineTo(w * 0.2, h * 0.5);
      s.absarc(w * 0.2, h * 0.18, h * 0.32, Math.PI * 0.5, -Math.PI * 0.5, true);
      s.lineTo(-w * 0.15, -h * 0.14);
      s.lineTo(-w * 0.15, -h * 0.5);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(-w * 0.15, h * 0.08);
      hole.lineTo(-w * 0.15, h * 0.28);
      hole.lineTo(w * 0.15, h * 0.28);
      hole.absarc(w * 0.15, h * 0.18, h * 0.1, Math.PI * 0.5, -Math.PI * 0.5, true);
      hole.closePath();
      s.holes.push(hole);
      break;
    }
    case 'E': {
      s.moveTo(-w * 0.45, -h * 0.5);
      s.lineTo(-w * 0.45, h * 0.5);
      s.lineTo(w * 0.45, h * 0.5);
      s.lineTo(w * 0.45, h * 0.5 - t);
      s.lineTo(-w * 0.45 + t, h * 0.5 - t);
      s.lineTo(-w * 0.45 + t, t * 0.45);
      s.lineTo(w * 0.32, t * 0.45);
      s.lineTo(w * 0.32, -t * 0.45);
      s.lineTo(-w * 0.45 + t, -t * 0.45);
      s.lineTo(-w * 0.45 + t, -h * 0.5 + t);
      s.lineTo(w * 0.45, -h * 0.5 + t);
      s.lineTo(w * 0.45, -h * 0.5);
      s.closePath();
      break;
    }
    case 'X': {
      s.moveTo(-w * 0.48, -h * 0.5);
      s.lineTo(-w * 0.16, 0);
      s.lineTo(-w * 0.48, h * 0.5);
      s.lineTo(-w * 0.18, h * 0.5);
      s.lineTo(0, h * 0.18);
      s.lineTo(w * 0.18, h * 0.5);
      s.lineTo(w * 0.48, h * 0.5);
      s.lineTo(w * 0.16, 0);
      s.lineTo(w * 0.48, -h * 0.5);
      s.lineTo(w * 0.18, -h * 0.5);
      s.lineTo(0, -h * 0.18);
      s.lineTo(-w * 0.18, -h * 0.5);
      s.closePath();
      break;
    }
    case 'V': {
      s.moveTo(-w * 0.5, h * 0.5);
      s.lineTo(-w * 0.2, h * 0.5);
      s.lineTo(0, -h * 0.18);
      s.lineTo(w * 0.2, h * 0.5);
      s.lineTo(w * 0.5, h * 0.5);
      s.lineTo(w * 0.14, -h * 0.5);
      s.lineTo(-w * 0.14, -h * 0.5);
      s.closePath();
      break;
    }
    case 'U': {
      s.moveTo(-w * 0.46, h * 0.5);
      s.lineTo(-w * 0.18, h * 0.5);
      s.lineTo(-w * 0.18, -h * 0.16);
      s.absarc(0, -h * 0.16, w * 0.18, Math.PI, 0, false);
      s.lineTo(w * 0.18, h * 0.5);
      s.lineTo(w * 0.46, h * 0.5);
      s.lineTo(w * 0.46, -h * 0.16);
      s.absarc(0, -h * 0.16, w * 0.46, 0, Math.PI, true);
      s.closePath();
      break;
    }
    case 'L': {
      s.moveTo(-w * 0.42, -h * 0.5);
      s.lineTo(-w * 0.42, h * 0.5);
      s.lineTo(-w * 0.42 + t, h * 0.5);
      s.lineTo(-w * 0.42 + t, -h * 0.5 + t);
      s.lineTo(w * 0.42, -h * 0.5 + t);
      s.lineTo(w * 0.42, -h * 0.5);
      s.closePath();
      break;
    }
    case 'T': {
      s.moveTo(-w * 0.48, h * 0.5);
      s.lineTo(w * 0.48, h * 0.5);
      s.lineTo(w * 0.48, h * 0.5 - t);
      s.lineTo(t * 0.5, h * 0.5 - t);
      s.lineTo(t * 0.5, -h * 0.5);
      s.lineTo(-t * 0.5, -h * 0.5);
      s.lineTo(-t * 0.5, h * 0.5 - t);
      s.lineTo(-w * 0.48, h * 0.5 - t);
      s.closePath();
      break;
    }
    case 'Z': {
      s.moveTo(-w * 0.46, h * 0.5);
      s.lineTo(w * 0.46, h * 0.5);
      s.lineTo(w * 0.46, h * 0.5 - t * 0.85);
      s.lineTo(-w * 0.12, -h * 0.5 + t);
      s.lineTo(w * 0.46, -h * 0.5 + t);
      s.lineTo(w * 0.46, -h * 0.5);
      s.lineTo(-w * 0.46, -h * 0.5);
      s.lineTo(-w * 0.46, -h * 0.5 + t * 0.85);
      s.lineTo(w * 0.12, h * 0.5 - t);
      s.lineTo(-w * 0.46, h * 0.5 - t);
      s.closePath();
      break;
    }
    case 'R': {
      s.moveTo(-w * 0.45, -h * 0.5);
      s.lineTo(-w * 0.45, h * 0.5);
      s.lineTo(w * 0.16, h * 0.5);
      s.absarc(w * 0.16, h * 0.22, h * 0.28, Math.PI * 0.5, -Math.PI * 0.5, true);
      s.lineTo(w * 0.46, -h * 0.5);
      s.lineTo(w * 0.16, -h * 0.5);
      s.lineTo(-w * 0.05, -0.05);
      s.lineTo(-w * 0.16, -0.05);
      s.lineTo(-w * 0.16, -h * 0.5);
      s.closePath();

      const hole = new THREE.Path();
      hole.moveTo(-w * 0.16, h * 0.12);
      hole.lineTo(-w * 0.16, h * 0.3);
      hole.lineTo(w * 0.12, h * 0.3);
      hole.absarc(w * 0.12, h * 0.21, h * 0.09, Math.PI * 0.5, -Math.PI * 0.5, true);
      hole.closePath();
      s.holes.push(hole);
      break;
    }
    default: {
      // 'O'
      s.absarc(0, 0, w * 0.48, 0, Math.PI * 2, false);
      const hole = new THREE.Path();
      hole.absarc(0, 0, w * 0.22, 0, Math.PI * 2, true);
      s.holes.push(hole);
      break;
    }
  }
  return s;
}

function createProceduralDialTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 512);
    const cx = 256;
    const cy = 256;

    // Outer technical ring
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 236, 0, Math.PI * 2);
    ctx.stroke();

    // Inner ring
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 185, 0, Math.PI * 2);
    ctx.stroke();

    // Radial cryptographic ticks
    for (let i = 0; i < 72; i++) {
      const angle = (i / 72) * Math.PI * 2;
      const isMajor = i % 6 === 0;
      const r1 = isMajor ? 208 : 220;
      const r2 = 234;
      ctx.strokeStyle = isMajor ? 'rgba(173, 198, 255, 0.85)' : 'rgba(96, 165, 250, 0.4)';
      ctx.lineWidth = isMajor ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
      ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSoftContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
    grad.addColorStop(0, 'rgba(2, 6, 16, 0.85)');
    grad.addColorStop(0.55, 'rgba(4, 10, 24, 0.42)');
    grad.addColorStop(1, 'rgba(6, 11, 22, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBrushedBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 2) {
      const shade = 115 + ((y * 17) % 26);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(0, y, 128, 1);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

const CAMERA_PRESET_TARGETS: Record<
  CameraPresetId,
  { pos: [number, number, number]; look: [number, number, number] }
> = {
  orbit: { pos: [0, 0.75, 7.6], look: [0, 0.15, 0] },
  macro: { pos: [1.6, 0.45, 4.7], look: [0.2, 0.25, 0] },
  top: { pos: [0, 6.8, 2.2], look: [0, 0, 0] },
  isometric: { pos: [-5.4, 3.2, 5.8], look: [0, 0.1, 0] },
};

export function GlassTypoScene3D({
  glyphWord,
  glassFinish,
  explodedAmount,
  cameraPreset,
  entries,
  onSelectGlyphOrShard,
}: GlassTypoScene3DProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Store latest React props in refs so HUD updates never tear down the WebGLRenderer
  const stateRef = useRef({
    glyphWord,
    glassFinish,
    explodedTarget: explodedAmount / 100,
    cameraPreset,
    entries,
    onSelectGlyphOrShard,
  });

  const rebuildGlyphsRef = useRef<((word: GlyphWordId) => void) | null>(null);
  const applyGlassFinishRef = useRef<((finish: GlassFinishId) => void) | null>(null);
  const triggerCameraTransitionRef = useRef<((preset: CameraPresetId) => void) | null>(null);

  useEffect(() => {
    const prevWord = stateRef.current.glyphWord;
    const prevFinish = stateRef.current.glassFinish;
    const prevPreset = stateRef.current.cameraPreset;

    stateRef.current = {
      glyphWord,
      glassFinish,
      explodedTarget: explodedAmount / 100,
      cameraPreset,
      entries,
      onSelectGlyphOrShard,
    };

    if (prevWord !== glyphWord && rebuildGlyphsRef.current) {
      rebuildGlyphsRef.current(glyphWord);
    }
    if (prevFinish !== glassFinish && applyGlassFinishRef.current) {
      applyGlassFinishRef.current(glassFinish);
    }
    if (prevPreset !== cameraPreset && triggerCameraTransitionRef.current) {
      triggerCameraTransitionRef.current(cameraPreset);
    }
  }, [glyphWord, glassFinish, explodedAmount, cameraPreset, entries, onSelectGlyphOrShard]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Detect software WebGL (SwiftShader / llvmpipe) per threejs skill
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgHex = 0x060b16;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.032);

    // 2. Mandatory Studio Environment Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.75, 7.6);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.2;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.target.set(0, 0.15, 0);

    // Cancel scripted camera preset transition when user interacts manually
    let cameraTransitionActive = false;
    const desiredCamPos = new THREE.Vector3(0, 0.75, 7.6);
    const desiredCamLook = new THREE.Vector3(0, 0.15, 0);

    controls.addEventListener('start', () => {
      cameraTransitionActive = false;
    });

    triggerCameraTransitionRef.current = (preset: CameraPresetId) => {
      const cfg = CAMERA_PRESET_TARGETS[preset];
      desiredCamPos.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      desiredCamLook.set(cfg.look[0], cfg.look[1], cfg.look[2]);
      cameraTransitionActive = true;
    };

    // 3. Balanced 3-Point Studio Lighting Rig + Warm/Cool Contrast
    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x060e20, 1.15);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff2dd, 2.6);
    keyLight.position.set(6, 9, 7);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      const d = 7;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 25;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x3b82f6, 2.1);
    rimLight.position.set(-6, 4, -6);
    scene.add(rimLight);

    const accentPointLight = new THREE.PointLight(0x60a5fa, 2.2, 14, 2);
    accentPointLight.position.set(0, 0.4, 2.4);
    scene.add(accentPointLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softboxTop = new THREE.RectAreaLight(0xd8e8ff, 4.5, 6, 2);
      softboxTop.position.set(0, 4.8, 2.5);
      softboxTop.lookAt(0, 0.2, 0);
      scene.add(softboxTop);
    }

    // 4. Shared PBR Materials & Procedural Bump/Dial Textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const brushedBump = createBrushedBumpTexture();
    const dialTex = createProceduralDialTexture(maxAniso);
    const shadowTex = createSoftContactShadowTexture();

    const finishSpec = GLASS_FINISH_SPECS[stateRef.current.glassFinish];

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(finishSpec.colorHex),
      metalness: isSoftwareGl ? 0.18 : 0.04,
      roughness: finishSpec.roughness,
      transmission: isSoftwareGl ? 0 : 0.92,
      transparent: true,
      opacity: isSoftwareGl ? 0.68 : 1.0,
      ior: finishSpec.ior,
      thickness: 1.7,
      attenuationDistance: 2.2,
      attenuationColor: new THREE.Color(finishSpec.attenuationHex),
      clearcoat: finishSpec.clearcoat,
      clearcoatRoughness: 0.08,
      emissive: new THREE.Color(finishSpec.emissiveHex),
      emissiveIntensity: isSoftwareGl ? 0.55 : 0.32,
      envMapIntensity: 1.5,
      depthWrite: isSoftwareGl,
    });

    const coreGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x93c5fd),
      metalness: 0.15,
      roughness: 0.12,
      transmission: isSoftwareGl ? 0 : 0.85,
      transparent: true,
      opacity: isSoftwareGl ? 0.52 : 0.95,
      ior: 1.9,
      thickness: 2.0,
      clearcoat: 1.0,
      emissive: new THREE.Color(0x1d4ed8),
      emissiveIntensity: 0.35,
      depthWrite: false,
    });

    const brushedTitaniumMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x94a3b8),
      metalness: 0.92,
      roughness: 0.34,
      bumpMap: brushedBump,
      bumpScale: 0.015,
      anisotropy: 0.75,
      clearcoat: 0.4,
    });

    const darkBasaltMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x0f172a),
      metalness: 0.65,
      roughness: 0.62,
      bumpMap: brushedBump,
      bumpScale: 0.02,
    });

    const luminousTrimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x60a5fa),
      metalness: 0.8,
      roughness: 0.2,
      emissive: new THREE.Color(0x2563eb),
      emissiveIntensity: 0.75,
    });

    applyGlassFinishRef.current = (finish: GlassFinishId) => {
      const spec = GLASS_FINISH_SPECS[finish];
      glassMaterial.color.setHex(spec.colorHex);
      glassMaterial.attenuationColor.setHex(spec.attenuationHex);
      glassMaterial.emissive.setHex(spec.emissiveHex);
      glassMaterial.ior = spec.ior;
      glassMaterial.roughness = spec.roughness;
      glassMaterial.clearcoat = spec.clearcoat;
    };

    // 5. Composite 10-Part Procedural Sculpture Root Group
    const sculptureRoot = new THREE.Group();
    scene.add(sculptureRoot);

    // Part A: Sculpted Pedestal Base (Grounded at y = -2.15)
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0, -2.15, 0);

    const basePlinthGeo = new THREE.CylinderGeometry(3.4, 3.7, 0.28, 48);
    const basePlinth = new THREE.Mesh(basePlinthGeo, darkBasaltMat);
    basePlinth.position.y = 0.14;
    basePlinth.receiveShadow = true;
    pedestalGroup.add(basePlinth);

    const stepRingGeo = new THREE.CylinderGeometry(2.55, 2.8, 0.18, 48);
    const stepRing = new THREE.Mesh(stepRingGeo, brushedTitaniumMat);
    stepRing.position.y = 0.37;
    stepRing.receiveShadow = true;
    pedestalGroup.add(stepRing);

    const trimCollarGeo = new THREE.TorusGeometry(2.56, 0.035, 16, 64);
    const trimCollar = new THREE.Mesh(trimCollarGeo, luminousTrimMat);
    trimCollar.rotation.x = Math.PI * 0.5;
    trimCollar.position.y = 0.46;
    pedestalGroup.add(trimCollar);

    // Procedural Etched Cryptographic Dial Plane (offset >= 0.02 above pedestal to prevent Z-fighting)
    const dialPlaneGeo = new THREE.PlaneGeometry(5.1, 5.1);
    const dialPlaneMat = new THREE.MeshBasicMaterial({
      map: dialTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const dialPlane = new THREE.Mesh(dialPlaneGeo, dialPlaneMat);
    dialPlane.rotation.x = -Math.PI * 0.5;
    dialPlane.position.y = 0.485;
    pedestalGroup.add(dialPlane);

    sculptureRoot.add(pedestalGroup);

    // Soft radial contact shadow plane directly beneath the pedestal (y = -2.17)
    const contactShadowGeo = new THREE.PlaneGeometry(8.5, 8.5);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadow.rotation.x = -Math.PI * 0.5;
    contactShadow.position.y = -2.17;
    scene.add(contactShadow);

    // Part B: Sculpted Lathe Optical Prism Core
    const lathePoints = [
      new THREE.Vector2(0.01, -1.1),
      new THREE.Vector2(0.75, -0.8),
      new THREE.Vector2(1.05, 0.0),
      new THREE.Vector2(0.75, 0.8),
      new THREE.Vector2(0.01, 1.1),
    ];
    const prismCoreGeo = new THREE.LatheGeometry(lathePoints, 8);
    const prismCoreMesh = new THREE.Mesh(prismCoreGeo, coreGlassMaterial);
    prismCoreMesh.position.set(0, 0.15, -0.65);
    prismCoreMesh.renderOrder = 1;
    sculptureRoot.add(prismCoreMesh);

    // Part C & D: Dual Counter-Rotating Brushed Titanium & Sapphire Gimbal Rings
    const outerGimbalGeo = new THREE.TorusGeometry(2.65, 0.045, 20, 72);
    const outerGimbalMesh = new THREE.Mesh(outerGimbalGeo, brushedTitaniumMat);
    outerGimbalMesh.position.set(0, 0.2, -0.35);
    sculptureRoot.add(outerGimbalMesh);

    const innerGimbalGeo = new THREE.TorusGeometry(2.15, 0.03, 16, 64);
    const innerGimbalMesh = new THREE.Mesh(innerGimbalGeo, luminousTrimMat);
    innerGimbalMesh.position.set(0, 0.2, -0.35);
    sculptureRoot.add(innerGimbalMesh);

    // Part E: 3D Beveled Optical Glass Typography Group
    const typographyGroup = new THREE.Group();
    typographyGroup.position.set(0, 0.25, 0.25);
    sculptureRoot.add(typographyGroup);

    const interactiveMeshes: THREE.Object3D[] = [];
    let glyphEntries: {
      group: THREE.Group;
      basePos: THREE.Vector3;
      explodeDir: THREE.Vector3;
      index: number;
    }[] = [];

    const buildGlyphMeshes = (word: GlyphWordId) => {
      // Dispose previous glyph geometries
      for (const item of glyphEntries) {
        item.group.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).geometry.dispose();
          }
        });
        typographyGroup.remove(item.group);
      }
      glyphEntries = [];
      interactiveMeshes.length = 0;

      const chars = word.split('');
      const spacing = 1.32;
      const startX = -((chars.length - 1) * spacing) * 0.5;

      chars.forEach((ch, idx) => {
        const letterGroup = new THREE.Group();
        const shape = createGlyphShape(ch);

        // Primary beveled optical glass extrusion
        const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
          depth: 0.44,
          bevelEnabled: true,
          bevelThickness: 0.11,
          bevelSize: 0.055,
          bevelSegments: 4,
          curveSegments: 18,
        });
        extrudeGeo.center();
        extrudeGeo.computeVertexNormals();

        const glassGlyphMesh = new THREE.Mesh(extrudeGeo, glassMaterial);
        glassGlyphMesh.castShadow = !isSoftwareGl;
        glassGlyphMesh.receiveShadow = !isSoftwareGl;
        glassGlyphMesh.renderOrder = 2;
        glassGlyphMesh.layers.enable(1);
        glassGlyphMesh.userData = {
          glyphLabel: `3D Optical Glass Glyph '${ch}' (${word} Protocol Core #${idx + 1})`,
        };
        letterGroup.add(glassGlyphMesh);
        interactiveMeshes.push(glassGlyphMesh);

        // Secondary precision metallic spine frame behind each glass letter
        const spineGeo = new THREE.ExtrudeGeometry(shape, {
          depth: 0.08,
          bevelEnabled: true,
          bevelThickness: 0.02,
          bevelSize: 0.02,
          bevelSegments: 2,
          curveSegments: 12,
        });
        spineGeo.center();
        const spineMesh = new THREE.Mesh(spineGeo, brushedTitaniumMat);
        spineMesh.position.z = -0.26;
        letterGroup.add(spineMesh);

        const baseX = startX + idx * spacing;
        const basePos = new THREE.Vector3(baseX, 0, 0);
        const explodeDir = new THREE.Vector3(
          (idx - (chars.length - 1) * 0.5) * 0.85,
          (idx % 2 === 0 ? 1 : -1) * 0.45,
          0.65 + (idx % 2) * 0.35
        );

        letterGroup.position.copy(basePos);
        typographyGroup.add(letterGroup);

        glyphEntries.push({
          group: letterGroup,
          basePos,
          explodeDir,
          index: idx,
        });
      });
    };

    buildGlyphMeshes(stateRef.current.glyphWord);
    rebuildGlyphsRef.current = buildGlyphMeshes;

    // Part F: InstancedMesh of 36 Orbital Cryptographic Ledger Shards (> 20 instances)
    const SHARD_COUNT = 36;
    const shardGeo = new THREE.OctahedronGeometry(0.14, 0);
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.75,
      roughness: 0.22,
    });
    const shardInstanced = new THREE.InstancedMesh(shardGeo, shardMat, SHARD_COUNT);
    shardInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const shardColors = [0x3b82f6, 0x60a5fa, 0xf59e0b, 0xef4444];
    for (let i = 0; i < SHARD_COUNT; i++) {
      _color.setHex(shardColors[i % shardColors.length]);
      shardInstanced.setColorAt(i, _color);
    }
    if (shardInstanced.instanceColor) {
      shardInstanced.instanceColor.needsUpdate = true;
    }
    sculptureRoot.add(shardInstanced);

    // Raycasting on layer 1 for interactive glyph inspection
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();

    const handleCanvasClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(interactiveMeshes, false);
      if (hits.length > 0 && hits[0].object.userData?.glyphLabel) {
        stateRef.current.onSelectGlyphOrShard?.(String(hits[0].object.userData.glyphLabel));
      }
    };
    renderer.domElement.addEventListener('click', handleCanvasClick);

    // Pre-warm shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Animation & Software-WebGL Paced Render Loop
    let frameId = 0;
    let isDisposed = false;
    let currentExploded = stateRef.current.explodedTarget;
    const startTimeMs = performance.now();
    let prevTimeMs = startTimeMs;

    function afterDraw(cb: () => void) {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (sync && state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const nowMs = performance.now();
      const delta = Math.min((nowMs - prevTimeMs) / 1000, 0.1);
      prevTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;

      // Exponential damping for exploded-view separation
      currentExploded = THREE.MathUtils.damp(
        currentExploded,
        stateRef.current.explodedTarget,
        6.5,
        delta
      );

      // Smoothly damp camera preset transitions
      if (cameraTransitionActive) {
        const dampAlpha = 1 - Math.exp(-5.5 * delta);
        camera.position.lerp(desiredCamPos, dampAlpha);
        controls.target.lerp(desiredCamLook, dampAlpha);
        if (camera.position.distanceToSquared(desiredCamPos) < 0.002) {
          cameraTransitionActive = false;
        }
      }

      controls.update();

      // Animate 3D Beveled Glass Typography with subtle levitation + exploded separation
      for (const item of glyphEntries) {
        const waveY = Math.sin(elapsed * 1.6 + item.index * 0.7) * 0.06;
        const waveRotY = Math.sin(elapsed * 0.9 + item.index * 0.5) * 0.08;
        item.group.position.set(
          item.basePos.x + item.explodeDir.x * currentExploded,
          item.basePos.y + waveY + item.explodeDir.y * currentExploded,
          item.basePos.z + item.explodeDir.z * currentExploded
        );
        item.group.rotation.set(
          currentExploded * 0.18 * (item.index % 2 === 0 ? 1 : -1),
          waveRotY + currentExploded * 0.25,
          0
        );
      }

      // Animate central prism core & counter-rotating gimbals
      prismCoreMesh.rotation.y = elapsed * 0.35;
      prismCoreMesh.position.z = -0.65 - currentExploded * 0.8;

      outerGimbalMesh.rotation.z = elapsed * 0.22;
      outerGimbalMesh.rotation.x = Math.sin(elapsed * 0.4) * 0.22;
      outerGimbalMesh.scale.setScalar(1 + currentExploded * 0.22);

      innerGimbalMesh.rotation.y = -elapsed * 0.32;
      innerGimbalMesh.rotation.x = Math.cos(elapsed * 0.35) * 0.35;
      innerGimbalMesh.scale.setScalar(1 + currentExploded * 0.14);

      // Update 36 orbital cryptographic shards in InstancedMesh (Zero GC)
      for (let i = 0; i < SHARD_COUNT; i++) {
        const angle = (i / SHARD_COUNT) * Math.PI * 2 + elapsed * 0.28;
        const radius = (i % 2 === 0 ? 3.25 : 3.85) + currentExploded * 0.95;
        const yOffset = Math.sin(angle * 2 + i) * 0.95;
        _vec3A.set(Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius - 0.2);
        _euler.set(elapsed + i, elapsed * 0.7, i * 0.3);
        _quat.setFromEuler(_euler);
        const s = 0.85 + ((i * 7) % 5) * 0.075; // ±15% scale variation
        _scale.set(s, s, s);
        _mat4.compose(_vec3A, _quat, _scale);
        shardInstanced.setMatrixAt(i, _mat4);
      }
      shardInstanced.instanceMatrix.needsUpdate = true;
      shardInstanced.computeBoundingSphere();

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const handleResize = () => {
      if (!container || isDisposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleCanvasClick);
      controls.dispose();
      basePlinthGeo.dispose();
      stepRingGeo.dispose();
      trimCollarGeo.dispose();
      dialPlaneGeo.dispose();
      contactShadowGeo.dispose();
      prismCoreGeo.dispose();
      outerGimbalGeo.dispose();
      innerGimbalGeo.dispose();
      shardGeo.dispose();
      glassMaterial.dispose();
      coreGlassMaterial.dispose();
      brushedTitaniumMat.dispose();
      darkBasaltMat.dispose();
      luminousTrimMat.dispose();
      shardMat.dispose();
      brushedBump.dispose();
      dialTex.dispose();
      shadowTex.dispose();
      envTexture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={canvasMountRef}
      data-testid="three-glass-canvas"
      className="fixed inset-0 z-0 h-screen w-screen overflow-hidden bg-[#060b16]"
      aria-label="Interactive 3D Beveled Optical Glass Typography and Cryptographic Ledger Vault"
    />
  );
}
