"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { INVITE } from "@/lib/config";

type Props = { name: string };

// Các mốc khung hình của camera
type FrameKind = "center" | "final";

export default function GradInvite({ name }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const diplomaRef = useRef<HTMLImageElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const errRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let disposed = false;
    const DBG =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("debug");
    const tStart = performance.now();
    const dlog = (...a: unknown[]) => {
      if (!DBG) return;
      const s = ((performance.now() - tStart) / 1000).toFixed(1) + "s";
      const parts = a.map((x) =>
        typeof x === "object" ? JSON.stringify(x) : String(x)
      );
      console.log("[grad]", s, ...parts);
    };
    const mvec = (v: THREE.Vector3) => ({
      x: +v.x.toFixed(2),
      y: +v.y.toFixed(2),
      z: +v.z.toFixed(2),
    });
    const timers: ReturnType<typeof setTimeout>[] = [];
    const addTimer = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        if (!disposed) fn();
      }, ms);
      timers.push(t);
      return t;
    };
    const showErr = (m: string) => {
      if (errRef.current) errRef.current.textContent = "Lỗi: " + m;
      // eslint-disable-next-line no-console
      console.error("[grad]", m);
    };

    // ---------- Renderer ----------
    // Đo theo chính #stage (không dùng window.innerWidth) để canvas luôn khớp vùng nhìn.
    let viewW = stage.clientWidth || window.innerWidth;
    let viewH = stage.clientHeight || window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(viewW, viewH, false); // false: giữ CSS canvas 100% (xem globals.css)
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // ---------- Nền: ảnh Meshy đặt bằng lớp CSS (.bg-photo) phía dưới canvas ----------
    // Canvas trong suốt để ảnh nền tốt nghiệp hiện xuyên qua, scale "cover" chuẩn mọi
    // tỉ lệ màn hình. Nền luôn nằm dưới nhân vật.
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(38, viewW / viewH, 0.01, 2000);

    // Môi trường studio (PBR mềm)
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // ---------- Ánh sáng 3 điểm + rim ----------
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2350, 0.4));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
    key.position.set(3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 7;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb8ff, 0.55);
    fill.position.set(-4, 3, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe8c0, 2.8);
    rim.position.set(-3, 5, -5);
    scene.add(rim);

    // Spotlight sân khấu ấm phía sau nhân vật
    const spot = new THREE.SpotLight(0xffd9a0, 6.0, 40, Math.PI / 5, 0.6, 1.2);
    spot.position.set(0, 9, -3);
    scene.add(spot);

    // ---------- Hạt bokeh bay lơ lửng (không khí lễ hội) ----------
    let bokeh: THREE.Points | null = null;
    let bokehVel: Float32Array | null = null;
    function makeSprite(): THREE.Texture {
      const s = document.createElement("canvas");
      s.width = s.height = 64;
      const g = s.getContext("2d")!;
      const rad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rad.addColorStop(0, "rgba(255,238,200,1)");
      rad.addColorStop(0.35, "rgba(255,220,160,0.6)");
      rad.addColorStop(1, "rgba(255,220,160,0)");
      g.fillStyle = rad;
      g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(s);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }

    // ---------- Confetti ----------
    let confetti: THREE.Points | null = null;
    const CONF_COLORS = [
      "#ff5d73",
      "#ffd166",
      "#06d6a0",
      "#4d96ff",
      "#c77dff",
      "#ff9f1c",
      "#ffffff",
    ];
    type ConfData = { vel: THREE.Vector3[]; life: number; ttl: number };
    const modelTop = new THREE.Vector3();

    function spawnConfetti() {
      removeConfetti();
      const N = 360;
      const pos = new Float32Array(N * 3);
      const col = new Float32Array(N * 3);
      const vel: THREE.Vector3[] = [];
      for (let i = 0; i < N; i++) {
        pos[i * 3] = modelTop.x + (Math.random() - 0.5) * 0.8;
        pos[i * 3 + 1] = modelTop.y + Math.random() * 0.5;
        pos[i * 3 + 2] = modelTop.z + (Math.random() - 0.5) * 0.8;
        const c = new THREE.Color(CONF_COLORS[i % CONF_COLORS.length]);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
        vel.push(
          new THREE.Vector3(
            (Math.random() - 0.5) * 2.6,
            2.8 + Math.random() * 3.0,
            (Math.random() - 0.5) * 2.6
          )
        );
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.06,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true,
      });
      confetti = new THREE.Points(geo, mat);
      confetti.userData = { vel, life: 0, ttl: 3.6 } as ConfData;
      scene.add(confetti);
    }
    function updateConfetti(dt: number) {
      if (!confetti) return;
      const d = confetti.userData as ConfData;
      d.life += dt;
      const p = confetti.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < d.vel.length; i++) {
        const v = d.vel[i];
        v.y -= 6.4 * dt;
        v.multiplyScalar(0.992);
        p.setXYZ(
          i,
          p.getX(i) + v.x * dt,
          p.getY(i) + v.y * dt,
          p.getZ(i) + v.z * dt
        );
      }
      p.needsUpdate = true;
      (confetti.material as THREE.PointsMaterial).opacity = Math.max(
        0,
        1 - d.life / d.ttl
      );
      if (d.life >= d.ttl) removeConfetti();
    }
    function removeConfetti() {
      if (confetti) {
        scene.remove(confetti);
        confetti.geometry.dispose();
        (confetti.material as THREE.PointsMaterial).dispose();
        confetti = null;
      }
    }

    // ---------- Camera framing (điều khiển bằng code) ----------
    let theModel: THREE.Object3D | null = null;
    let mCenter = new THREE.Vector3();
    let mSize = new THREE.Vector3();
    let mHeight = 1.75;
    let mFloorY = 0;
    // Nút "thân" (xương hông) để camera bám → nhân vật luôn ở giữa & chân bám sàn dù
    // animation (vẫy tay, nhảy) có đẩy thân lệch/lùi/nhún.
    let bodyNode: THREE.Object3D | null = null;
    let followX = 0;
    let followY = 0;
    let followZ = 0;
    const hipsRest = new THREE.Vector3();
    const _fv = new THREE.Vector3();
    const viewDir = new THREE.Vector3(0.18, 0.03, 1).normalize();

    const goalPos = new THREE.Vector3();
    const goalTgt = new THREE.Vector3();
    const curPos = new THREE.Vector3();
    const curTgt = new THREE.Vector3();
    let camReady = false;

    function fitDistance(contentH: number, padScale: number): number {
      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const fitH = contentH / 2 / Math.tan(vFov / 2);
      const fitW =
        (Math.max(mSize.x, mSize.z) * 1.1) /
        2 /
        (Math.tan(vFov / 2) * camera.aspect);
      return padScale * Math.max(fitH, fitW, 0.5);
    }

    function computeFrame(kind: FrameKind): {
      pos: THREE.Vector3;
      target: THREE.Vector3;
    } {
      let contentH: number;
      let targetY: number;
      let pad: number;
      if (kind === "final") {
        // Màn rộng: nhân vật to vừa, dồn trái. Màn hẹp: zoom xa hơn cho thoáng chữ.
        const wide = camera.aspect >= 1.1;
        contentH = mHeight * (wide ? 1.34 : 1.78);
        targetY = mCenter.y + mHeight * (wide ? 0.13 : 0.04);
        pad = 1.16;
      } else {
        contentH = mHeight * 1.12;
        targetY = mCenter.y + mHeight * 0.02;
        pad = 1.18;
      }
      // Màn hình THẤP (landscape điện thoại, cửa sổ dẹt): zoom xa hơn + canh giữa
      // để nhân vật nhỏ lại, chừa chỗ cho chữ trên/dưới, không bao giờ đè nhau.
      const vh = viewH;
      if (vh < 560) {
        contentH *= 1.28;
        targetY = mCenter.y + mHeight * 0.02;
      }
      if (vh < 430) contentH *= 1.12;
      // ĐIỆN THOẠI DỌC: lùi camera để nhân vật đứng GỌN GIỮA màn (có lề trên/dưới/
      // hai bên, thấy cả người), thay vì chiếm gần hết màn hình.
      if (camera.aspect < 0.9 && kind !== "final") {
        pad *= 1.22;
        targetY = mCenter.y; // canh tâm nhân vật vào giữa màn
      }
      const dist = fitDistance(contentH, pad);
      // NEO CHÂN LÊN SÀN: đặt bàn chân nhân vật đúng mức sàn của ảnh nền (~84% màn)
      // để nhân vật đứng trên sàn, không lơ lửng. (Ảnh nền cover hiện đủ chiều cao ở
      // mọi aspect < 1.79 → sàn ở cùng mức màn.)
      if (kind === "center" || kind === "final") {
        const vFov2 = THREE.MathUtils.degToRad(camera.fov);
        const worldVisH = 2 * dist * Math.tan(vFov2 / 2);
        // Pha cuối trên màn DỌC: neo chân cao hơn chút để chân không đè khối chữ dưới
        // (nhân vật dồn phải chưa đủ tách trên màn hẹp). Còn lại: chân sát sàn 0.84.
        const FEET_FRAC =
          kind === "final" && camera.aspect < 1.1 ? 0.8 : 0.84;
        targetY = mFloorY + worldVisH * (FEET_FRAC - 0.5);
      }
      dlog("computeFrame", kind, {
        dist: +dist.toFixed(2),
        targetY: +targetY.toFixed(2),
        contentH: +contentH.toFixed(2),
        aspect: +camera.aspect.toFixed(2),
      });
      const target = new THREE.Vector3(mCenter.x, targetY, mCenter.z);
      const pos = target.clone().addScaledVector(viewDir, dist);

      if (kind === "final") {
        // Pan camera sang TRÁI để nhân vật dồn về BÊN PHẢI khung hình.
        const forward = new THREE.Vector3().subVectors(target, pos).normalize();
        const right = new THREE.Vector3()
          .crossVectors(forward, new THREE.Vector3(0, 1, 0))
          .normalize();
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const worldHalfW = dist * Math.tan(vFov / 2) * camera.aspect;
        // Màn rộng dồn mạnh sang phải; màn dọc dồn kha khá (để chân không đè chữ dưới).
        let frac = camera.aspect >= 1.1 ? 0.36 : 0.26;
        if (viewH < 560) frac *= 0.6; // landscape thấp: dồn nhẹ hơn
        // dấu ÂM → pan sang trái → nhân vật nằm bên phải khung hình
        const pan = right.multiplyScalar(-worldHalfW * frac);
        pos.add(pan);
        target.add(pan);
      }
      return { pos, target };
    }

    let currentKind: FrameKind = "center";
    function setFrame(kind: FrameKind, snap = false) {
      currentKind = kind;
      const f = computeFrame(kind);
      goalPos.copy(f.pos);
      goalTgt.copy(f.target);
      if (snap) {
        curPos.copy(f.pos);
        curTgt.copy(f.target);
      }
      camReady = true;
    }

    // ---------- Loader models ----------
    const loader = new GLTFLoader();
    const loadGLB = (url: string): Promise<GLTF> =>
      new Promise<GLTF>((res, rej) =>
        loader.load(
          url,
          res,
          undefined,
          rej
        )
      );

    // Dùng RoomEnvironment có sẵn làm ánh sáng mặc định để tránh tải HDRI 6 MB.
    // Có thể tải HDRI bổ sung khi chủ động truyền ?hdri=...
    const params0 = new URLSearchParams(window.location.search);
    const HDRI_PRESETS = new Set([
      "theater_01",
      "music_hall_01",
      "graaff_reinet_groote_kerk",
    ]);
    const requestedHDRI = params0.get("hdri");
    const HDRI_FILE =
      requestedHDRI && HDRI_PRESETS.has(requestedHDRI) ? requestedHDRI : null;
    const requestedRotation = Number(params0.get("rot") ?? "1.57");
    const HDRI_ROT = Number.isFinite(requestedRotation) ? requestedRotation : 1.57;
    function loadHDRI() {
      if (!HDRI_FILE) return;
      // 2k đủ đẹp cho IBL (PMREM làm mờ), nhẹ hơn nhiều → an toàn cho điện thoại
      new RGBELoader().load(
        `/hdri/${HDRI_FILE}_2k.hdr`,
        (tex) => {
          if (disposed) return;
          tex.mapping = THREE.EquirectangularReflectionMapping;
          // Chỉ dùng HDRI cho ÁNH SÁNG (IBL) — nền là ảnh Meshy (CSS), KHÔNG set background.
          scene.environmentRotation.set(0, HDRI_ROT, 0);
          scene.environment = pmrem.fromEquirectangular(tex).texture;
          dlog("hdri loaded (env only)", HDRI_FILE, { rot: HDRI_ROT });
        },
        undefined,
        (e) => dlog("hdri fail", String(e))
      );
    }

    // ---------- Animation state machine ----------
    let mixer: THREE.AnimationMixer | null = null;
    const actions: Record<string, THREE.AnimationAction> = {};
    let currentAction: THREE.AnimationAction | null = null;
    type Scene = "loading" | "wave" | "diploma" | "final";
    let sstate: Scene = "loading";
    let enteredFinal = false;
    // QA: ?stage=diploma|final để nhảy thẳng tới một pha
    const jumpStage = new URLSearchParams(window.location.search).get("stage");

    function play(
      nameKey: string,
      loop: THREE.AnimationActionLoopStyles,
      fade = 0.34
    ) {
      const next = actions[nameKey];
      if (!next) return null;
      next.reset();
      next.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity);
      next.clampWhenFinished = loop === THREE.LoopOnce;
      next.enabled = true;
      next.setEffectiveWeight(1);
      next.fadeIn(fade);
      next.play();
      if (currentAction && currentAction !== next) currentAction.fadeOut(fade);
      currentAction = next;
      return next;
    }

    const clock = new THREE.Clock();

    async function init() {
      let characterG: GLTF;
      try {
        characterG = await loadGLB("/models/character.glb");
      } catch (e) {
        showErr(
          "Không tải được mô hình nhân vật. " +
            (e instanceof Error ? e.message : String(e))
        );
        return;
      }
      if (disposed) return;

      theModel = characterG.scene;
      theModel.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.frustumCulled = false;
        }
      });
      scene.add(theModel);

      // Mixer + actions phải tạo TRƯỚC khi đo: bind-pose của skinned mesh cho
      // bounding box sai (bẹp) → ta áp pose "idle" rồi mới đo box thật.
      mixer = new THREE.AnimationMixer(theModel);
      const waveClip = characterG.animations.find((clip) => clip.name === "wave");
      const idleClip = characterG.animations.find((clip) => clip.name === "idle");
      if (!waveClip || !idleClip) {
        showErr("Mô hình nhân vật thiếu animation vẫy tay hoặc đứng yên.");
        return;
      }
      actions.wave = mixer.clipAction(waveClip);
      actions.idle = mixer.clipAction(idleClip);
      dlog("clip", "wave", { dur: +waveClip.duration.toFixed(2) });
      dlog("clip", "idle", { dur: +idleClip.duration.toFixed(2) });

      // Animation vẫy tay hơi dài → tăng nhẹ tốc độ phát cho gọn kịch bản
      actions.wave.timeScale = 1.25;

      // Áp pose idle 1 frame để đo model chuẩn.
      // QUAN TRỌNG: sau mixer.update phải updateMatrixWorld để bone.matrixWorld
      // cập nhật, nếu không setFromObject(skinnedMesh) trả về bind-pose sai.
      actions.idle.reset();
      actions.idle.play();
      mixer.update(0.001);
      theModel.updateMatrixWorld(true);
      currentAction = actions.idle; // để wave crossfade mượt từ idle

      const box = new THREE.Box3().setFromObject(theModel, true);
      box.getCenter(mCenter);
      box.getSize(mSize);
      mHeight = mSize.y > 0.5 ? mSize.y : 1.75;
      mFloorY = box.min.y;
      modelTop.set(mCenter.x, box.max.y + 0.2, mCenter.z);
      // Tìm xương hông/thân để camera bám (bỏ ảnh hưởng cánh tay vẫy vươn ra)
      theModel.traverse((o) => {
        if (bodyNode) return;
        const n = o.name.toLowerCase();
        if (n.includes("hip") || n.includes("pelvis") || n.includes("spine"))
          bodyNode = o;
      });
      if (bodyNode) {
        (bodyNode as THREE.Object3D).updateWorldMatrix(true, false);
        (bodyNode as THREE.Object3D).getWorldPosition(hipsRest);
      }
      dlog("bodyNode", bodyNode ? (bodyNode as THREE.Object3D).name : "none", {
        rest: mvec(hipsRest),
      });
      dlog("model box (posed idle)", {
        min: mvec(box.min),
        max: mvec(box.max),
        size: mvec(mSize),
        center: mvec(mCenter),
      });
      spot.target.position.set(mCenter.x, mCenter.y, mCenter.z);
      scene.add(spot.target);

      // Sàn nhận bóng
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60),
        new THREE.ShadowMaterial({ opacity: 0.34 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = box.min.y;
      ground.receiveShadow = true;
      scene.add(ground);

      // Bokeh particles quanh nhân vật
      {
        const N = 130;
        const pos = new Float32Array(N * 3);
        bokehVel = new Float32Array(N);
        const spanX = Math.max(mSize.x, 1) * 6;
        const spanY = mHeight * 2.4;
        const spanZ = Math.max(mSize.z, 1) * 5;
        for (let i = 0; i < N; i++) {
          pos[i * 3] = mCenter.x + (Math.random() - 0.5) * spanX;
          pos[i * 3 + 1] = box.min.y + Math.random() * spanY;
          pos[i * 3 + 2] = mCenter.z + (Math.random() - 0.5) * spanZ - 0.5;
          bokehVel[i] = 0.05 + Math.random() * 0.12;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
          size: 0.11,
          map: makeSprite(),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          opacity: 0.9,
          sizeAttenuation: true,
        });
        bokeh = new THREE.Points(geo, mat);
        bokeh.userData = { minY: box.min.y, spanY };
        scene.add(bokeh);
      }

      loadHDRI();

      setFrame("center", true);

      mixer.addEventListener("finished", (e) => {
        if (e.action !== currentAction) return;
        dlog("finished action while state=", sstate);
        if (sstate === "wave") {
          beatShowDiploma();
        }
      });

      // Ẩn loader, bắt đầu kịch bản tự động
      loaderRef.current?.classList.add("hidden");
      animate();
      startScenario();
    }

    // ---------- Kịch bản ----------
    function startScenario() {
      // Nhánh QA: nhảy thẳng tới pha mong muốn
      if (jumpStage === "final") {
        enterFinal();
        return;
      }
      if (jumpStage === "diploma") {
        beatShowDiploma();
        return;
      }
      // 1) Vẫy tay chào ngay khi vào
      dlog("scenario: WAVE");
      sstate = "wave";
      setFrame("center");
      const wave = play("wave", THREE.LoopOnce);
      if (wave) {
        // Chuyển cảnh vẫn đúng nhịp trên máy yếu nếu renderer không phát đủ frame
        // để sự kiện "finished" của mixer chạy đúng thời điểm.
        const waveDuration = (wave.getClip().duration / wave.timeScale) * 1000;
        addTimer(() => {
          if (sstate === "wave") beatShowDiploma();
        }, waveDuration + 500);
      }
    }

    function beatShowDiploma() {
      if (sstate === "diploma" || sstate === "final") return;
      // 2) Hiện bằng tốt nghiệp
      dlog("scenario: DIPLOMA");
      sstate = "diploma";
      play("idle", THREE.LoopRepeat);
      diplomaRef.current?.classList.add("show");
      addTimer(() => {
        diplomaRef.current?.classList.remove("show");
        addTimer(() => {
          enterFinal();
        }, 700);
      }, 3400);
    }

    function enterFinal() {
      if (enteredFinal) return; // tránh gọi 2 lần (timer + finished)
      enteredFinal = true;
      // Đứng yên (idle), lệch trái, từ từ hiện chữ mời
      dlog("scenario: FINAL");
      sstate = "final";
      play("idle", THREE.LoopRepeat);
      setFrame("final");
      addTimer(() => spawnConfetti(), 250);
      revealInvitation();
    }

    // ---------- Hiện chữ mời (Web Animations API) ----------
    function animIn(el: Element | null, delay: number, duration = 900) {
      if (!el) return;
      (el as HTMLElement).animate(
        [
          { opacity: 0, transform: "translateY(16px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration, delay, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" }
      );
    }

    function revealInvitation() {
      const top = topRef.current;
      const bottom = bottomRef.current;
      if (!top || !bottom) return;

      animIn(top.querySelector(".invite-prefix"), 500);

      // Tên: hiện từng chữ cái
      const chars = top.querySelectorAll<HTMLElement>(".invite-name .ch");
      const nameStart = 950;
      const step = 46;
      chars.forEach((c, i) => {
        c.animate(
          [
            {
              opacity: 0,
              transform: "translateY(.5em) rotate(4deg)",
              filter: "blur(6px)",
            },
            {
              opacity: 1,
              transform: "translateY(0) rotate(0deg)",
              filter: "blur(0)",
            },
          ],
          {
            duration: 720,
            delay: nameStart + i * step,
            easing: "cubic-bezier(.2,.8,.2,1)",
            fill: "forwards",
          }
        );
      });
      const afterName = nameStart + chars.length * step + 250;

      animIn(top.querySelector(".invite-suffix"), afterName);
      animIn(top.querySelector(".invite-event"), afterName + 350);
      animIn(top.querySelector(".invite-grad"), afterName + 620);
      animIn(top.querySelector(".invite-school"), afterName + 880);

      // Dưới: đường kẻ + thông tin
      const divider = bottom.querySelector<HTMLElement>(".info-divider");
      if (divider) {
        divider.animate(
          [
            { width: "0px", opacity: 0 },
            { width: "240px", opacity: 1 },
          ],
          {
            duration: 900,
            delay: afterName + 500,
            easing: "cubic-bezier(.2,.7,.2,1)",
            fill: "forwards",
          }
        );
      }
      const items = bottom.querySelectorAll<HTMLElement>(".info-item");
      items.forEach((it, i) =>
        animIn(it, afterName + 900 + i * 260, 800)
      );
    }

    // ---------- Vòng lặp render ----------
    let raf = 0;
    let hbAccum = 0;
    const liveBox = new THREE.Box3();
    function animate() {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      if (mixer) mixer.update(dt);

      // heartbeat: live bounding box vs khung camera
      if (DBG && theModel) {
        hbAccum += dt;
        if (hbAccum >= 1.0) {
          hbAccum = 0;
          liveBox.setFromObject(theModel, true);
          const cx = (liveBox.min.x + liveBox.max.x) / 2;
          dlog("hb", sstate, {
            cx: +cx.toFixed(2),
            minX: +liveBox.min.x.toFixed(2),
            maxX: +liveBox.max.x.toFixed(2),
            minY: +liveBox.min.y.toFixed(2),
            maxY: +liveBox.max.y.toFixed(2),
            minZ: +liveBox.min.z.toFixed(2),
          });
        }
      }
      updateConfetti(dt);

      // bokeh trôi lên
      if (bokeh && bokehVel) {
        const p = bokeh.geometry.attributes.position as THREE.BufferAttribute;
        const ud = bokeh.userData as { minY: number; spanY: number };
        for (let i = 0; i < bokehVel.length; i++) {
          let y = p.getY(i) + bokehVel[i] * dt;
          if (y > ud.minY + ud.spanY) y = ud.minY;
          p.setY(i, y);
        }
        p.needsUpdate = true;
      }

      // camera mượt tiến về khung mục tiêu
      if (camReady) {
        const k = 1 - Math.exp(-dt * 3.2);
        curPos.lerp(goalPos, k);
        curTgt.lerp(goalTgt, k);
        // Bám theo thân (Hips) để nhân vật cố định trong khung khi vẫy tay:
        //  • X: mọi pha (trừ final) → luôn ở GIỮA.
        //  • Y,Z: pha vẫy tay / hiện bằng → CHÂN BÁM SÀN (bù bước lùi + nhún).
        let dtx = 0;
        let dty = 0;
        let dtz = 0;
        if (bodyNode && sstate !== "final" && sstate !== "loading") {
          bodyNode.updateWorldMatrix(true, false);
          bodyNode.getWorldPosition(_fv);
          dtx = _fv.x - hipsRest.x;
          if (sstate === "wave" || sstate === "diploma") {
            dty = _fv.y - hipsRest.y;
            dtz = _fv.z - hipsRest.z;
          }
        }
        const fdamp = 1 - Math.exp(-dt * 6);
        followX += (dtx - followX) * fdamp;
        followY += (dty - followY) * fdamp;
        followZ += (dtz - followZ) * fdamp;
        camera.position.set(
          curPos.x + followX,
          curPos.y + followY,
          curPos.z + followZ
        );
        camera.lookAt(curTgt.x + followX, curTgt.y + followY, curTgt.z + followZ);
      }

      renderer.render(scene, camera);
    }

    // ---------- Resize (đo theo #stage, chống lệch/hụt trên mọi thiết bị) ----------
    function onResize() {
      const w = stage!.clientWidth || window.innerWidth;
      const h = stage!.clientHeight || window.innerHeight;
      if (w === viewW && h === viewH) return;
      viewW = w;
      viewH = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      if (theModel) setFrame(currentKind); // giữ nguyên khung theo trạng thái
    }
    // ResizeObserver bắt MỌI thay đổi vùng nhìn (xoay máy, ẩn/hiện thanh URL,
    // chia đôi màn hình, zoom…) — chắc chắn hơn sự kiện 'resize' của window.
    const ro = new ResizeObserver(() => onResize());
    ro.observe(stage);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    init();

    // ---------- Cleanup ----------
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      removeConfetti();
      renderer.dispose();
      pmrem.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry?.dispose();
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        }
      });
      if (renderer.domElement.parentNode === stage)
        stage.removeChild(renderer.domElement);
    };
  }, []);

  // Tách tên thành từng ký tự để hiện dần
  const letters = Array.from(name).map((ch, i) =>
    ch === " " ? (
      <span key={i} className="ch sp">
        &nbsp;
      </span>
    ) : (
      <span key={i} className="ch">
        {ch}
      </span>
    )
  );

  return (
    <>
      <div className="bg-photo" />
      <div id="stage" ref={stageRef} />
      <div className="vignette" />
      <div className="scrim-top" />
      <div className="scrim-bottom" />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="diploma"
        ref={diplomaRef}
        src="/fpt_diploma.webp"
        alt="Bằng tốt nghiệp"
        loading="lazy"
        fetchPriority="low"
        decoding="async"
      />

      <div className="invite-top" ref={topRef}>
        <div className="invite-prefix">{INVITE.invitePrefix}</div>
        <h1 className="invite-name">{letters}</h1>
        <div className="invite-suffix">{INVITE.inviteSuffix}</div>
        <div className="invite-event">{INVITE.eventTitle}</div>
        <div className="invite-grad">{INVITE.graduate}</div>
        <div className="invite-school">{INVITE.school}</div>
      </div>

      <div className="invite-bottom" ref={bottomRef}>
        <div className="info-divider" />
        <div className="info-row">
          <div className="info-item">
            <span className="lbl">Thời gian</span>
            <span className="val">{INVITE.time}</span>
          </div>
          <div className="info-item">
            <span className="lbl">Ngày</span>
            <span className="val">{INVITE.date}</span>
          </div>
          <div className="info-item">
            <span className="lbl">Địa điểm</span>
            <a
              className="val venue-link"
              href="https://maps.app.goo.gl/qed8zZNsD35exc3U9"
              target="_blank"
              rel="noopener noreferrer"
            >
              {INVITE.venue}
            </a>
          </div>
        </div>
      </div>

      <div className="loader" ref={loaderRef}>
        <div className="ld-particles" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
        <div className="ld-core">
          <div className="ld-emblem">
            <span className="ld-glow" />
            <span className="ld-ring" />
            <span className="ld-cap">🎓</span>
          </div>
          <div className="ld-title">LỄ TỐT NGHIỆP</div>
          <div className="ld-sub">{INVITE.graduate}</div>
          <div className="ld-messages" aria-hidden="true">
            <span>Đang trải thảm đỏ…</span>
            <span>Đang thắp sáng khán đài…</span>
            <span>Đang kết hoa, treo đèn…</span>
            <span>Đang chuẩn bị lời mời…</span>
            <span>Sắp bắt đầu rồi…</span>
          </div>
          <div className="ld-bar">
            <i />
          </div>
        </div>
      </div>

      <div className="err" ref={errRef} />
    </>
  );
}
