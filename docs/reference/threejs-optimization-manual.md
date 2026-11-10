---
name: threejs-optimization
description: Use when building, reviewing, or debugging performance of a three.js or React Three Fiber scene — draw calls, materials, textures, shadows, post-processing, asset pipeline, and measurement.
---

# three.js / R3F Performance Manual for Agents

> **Source:** Adapted from the YouTube video on optimizing WebGL / three.js content for performance: https://www.youtube.com/watch?v=dc5iJVInpPY
> Some points have been updated for current three.js (r151+): UV channel selection, WebGL2 texture sizing, KTX2/Basis pipeline, and `BatchedMesh`. The case studies in §12 summarize that video's analysis.

## 0. Operating principles

1. **Measure before and after every change.** Never claim an optimization worked without numbers (§2). The right technique depends on the scene, and intuition is often wrong.
2. **Performance is a budget, not a single setting.** Polygons, materials, textures, shadows, animation, and post-processing all draw on the same budget. Spending more on one means spending less on another.
3. **Establish priorities first.** Before optimizing, write down what the project cannot compromise on (for example: "car must look photoreal" or "world must run on mid-range phones"). Optimize everything else first.
4. **Target the weakest supported device**, not the dev machine. Default target when unspecified: 60 fps on a mid-range laptop iGPU and 30+ fps on a 3-year-old mid-range phone.
5. **Prefer reversible, local changes.** Change one variable at a time so the effect of each change can be measured.

---

## 1. What is expensive (cost model)

| Cost driver | Bottleneck | Primary metric |
|---|---|---|
| Draw calls (object × material × pass) | CPU + driver | `renderer.info.render.calls` |
| Triangle count | GPU vertex stage | `renderer.info.render.triangles` |
| Shader complexity (material type, lights) | GPU fragment stage | frame ms at fixed resolution |
| Pixel count (resolution × DPR × overdraw) | GPU fill rate | frame ms vs. canvas size |
| Texture size / count | VRAM, load time, upload stalls | `renderer.info.memory.textures`, network size |
| Extra render passes (shadows, transmission, post) | Multiplies everything above | calls per frame |
| Per-frame JS (allocations, traversals, physics) | CPU main thread | DevTools Performance panel |

**Pass multipliers (the key insight):** a mesh is drawn once per pass it participates in.
- Each shadow-casting light renders every shadow caster again into its shadow map. A `PointLight` shadow renders **6** times (cube map).
- A transmissive material (`transmission > 0` on `MeshPhysicalMaterial`, or drei `MeshTransmissionMaterial`) triggers an extra render of the opaque scene into a transmission buffer, roughly doubling scene draw calls.
- Post-processing renders the scene to a render target and then adds full-screen passes. Bloom alone adds about 10 or more passes (blur mip chain). Some effects (e.g. SSAO, depth/normal-based effects) render the scene again for normals/depth.
- Background, environment, and helper objects each cost calls.

Worked example: 2 boxes = 2 calls → + shadows from 1 light = 4 → + one transmissive material = ~8 → + post-processing with bloom ≈ 20–30+. Simple scenes become expensive through pass multiplication, not mesh count.

---

## 2. Measurement procedure

Run this before optimizing and after every change.

1. **In-app counters**
   - Vanilla: `stats.js` (FPS / MS / MB panels) and log `renderer.info` once per second:
     ```js
     const { calls, triangles } = renderer.info.render;
     const { geometries, textures } = renderer.info.memory;
     console.log({ calls, triangles, geometries, textures, programs: renderer.info.programs?.length });
     ```
     If using multiple passes/composers, set `renderer.info.autoReset = false` and call `renderer.info.reset()` once per frame so the counts cover the full frame.
   - R3F: `r3f-perf` (`<Perf />`) shows calls, triangles, textures, shader programs, GPU time.
2. **Browser tools:** Chrome DevTools Performance panel (main-thread JS, GC spikes), Spector.js (inspect every draw call and pass in one frame).
3. **OS-level GPU monitor** (Activity Monitor GPU History, Windows Task Manager GPU tab): shows true GPU load that in-app FPS can hide behind vsync.
4. **Test on target hardware** or with CPU throttling and a reduced-power GPU. Test at the real device pixel ratio.
5. **Watch for leaks:** `renderer.info.memory` geometries/textures must stay flat when navigating, opening/closing views, or remounting components. Rising counts mean missing `dispose()`.

Record a baseline table (calls, triangles, textures, programs, frame ms, VRAM-ish texture total, total download MB) and report the delta for each change.

**Rough budgets** (adjust to target device):

