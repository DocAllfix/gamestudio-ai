/**
 * Curated grounding for code_gen_babylon_ts.
 *
 * Babylon.js is NOT in the Phase-1 RAG knowledge base (the ingestion
 * pipeline is frozen — see lib/tools/CLAUDE.md §6). Instead of harvesting
 * the KB, this tool injects the canonical snippets below, transcribed
 * from the official Babylon.js documentation, so the LLM has correct API
 * surface for the three things it most often gets wrong: headless
 * NullEngine, Havok physics, and GLTF loading.
 *
 * Sources (official docs):
 *   - NullEngine:  doc.babylonjs.com/features/featuresDeepDive/scene/renderToPNG (NullEngine section)
 *   - Havok:       doc.babylonjs.com/features/featuresDeepDive/physics/usingPhysicsEngine (Havok plugin)
 *   - GLTFLoader:  doc.babylonjs.com/features/featuresDeepDive/importers/glTF
 */
export const BABYLON_GROUNDING = `=== CANONICAL BABYLON.JS REFERENCE (official docs) ===

--- Headless engine for tests / smoke runs (NullEngine) ---
\`\`\`ts
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";

const engine = new NullEngine();
const scene = new Scene(engine);
// NullEngine has no canvas; renderLoop still ticks for logic/physics.
engine.runRenderLoop(() => scene.render());
\`\`\`

--- Havok physics (v2 plugin) ---
\`\`\`ts
import HavokPhysics from "@babylonjs/havok";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2/physicsAggregate";

const havok = await HavokPhysics();
scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, havok));
new PhysicsAggregate(sphere, PhysicsShapeType.SPHERE, { mass: 1, restitution: 0.75 }, scene);
\`\`\`

--- Loading a GLTF/GLB asset (GLTFLoader) ---
\`\`\`ts
import "@babylonjs/loaders/glTF";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";

const result = await SceneLoader.ImportMeshAsync("", "/assets/", "character.glb", scene);
const root = result.meshes[0];
\`\`\`
`;
