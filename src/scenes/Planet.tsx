import { useEffect, useRef, useState, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "../store";
import type { SolarBodyId } from "../data/solarSystem";

const files: Partial<Record<SolarBodyId, string>> = {
  mars: "/assets/planets/mars.jpg",
  earth: "/assets/planets/earth.jpg",
  sun: "/assets/planets/sun.jpg",
  moon: "/assets/planets/moon.jpg",
  venus: "/assets/planets/venus.jpg",
  jupiter: "/assets/planets/jupiter.jpg",
  saturn: "/assets/planets/saturn.jpg",
};

const planetTints: Record<SolarBodyId, string> = {
  sun: "#ffd34f",
  mercury: "#9b8e82",
  venus: "#d9a85d",
  earth: "#4b91ba",
  mars: "#b9573e",
  moon: "#aaa9a3",
  jupiter: "#bd9675",
  saturn: "#c5a96f",
  uranus: "#74c7c9",
  neptune: "#4d79c7",
};

export function SunStar({ radius = 1.4 }: { radius?: number }) {
  const map = useLocalMap(files.sun ?? null);
  const coreRef = useRef<THREE.Mesh>(null);
  const coronaRef = useRef<THREE.Mesh>(null);
  const outerCoronaRef = useRef<THREE.Mesh>(null);
  const flareGroup = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreRef.current) coreRef.current.rotation.y = t * 0.018;
    if (coronaRef.current) {
      const s = 1.05 + Math.sin(t * 1.5) * 0.015;
      coronaRef.current.scale.set(s, s, s);
    }
    if (outerCoronaRef.current) {
      const s = 1.32 + Math.sin(t * 1.1 + 0.8) * 0.025;
      outerCoronaRef.current.scale.set(s, s, s);
      outerCoronaRef.current.rotation.z = t * 0.015;
    }
    if (flareGroup.current) {
      flareGroup.current.rotation.z = t * 0.025;
      flareGroup.current.rotation.y = t * 0.018;
    }
  });

  return (
    <group>
      {/* Central Omnidirectional Solar Radiance */}
      <pointLight
        position={[0, 0, 0]}
        intensity={190}
        color="#fff4e0"
        distance={250}
        decay={1.15}
      />

      {/* Photosphere with NASA Solar Texture */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[radius, 64, 48]} />
        <meshBasicMaterial
          map={map}
          color={map ? "#fff4e5" : "#ffba42"}
        />
      </mesh>

      {/* Photosphere Limb Darkening & Convective Rim Glow */}
      <mesh scale={1.008}>
        <sphereGeometry args={[radius, 48, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            innerColor: { value: new THREE.Color("#ffaa22") },
            rimColor: { value: new THREE.Color("#ff4400") },
          }}
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              vec4 p = modelViewMatrix * vec4(position, 1.0);
              vNormal = normalize(normalMatrix * normal);
              vView = normalize(-p.xyz);
              gl_Position = projectionMatrix * p;
            }
          `}
          fragmentShader={`
            uniform vec3 innerColor;
            uniform vec3 rimColor;
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              float d = dot(normalize(vNormal), normalize(vView));
              float rim = pow(1.0 - clamp(d, 0.0, 1.0), 2.2);
              vec3 col = mix(innerColor, rimColor, rim);
              gl_FragColor = vec4(col, rim * 0.8);
            }
          `}
        />
      </mesh>

      {/* Inner Chromosphere / Transition Region */}
      <mesh ref={coronaRef} scale={1.07}>
        <sphereGeometry args={[radius, 32, 24]} />
        <meshBasicMaterial
          color="#ff7711"
          transparent
          opacity={0.36}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Outer Corona Halo */}
      <mesh ref={outerCoronaRef} scale={1.35}>
        <sphereGeometry args={[radius, 32, 24]} />
        <meshBasicMaterial
          color="#ffaa33"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Solar Prominence Arcs */}
      <group ref={flareGroup}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i * Math.PI) / 3;
          return (
            <group key={i} rotation={[0, 0, angle]}>
              <mesh position={[radius * 1.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[radius * 0.16, radius * 0.024, 8, 16, Math.PI * 0.82]} />
                <meshBasicMaterial
                  color="#ff4400"
                  transparent
                  opacity={0.38}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}
// Optional image loading leaves a colored sphere visible if an asset cannot load.
function useLocalMap(url: string | null, color = true) {
  const [map, setMap] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    setMap(null);
    if (!url) return;
    let active = true;
    let texture: THREE.Texture | undefined;
    new THREE.TextureLoader().load(
      url,
      (t) => {
        texture = t;
        t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 4;
        if (active) setMap(t);
        else t.dispose();
      },
      undefined,
      () => {
        /* Keep the material fallback. */
      },
    );
    return () => {
      active = false;
      texture?.dispose();
    };
  }, [url, color]);
  return map;
}
export function Planet({
  kind,
  radius = 1,
  spin = true,
}: {
  kind: SolarBodyId;
  radius?: number;
  spin?: boolean;
}) {
  if (kind === "sun") {
    return <SunStar radius={radius} />;
  }
  const map = useLocalMap(files[kind] ?? null);
  const venusClouds = useMemo(() => {
    if (kind !== "venus") return null;
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d")!,
      im = ctx.createImageData(512, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 512; x++) {
        const v =
            7 * Math.sin(y * 0.13 + Math.sin(x * 0.018) * 2) +
            4 * Math.cos(x * 0.03 - y * 0.05),
          i = (y * 512 + x) * 4;
        im.data[i] = 216 + v;
        im.data[i + 1] = 195 + v;
        im.data[i + 2] = 153 + v;
        im.data[i + 3] = 255;
      }
    ctx.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [kind]);
  useEffect(() => () => venusClouds?.dispose(), [venusClouds]);
  const bump = useLocalMap(
    kind === "mars" ? "/assets/planets/mars-bump.jpg" : null,
    false,
  );
  const clouds = useLocalMap(
    kind === "earth" ? "/assets/planets/earth-clouds.png" : null,
  );
  const globe = useRef<THREE.Group>(null),
    cloud = useRef<THREE.Mesh>(null);
  const reduced = useGame((s) => s.settings.reducedMotion);
  useFrame((_, dt) => {
    const ui = useGame.getState();
    if (
      !spin ||
      reduced ||
      ui.paused ||
      ui.drawer ||
      ui.workshop.info ||
      ui.tutorial.hold
    )
      return;
    if (globe.current) globe.current.rotation.y += dt * 0.025;
    if (cloud.current) cloud.current.rotation.y += dt * 0.006;
  });
  return (
    <group ref={globe} rotation={[0, -0.6, kind === "earth" ? 0.15 : 0.12]}>
      <mesh>
        <sphereGeometry args={[radius, 64, 40]} />
        <meshStandardMaterial
          map={map}
          color={planetTints[kind]}
          roughness={kind === "earth" ? 0.7 : 0.96}
          metalness={0}
          bumpMap={kind === "mars" ? bump : null}
          bumpScale={radius * 0.009}
        />
      </mesh>
      {kind === "venus" && venusClouds && (
        <mesh scale={1.003}>
          <sphereGeometry args={[radius, 64, 40]} />
          <meshStandardMaterial map={venusClouds} roughness={1} />
        </mesh>
      )}
      {kind === "earth" && clouds && (
        <mesh ref={cloud} scale={1.009}>
          <sphereGeometry args={[radius, 48, 32]} />
          <meshStandardMaterial
            map={clouds}
            transparent
            opacity={0.7}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      )}
      {["earth", "mars", "venus"].includes(kind) && (
        <mesh scale={kind === "earth" ? 1.025 : 1.012}>
          <sphereGeometry args={[radius, 48, 32]} />
          <shaderMaterial
            transparent
            side={THREE.BackSide}
            depthWrite={false}
            uniforms={{
              tint: {
                value: new THREE.Color(
                  kind === "earth" ? "#6bbefc" : "#d89a77",
                ),
              },
            }}
            vertexShader={
              "varying vec3 vNormal; varying vec3 vView; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}"
            }
            fragmentShader={
              "uniform vec3 tint; varying vec3 vNormal; varying vec3 vView; void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),3.0);gl_FragColor=vec4(tint,rim*0.38);}"
            }
          />
        </mesh>
      )}
      {kind === "saturn" && (
        <group rotation={[-Math.PI / 2 + 0.4, 0, 0]}>
          {[
            [1.25, 1.46, "#88795b"],
            [1.48, 1.92, "#c6b58c"],
            [1.98, 2.24, "#978768"],
          ].map(([inner, outer, color], i) => (
            <mesh key={i}>
              <ringGeometry
                args={[Number(inner) * radius, Number(outer) * radius, 96]}
              />
              <meshStandardMaterial
                color={String(color)}
                side={THREE.DoubleSide}
                transparent
                opacity={0.82}
                roughness={0.9}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