| Metric | Mobile | Desktop |
|---|---|---|
| Draw calls / frame | < 100 | < 300–500 |
| Triangles / frame | < 500k | 1–3M |
| Shader programs | < 20 | < 50 |
| Total texture download | < 10–15 MB | < 30–50 MB |
| Single texture max | 2048² | 2048² (4096² only with reason) |

---

## 3. Draw calls

**Goal:** fewer objects × materials × passes.

Techniques, in order of preference:

1. **Share materials.** Identical material instances let objects be batched/merged. Reuse a single material object rather than cloning.
2. **Merge static geometry** that shares a material: `BufferGeometryUtils.mergeGeometries()` or join in Blender.
   - Trade-offs: one material only; parts can't move independently; **frustum culling now applies to the whole merged mesh**, so off-screen parts are still drawn.
   - Therefore merge **by spatial region** (chunks/zones), not the entire world into one mesh. Chunking also allows per-zone texture loading.
3. **`InstancedMesh`** for many copies of the same geometry + material (trees, props, particles). Per-instance transforms and colors are cheap; per-instance animation needs shader work.
   - Caveat: every distinct instanced asset is still ≥1 call. With many unique repeated assets, merging into regional chunks can beat instancing. Measure both.
4. **`BatchedMesh`** (three.js r159+) for many *different* geometries sharing one material, with per-object transforms and visibility in one call.
5. **LOD** (`THREE.LOD` / drei `<Detailed>`) to swap distant objects for cheaper versions.
6. **Remove invisible work:** set `visible = false` on off-screen UI meshes, keep `frustumCulled = true` (default) unless bounds are wrong, compute correct bounding spheres for animated/skinned meshes.
7. **Reduce pass multipliers** (§6, §7): fewer shadow casters, no transmission unless essential, fewer post passes.

---

## 4. Materials

Cost order (cheap → expensive): `MeshBasicMaterial` < `MeshLambertMaterial` < `MeshPhongMaterial` < `MeshStandardMaterial` < `MeshPhysicalMaterial` (with clearcoat/transmission/sheen/iridescence adding more).

**Workflow choice:**
- **Baked + `MeshBasicMaterial`:** artist bakes lighting and shadows into the color texture. Fastest shader, WYSIWYG from Blender, no runtime lights. Downside: needs larger/unique textures for quality; static lighting only. Good for stylized or static scenes on weak devices.
- **PBR (`MeshStandardMaterial` / `MeshPhysicalMaterial`) via glTF:** heavier shader but values translate reliably from Blender's Principled BSDF through glTF export. Default for realistic work. Use `Standard` unless a Physical-only feature is actually needed.

**Rules:**
- Keep the number of **unique shader programs** low. Each distinct material type/feature combination compiles a program. Avoid toggling material features at runtime (forces recompile). Pre-warm with `renderer.compile(scene, camera)` (or `compileAsync`) before showing the scene.
- Minimize the number of lights; each light adds per-fragment cost. Prefer an environment map (§5) plus at most one or two direct lights.
- **Transparency:** avoid where possible (sorting artifacts, overdraw, no depth write). In order of preference:
  1. `alphaTest` (cutout) with an alpha map: e.g. foliage, fences.
  2. `transparent: true` with few, non-overlapping layers.
  3. Transmission / `MeshTransmissionMaterial` (drei) only for hero glass. Remember the extra render pass.
- **Two UV sets:** use UV set 0 for tiling detail maps (color, normal, ORM tiled) and UV set 1 for a non-tiling AO or lightmap. In current three.js (r151+), select the set per texture with `texture.channel = 1`; glTF `texCoord` maps to this automatically.

---

## 5. Textures

Textures usually dominate visual quality, download size, and VRAM. Treat them as the main budget.

**Sizing rules:**
- Use **power-of-two** dimensions (512, 1024, 2048). WebGL2 no longer strictly requires POT, but POT remains best practice for mipmapping, compression formats, and tiling. Square is not required (e.g. 2048×1024 is fine).
- Default cap: **2048²**. Split larger maps into regions instead of using 4K/8K.
- VRAM per uncompressed RGBA texture ≈ `w × h × 4 × 1.33` (mipmaps). A 4096² texture ≈ 89 MB of VRAM regardless of how small the JPG is. Download size ≠ GPU memory.

**Compression (do this by default):**
- Ship **KTX2 / Basis Universal** textures: they stay compressed in VRAM (≈4–8× less than PNG/JPG once uploaded) and avoid main-thread decode stalls. Load with `KTX2Loader`. Use UASTC for normal maps and important detail, ETC1S for everything else.
- Pipeline: `gltf-transform` CLI (`gltf-transform optimize in.glb out.glb --texture-compress ktx2`) or `toktx`. Do not hand-author Basis files in image editors.
- Compress geometry with **Draco** or **Meshopt** (`gltf-transform` handles both).

**Texture-saving techniques:**
- **Color palette / atlas:** one small texture of color swatches; each object's UVs point at its swatch. Lets many objects share one material (enables merging, §3). Extend to roughness/metalness with an ORM palette, but AO then needs its own (non-palette) map.
- **ORM packing:** pack Occlusion (R), Roughness (G), Metalness (B) into one texture: the glTF convention. Assign the same texture to `aoMap`, `roughnessMap`, `metalnessMap`. Substance Painter exports this directly.
- **Tiling:** small seamless color/normal textures repeated across large surfaces (UV set 0) plus a non-repeating AO/lightmap (UV set 1). Example: a realistic car configurator kept total textures ≈ 10 MB this way despite a 300–400k-triangle model.
- **Async / lazy loading:** load textures per zone when the user approaches it, not upfront.

**Correctness settings (cheap to get right, expensive to get wrong):**
- Color maps: `texture.colorSpace = THREE.SRGBColorSpace`. Data maps (normal, ORM, roughness): leave as `NoColorSpace` (linear). glTF loader handles this automatically.
- `texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())` only on ground/oblique surfaces.
- Dispose replaced textures: `texture.dispose()`.

**Environment maps:**
- Image-based lighting via `scene.environment` gives realistic reflections and lighting at relatively low cost; often replaces several lights.
- Use a **small HDR/EXR** (e.g. 256–1k) for `scene.environment` (lighting) and a separate **LDR JPG** at display resolution for `scene.background` if the background is visible. Process with `PMREMGenerator` (automatic for `scene.environment`).

---

## 6. Shadows

Cost ranking (expensive → cheap): dynamic point-light shadows > dynamic directional/spot shadows > runtime-baked shadows > baked lightmap/AO > fake blob shadows.

**Decision procedure:**
1. Static object, static light → **bake** (lightmap or AO map in Blender, or bake into the color texture). Zero runtime cost.
2. Moving object over static ground → **blob shadow**: a plane with a radial-gradient texture following the object. Very cheap, works well for characters in stylized/low-poly scenes. Or drei `<ContactShadows>` (renders once if `frames={1}` for static scenes).
3. Need real dynamic shadows → one `DirectionalLight` with:
   - small `shadow.mapSize` (512–1024; 2048 max on desktop),
   - a tight shadow camera frustum (`shadow.camera.left/right/top/bottom/near/far`) fitted to the area that matters,
   - `castShadow` only on objects that need it, `receiveShadow` only on surfaces that show it.
4. Huge world where baking would need too many textures → **follow-camera shadow**: a directional light whose shadow camera tracks the player, covering only the area near them. Fade the shadow at the frustum edge (custom shader chunk) to avoid a hard cutoff.
5. Static shadow scene with runtime-computed shadows → render once: `renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;` whenever something changes.

Typical good result: a mix of baked shadows for the static environment and a single small dynamic shadow for moving objects.

---

## 7. Post-processing

- Default: **none.** Add only when the project requires it and the budget has room after everything else is optimized.
- Every effect adds full-screen passes, and some re-render the scene (depth/normals). Cost scales with pixel count.
- If used:
  - Use the `postprocessing` library (pmndrs) / `@react-three/postprocessing`, which merges compatible effects into fewer passes than three's stock `EffectComposer`.
  - Bloom is the best value-for-cost effect; use selective/luminance-threshold bloom.
  - Disable MSAA on the main renderer when post-processing (`antialias: false`) and do AA in the composer (SMAA/FXAA), or multisample the composer's render target.
  - Real-time AO (SSAO/N8AO) is expensive and often noisy. Prefer baked AO; use real-time AO only for dynamic occlusion that matters to the experience.
  - **Accumulate when idle:** when the camera stops, render extra frames for temporal AA / higher quality, then stop rendering.
  - Render post at reduced resolution where acceptable (e.g. bloom at half res).

---

## 8. Resolution, render loop, and runtime

- **Clamp pixel ratio:** `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`; on mobile consider 1.5. R3F: `<Canvas dpr={[1, 2]}>`.
- **Adaptive quality:** drei `<PerformanceMonitor>` + `<AdaptiveDpr>` / `<AdaptiveEvents>` to lower DPR or disable effects when FPS drops.
- **Render on demand** for static or mostly static scenes: R3F `<Canvas frameloop="demand">` and `invalidate()` on change; vanilla: render only on input/animation events.
- **No allocations in the frame loop.** Reuse `Vector3`/`Matrix4`/`Quaternion` instances created outside `useFrame` / `requestAnimationFrame`.
- **Static objects:** `object.matrixAutoUpdate = false; object.updateMatrix();` once.
- In R3F, mutate via refs inside `useFrame`; never `setState` per frame.
- **Dispose on teardown:** geometries, materials, textures, render targets. R3F auto-disposes on unmount, but cached assets (`useLoader`/`useGLTF`) persist intentionally; clear with `useGLTF.clear(url)` when truly done.
- Load heavy assets progressively; show a lightweight scene first.

---

## 9. Optimization workflow (step-by-step)

1. **Clarify priorities** with the user or spec: target devices, target FPS, the non-negotiable visual features.
2. **Baseline** with §2 on target hardware. Record the table.
3. **Identify the bottleneck:**
   - Frame ms drops sharply when the canvas shrinks → fill-rate/fragment bound → reduce DPR, post, transparency/overdraw, shader complexity.
   - High draw calls (> budget) → CPU bound → §3.
   - High VRAM/textures or long load → §5.
   - JS long tasks / GC spikes in DevTools → §8.
4. **Run the asset pipeline:** `gltf-transform` (dedup, prune, weld, simplify where acceptable, Draco/Meshopt, KTX2, resize to ≤2048).
5. **Remove pass multipliers:** cut shadow casters/lights, transmission, unnecessary post.
6. **Reduce draw calls:** share materials → palette/atlas → regional merging → instancing/BatchedMesh → LOD. Measure after each.
7. **Tune runtime:** DPR clamp, adaptive quality, on-demand rendering, no per-frame allocations.
8. **Re-measure** and report the before/after table and any visual trade-offs made.
9. **Leak check:** navigate through all states and confirm `renderer.info.memory` stays flat.

---

## 10. Review checklist

Use when auditing an existing scene. Each "no" is a finding.

- [ ] Draw calls, triangles, textures, and programs measured and within budget for target devices
- [ ] Pixel ratio clamped; adaptive quality on mobile
- [ ] All glTF assets compressed (Draco/Meshopt geometry, KTX2 textures)
- [ ] No texture larger than 2048² without a stated reason; POT sizes
- [ ] Color maps in sRGB, data maps linear
- [ ] ORM packing used for PBR maps; palettes/tiling used where possible
- [ ] Materials shared; simplest material type that achieves the look
- [ ] Static geometry merged by region (not globally); repeated objects instanced/batched
- [ ] Transparency avoided or replaced with `alphaTest` where possible; transmission only on hero objects
- [ ] Static shadows baked; dynamic shadows limited to one light, small map, tight frustum, minimal casters
- [ ] No point-light shadows unless essential
- [ ] Post-processing justified; effects merged; AA strategy consistent
- [ ] No allocations or React state updates in the frame loop
- [ ] Static scenes render on demand
- [ ] Resources disposed; memory flat across navigation
- [ ] Shaders pre-compiled before reveal (no first-interaction hitch)

---

## 11. Anti-patterns (flag immediately)

- One giant merged mesh for a large world (kills frustum culling, forces huge AO/lightmaps).
- 4K/8K JPG/PNG textures shipped uncompressed.
- Many lights each with `castShadow = true`, or a shadow-casting `PointLight`.
- `castShadow`/`receiveShadow` set on every mesh by traversal.
- Multiple stacked transparent layers with `depthWrite` on.
- Bloom + SSAO + DOF + more on a mobile target.
- `new THREE.Vector3()` inside the render loop; `setState` in `useFrame`.
- Cloning materials per object instead of sharing.
- Changing material defines/features at runtime (recompiles).
- Optimizing without measuring, or measuring only on a high-end desktop.

---

## 12. Reference patterns from production case studies

- **Large low-poly explorable world (third-person character):** concerns were draw calls and texture size. Static meshes merged into ~8 regional groups (preserves culling, allows ~1k AO map per region instead of one ~8k map, enables lazy per-zone loading). Instancing was considered for repeated props but rejected because too many distinct assets meant too many instanced meshes. A color palette lets merged meshes keep varied colors. Shadows: baking the whole world would need too many textures, so a directional light follows the character with a modest shadow map and edges modified to fade out.
- **Photoreal car configurator:** polygon count is unavoidable (300–400k triangles), so the budget is spent there and saved on textures: color + ORM palettes with seamless tiling detail textures, ~10 MB of textures total. Remaining budget funds bloom on lights and temporal AA that accumulates extra frames when the camera stops. Real-time AO was used for dynamic door shadows; a static AO map would have been cheaper at the cost of that detail. Treat real-time AO as a deliberate luxury, not a default.

Lesson: first intuitions (e.g. "instance all repeated objects", "bake all shadows") are not always the best fit. Try alternatives and let measurements decide.
