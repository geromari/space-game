import { useRef, useMemo, useEffect, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, Line, Text, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Planet } from "./Planet";
import { Asteroid } from "./Asteroid";
import { Spacecraft } from "./Spacecraft";
import { LaunchVehicle, rocketLayout, ROCKET_VISUAL_SCALE } from "./Rocket";
import { engine, transfer } from "../sim/game";
import { useGame } from "../store";
import { planetPositions, transferPosition, clamp, launchAscent, masses } from "../sim/physics";
import { payloadEnvelope } from "../sim/payload";
import { launchFraction, launchDuration } from "../sim/journey";
import { launchers } from "../data/launchVehicles";
import { solarSystem } from "../data/solarSystem";
import {
  heliocentricBodyIds,
  heliocentricPosition,
  type HeliocentricBodyId,
} from "../sim/heliocentric";
function SceneLabel({
  children,
  position,
  color = "#d7e8eb",
  fontSize = 0.18,
}: {
  children: ReactNode;
  position: [number, number, number];
  color?: string;
  fontSize?: number;
}) {
  return (
    <Text
      position={position}
      color={color}
      fontSize={fontSize}
      anchorX="center"
      anchorY="middle"
      depthOffset={-1}
    >
      {children}
    </Text>
  );
}
function OrbitDirectionArrow({
  radius,
  angle,
  color,
  scale = 1,
}: {
  radius: number;
  angle: number;
  color: string;
  scale?: number;
}) {
  return (
    <group
      position={[radius * Math.cos(angle), 0.02, radius * Math.sin(angle)]}
      rotation={[0, angle + Math.PI / 2, 0]}
      scale={scale}
    >
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.12, 0.42, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
function LaunchComplex({ height, active, liftoff }: { height: number; active: boolean; liftoff: boolean }) {
  const arms = useRef<THREE.Group>(null), clamps = useRef<THREE.Group>(null);
  const retract = useRef(0), release = useRef(0);
  useFrame((_, dt) => {
    retract.current = THREE.MathUtils.damp(retract.current, active ? 1 : 0, 1.8, Math.min(dt, .1));
    release.current = THREE.MathUtils.damp(release.current, liftoff ? 1 : 0, 4, Math.min(dt, .1));
    if (arms.current) arms.current.rotation.z = retract.current * 1.2;
    if (clamps.current) clamps.current.rotation.y = release.current * .35;
  });
  const levels = [.2, .42, .64, .84, .96].map(f => height * f);
  const steel = <meshStandardMaterial color="#40545a" metalness={.72} roughness={.4} />;
  const concrete = <meshStandardMaterial color="#686e6a" metalness={.12} roughness={.92} />;
  return <group>
    {/* Rectangular foundation follows the surrounding planetary surface. */}
    <mesh position={[0,-.31,0]} receiveShadow castShadow><boxGeometry args={[30,.62,38]}/>{concrete}</mesh>
    <mesh position={[0,-.7,0]}><boxGeometry args={[38,.3,48]}/><meshStandardMaterial color="#343e3e" roughness={1}/></mesh>
    {/* Recessed flame trench, heat shield and exhaust diversion channel. */}
    <mesh position={[0,-.025,0]}><boxGeometry args={[3.3,.07,22]}/><meshStandardMaterial color="#10191b" metalness={.5} roughness={.8}/></mesh>
    {[-1,1].map(side=><group key={`trench-${side}`}>
      <mesh position={[side*2,-.02,0]}><boxGeometry args={[.42,.36,22]}/><meshStandardMaterial color="#404a49" metalness={.2} roughness={.9}/></mesh>
      <mesh position={[side*7.1,.06,0]}><boxGeometry args={[10,.16,26]}/>{concrete}</mesh>
      <mesh position={[side*4.2,.12,0]} rotation={[0,0,side*.28]}><boxGeometry args={[1.2,.24,3.4]}/><meshStandardMaterial color="#8c8e85" metalness={.32} roughness={.66}/></mesh>
      <mesh position={[side*10,.13,-2]}><boxGeometry args={[4,.26,5]}/>{concrete}</mesh>
    </group>)}
    <mesh position={[0,-.47,0]}><boxGeometry args={[10,.25,9]}/><meshStandardMaterial color="#202a2c" metalness={.4} roughness={.75}/></mesh>
    {/* Fixed steel service tower. Only its hinged umbilicals retract. */}
    <group position={[-6.5,0,-1]}>
      {[-1,1].map(z=><mesh key={z} position={[0,height*.5,z*2.25]} castShadow><boxGeometry args={[.5,height, .5]}/>{steel}</mesh>)}
      {levels.map(y=><group key={y}>
        <mesh position={[0,y,0]} castShadow><boxGeometry args={[.58,.24,5.1]}/>{steel}</mesh>
        <mesh position={[0,y+.2,0]}><boxGeometry args={[.7,.035,5.4]}/><meshStandardMaterial color="#c39351" metalness={.45} roughness={.5}/></mesh>
        {[-1,1].map(z=><mesh key={z} position={[0,y,z*2.25]}><boxGeometry args={[.48,.68,.48]}/><meshStandardMaterial color="#27373b" metalness={.6} roughness={.48}/></mesh>)}
      </group>)}
      {levels.slice(0,-1).map((y,i)=><group key={`brace-${i}`}>
        {[-1,1].map(z=><mesh key={z} position={[0,y+height*.1,z*2.25]} rotation={[0,0,(i%2?1:-1)*.42]}><boxGeometry args={[.16,height*.2,.16]}/>{steel}</mesh>)}
      </group>)}
      {Array.from({length:14},(_,i)=><mesh key={`stair-${i}`} position={[.48,i*height*.062,-1.7+i%2*.25]} rotation={[0,0,.1]}><boxGeometry args={[.9,.09,.65]}/><meshStandardMaterial color="#768285" metalness={.62} roughness={.48}/></mesh>)}
      {[-1,1].map(z=><mesh key={`rail-${z}`} position={[0,height*.52,z*2.8]}><boxGeometry args={[.16,height*1.06,.16]}/><meshStandardMaterial color="#53656a" metalness={.7} roughness={.4}/></mesh>)}
    </group>
    <group ref={arms} position={[-6.5,0,-1]}>
      {levels.slice(1,4).map((y,i)=><group key={`umbilical-${i}`} position={[0,y,0]}>
        <mesh position={[2.8,0,0]} castShadow><boxGeometry args={[5.5,.22,.3]}/>{steel}</mesh>
        <mesh position={[5.55,-.12,0]}><boxGeometry args={[.18,.62,.68]}/><meshStandardMaterial color="#d68d4c" metalness={.45} roughness={.48}/></mesh>
        <mesh position={[5.7,-.34,0]}><boxGeometry args={[.42,.12,.54]}/><meshStandardMaterial color="#242f32" metalness={.55} roughness={.4}/></mesh>
        <mesh position={[2.5,.2,.25]} rotation={[0,0,-.27]}><boxGeometry args={[5.3,.07,.07]}/><meshStandardMaterial color="#a8bac0" metalness={.8} roughness={.3}/></mesh>
      </group>)}
    </group>
    <group ref={clamps}>
      {[-1,1].flatMap(x=>[-1,1].map(z=><group key={`${x}:${z}`} position={[x*2.7,0,z*2.4]}>
        <mesh position={[0,.32,0]} castShadow><boxGeometry args={[.72,.64,.75]}/><meshStandardMaterial color="#cf8750" metalness={.5} roughness={.48}/></mesh>
        <mesh position={[0,.7,0]}><boxGeometry args={[.2,.22,.18]}/><meshStandardMaterial color="#9fa7a1" metalness={.75} roughness={.38}/></mesh>
      </group>))}
    </group>
    {/* Ground service lines, equipment kiosks, cable trays and safety markers. */}
    {[-1,1].map(side=><group key={`service-${side}`}>
      <mesh position={[side*11,.35,-8]}><boxGeometry args={[1.7,.7,2.4]}/><meshStandardMaterial color="#45565a" metalness={.55} roughness={.55}/></mesh>
      <mesh position={[side*11,.73,-8]}><boxGeometry args={[1.9,.08,2.6]}/><meshStandardMaterial color="#c7894f" metalness={.45} roughness={.48}/></mesh>
      <mesh position={[side*5,.08,-10]}><boxGeometry args={[.2,.15,18]}/><meshStandardMaterial color="#526265" metalness={.65} roughness={.5}/></mesh>
      {Array.from({length:5},(_,i)=><mesh key={i} position={[side*(8+i*.6),.014,10]} rotation={[-Math.PI/2,0,0]}><boxGeometry args={[.4,.4,.018]}/><meshBasicMaterial color={i%2?"#d1a455":"#172125"}/></mesh>)}
    </group>)}
    <group position={[9,0,-5]}>
      {[-1,1].map(x=><mesh key={x} position={[x*1.3,8,0]} castShadow><cylinderGeometry args={[.09,.07,16,10]}/><meshStandardMaterial color="#778689" metalness={.75} roughness={.32}/></mesh>)}
      <mesh position={[0,16,0]}><cylinderGeometry args={[.03,.03,3,8]}/><meshStandardMaterial color="#9ba5a2" metalness={.8}/></mesh>
      {[-1,1].map(x=><mesh key={x} position={[x*.5,8,0]}><boxGeometry args={[1,.12,.12]}/><meshStandardMaterial color="#8d9b98" metalness={.7}/></mesh>)}
    </group>
  </group>;
}
function LaunchSmoke({ active }: { active: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const count = 96;
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    mesh.current.visible = active;
    if (!active) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const age = (t * .32 + i / count) % 1;
      const angle = i * 2.399963;
      const spread = .8 + age * 10;
      dummy.position.set(Math.cos(angle) * spread + age * 1.6, .18 + age * (1.6 + (i % 7) * .1), Math.sin(angle) * spread);
      const size = .18 + age * (1.35 + (i % 5) * .14);
      dummy.scale.set(size * 1.25, size * .62, size);
      dummy.rotation.set(0, angle, 0);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(.09, .025, .39 + age * .19);
      mesh.current.setColorAt(i, color);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
    <sphereGeometry args={[1, 8, 6]} />
    <meshStandardMaterial color="#a39d8c" roughness={1} transparent opacity={.12} depthWrite={false} />
  </instancedMesh>;
}
function Launch() {
  const d = useGame((s) => s.data),
    settings = useGame((s) => s.settings),
    paused = useGame((s) => s.paused);
  const carrier = useRef<THREE.Group>(null),
    payload = useRef<THREE.Group>(null),
    spaceStars = useRef<THREE.Group>(null);
  const { camera, scene } = useThree(),
    target = useMemo(() => new THREE.Vector3(), []),
    cam = useMemo(() => new THREE.Vector3(), []);
  const p = launchFraction(d),
    reveal = clamp((p - 0.53) / 0.17, 0, 1),
    spread = clamp((p - 0.38) / 0.12, 0, 1),
    layout=rocketLayout(d.design.launcher??"titan"), envelope=payloadEnvelope(d.design),
    launcher= d.design.launcher??"titan",
    ascent=launchAscent(launchers[launcher].ascentModel, masses(d.design).wet, Math.max(0,d.stageTime-launchDuration(d)*.12));
  useFrame((_, dt) => {
    const data = engine.data,
      progress = launchFraction(data),
      lift = progress < .12 ? 0 : ascent.altitudeM * .014,
      angle = Math.max(0, progress - 0.7) * 0.8;
    target.set(Math.sin(angle) * 140, -60 + Math.cos(angle) * 140, 0);
    if (progress < 0.7) target.set(0, lift + layout.payloadY, 0);
    if (carrier.current) {
      carrier.current.position.set(
        0,
        lift - Math.max(0, progress - 0.7) * 110,
        0,
      );
      carrier.current.visible = progress < 0.86;
    }
    if (payload.current) {
      payload.current.position.copy(target);
      payload.current.scale.setScalar(
        ROCKET_VISUAL_SCALE + (1-ROCKET_VISUAL_SCALE) * clamp((progress - 0.7) / 0.16, 0, 1),
      );
      payload.current.rotation.y = Math.max(0,progress-.7)*.4;
    }
    if (spaceStars.current) spaceStars.current.visible = progress > 0.48;
    if (scene.background instanceof THREE.Color)
      scene.background
        .copy(new THREE.Color("#7895a5"))
        .lerp(new THREE.Color("#060d16"), clamp((progress - 0.25) / 0.5, 0, 1));
    const zoom = settings.flightZoom || 1;
    if (settings.flightCamera === "overview")
      cam.set(target.x + 34 * zoom, target.y + 20 * zoom, target.z + 42 * zoom);
    else if (settings.flightCamera === "follow")
      cam.set(target.x + 5 * zoom, target.y + 3 * zoom, target.z + 10 * zoom);
    else
      cam.set(
        target.x + Math.sin(data.stageTime * 0.04 + 1) * 17 * zoom,
        target.y + 7 * zoom,
        target.z + Math.cos(data.stageTime * 0.04 + 1) * 19 * zoom,
      );
    if (
      settings.cameraShake &&
      !settings.reducedMotion &&
      data.launchChecks.every(Boolean) &&
      progress > 0.12 &&
      progress < 0.65 &&
      !useGame.getState().paused &&
      !useGame.getState().tutorial.hold
    ) {
      cam.x += Math.sin(data.stageTime * 37) * 0.035;
      cam.y += Math.sin(data.stageTime * 43) * 0.03;
    }
    camera.position.lerp(
      cam,
      settings.reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 4),
    );
    camera.lookAt(target);
  });
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[-60, 70, 30]}
        intensity={3.4}
        color="#fff0d7"
      />
      <group ref={spaceStars}>
        <Stars radius={400} depth={200} count={850} factor={3} fade speed={0} />
      </group>
      <group position={[0, -400, 0]}>
        <Planet kind="earth" radius={400} spin={false} />
      </group>
      <LaunchComplex
        height={layout.height}
        active={d.launchChecks.every(Boolean) && p > 0.065}
        liftoff={p > 0.12}
      />
      <LaunchSmoke active={!paused && d.launchChecks.every(Boolean) && p > 0.12 && p < 0.7} />
      <group ref={carrier}>
        <LaunchVehicle
          id={d.design.launcher??"titan"}
          upperSeparation={clamp((p-(d.design.launcher==='titan'?0.49:0.38))/.13,0,1)}
          firing={d.launchChecks.every(Boolean) && p > 0.12 && p < 0.7}
          fairingOpen={settings.payloadView ? 0.85 : reveal}
          separation={spread}
        />
      </group>
      <group ref={payload}>
        <group position={[0,-envelope.centerY,0]}><Spacecraft design={d.design} solarDeployed={false} stowed /></group>
      </group>
    </>
  );
}
function Travel() {
  const d = useGame((s) => s.data),
    settings = useGame((s) => s.settings),
    { camera, scene } = useThree();
  const ship = useRef<THREE.Group>(null),
    earth = useRef<THREE.Group>(null),
    destination = useRef<THREE.Group>(null),
    target = useMemo(() => new THREE.Vector3(), []),
    cam = useMemo(() => new THREE.Vector3(), []),
    scale = 9.8 / transfer.r2;
  const visualElapsed = d.cruiseProgress * transfer.time;
  const displayOrbitRadius: Record<HeliocentricBodyId, number> = {
    mercury: 3.0,
    venus: 4.8,
    earth: 6.8,
    mars: 9.8,
    jupiter: 16.0,
    saturn: 22.0,
    uranus: 28.0,
    neptune: 34.0,
  };

  useEffect(() => {
    if (scene.background instanceof THREE.Color) {
      scene.background.set("#01040a");
    }
  }, [scene]);
  const path = useMemo(
    () =>
      Array.from({ length: 121 }, (_, i) => {
        const f = i / 120;
        if (d.destination === "mars") {
          const p = transferPosition(f);
          return [p.x * scale, 0, p.z * scale] as [number, number, number];
        }
        if (d.destination === "earth")
          return [
            -4 + 3 * Math.cos(f * Math.PI * 2),
            0,
            3 * Math.sin(f * Math.PI * 2),
          ] as [number, number, number];
        return [-1 + 6.8 * f, 0, -4 * Math.sin(Math.PI * f)] as [
          number,
          number,
          number,
        ];
      }),
    [d.destination, scale],
  );
  const orbit = (r: number) =>
    Array.from(
      { length: 129 },
      (_, i) =>
        [
          r * Math.cos((i / 128) * Math.PI * 2),
          0,
          r * Math.sin((i / 128) * Math.PI * 2),
        ] as [number, number, number],
    );
  const previewOrbit = (r: number) =>
    Array.from(
      { length: 129 },
      (_, i) =>
        [
          r * Math.cos((i / 128) * Math.PI * 2),
          0,
          r * Math.sin((i / 128) * Math.PI * 2),
        ] as [number, number, number],
    );
  const inclinedPosition = (x: number, z: number, inclination: number) => ({
    x,
    y: Math.sin(inclination) * z,
    z: Math.cos(inclination) * z,
  });
  useEffect(() => {
    camera.position.set(0, 13, 15);
  }, [camera, d.destination]);
  useEffect(() => {
    if (settings.flightCamera === "overview")
      camera.position.set(
        0,
        13 * (settings.flightZoom || 1),
        15 * (settings.flightZoom || 1),
      );
  }, [camera, settings.flightCamera, settings.flightZoom]);
  useFrame((_, dt) => {
    const data = engine.data,
      f = data.cruiseProgress;
    if (data.destination === "mars") {
      const p = transferPosition(f),
        planets = planetPositions(f);
      const earthPoint = inclinedPosition(planets.earth.x * scale, planets.earth.z * scale, 0.032);
      const marsPoint = inclinedPosition(planets.mars.x * scale, planets.mars.z * scale, 0.032);
      target.set(
        p.x * scale,
        0,
        p.z * scale +
          1.28 * Math.max(0, 1 - f * 14) +
          0.65 * Math.max(0, (f - 0.95) * 20),
      );
      earth.current?.position.set(
        earthPoint.x,
        earthPoint.y,
        earthPoint.z,
      );
      destination.current?.position.set(
        marsPoint.x,
        marsPoint.y,
        marsPoint.z,
      );
    } else {
      earth.current?.position.set(-4, 0, 0);
      destination.current?.position.set(7, 0, 0);
      if (data.destination === "earth")
        target.set(
          -4 + 3 * Math.cos(f * Math.PI * 2),
          0,
          3 * Math.sin(f * Math.PI * 2),
        );
      else target.set(-1 + 6.8 * f, 0, -4 * Math.sin(Math.PI * f));
    }
    ship.current?.position.copy(target);
    if (ship.current) ship.current.rotation.y = 0.4 + f * Math.PI;
    if (settings.flightCamera === "overview") {
      const selected = settings.selectedPlanet;
      if (selected === "earth" || selected === "mars") {
        const selectedPoint =
          selected === "earth"
            ? planetPositions(f).earth
            : planetPositions(f).mars;
        target.set(selectedPoint.x * scale, 0, selectedPoint.z * scale);
      } else if (selected !== "sun" && selected !== "moon") {
        const selectedPoint = heliocentricPosition(
          selected as HeliocentricBodyId,
          visualElapsed,
        );
        const selectedRadius = displayOrbitRadius[selected as HeliocentricBodyId];
        target.set(
          selectedRadius * Math.cos(selectedPoint.angle),
          selectedRadius * Math.sin(selectedPoint.angle) * 0.06,
          selectedRadius * Math.sin(selectedPoint.angle),
        );
      } else {
        target.set(0, 0, 0);
      }
      camera.lookAt(target);
      return;
    }
    const z = settings.flightZoom || 1;
    if (settings.flightCamera === "follow")
      cam.set(target.x + 2.2 * z, target.y + 1.2 * z, target.z + 3.0 * z);
    else if (settings.flightCamera === "cinematic")
      cam.set(
        target.x + Math.sin(data.stageTime * 0.04 + 1) * 3.6 * z,
        target.y + 1.8 * z,
        target.z + Math.cos(data.stageTime * 0.04 + 1) * 3.6 * z,
      );
    else cam.set(target.x + 5.5 * z, target.y + 5.5 * z, target.z + 7.5 * z);
    camera.position.lerp(
      cam,
      settings.reducedMotion ? 1 : 1 - Math.exp(-dt * 3),
    );
    camera.lookAt(target);
  });
  return (
    <>
      <Stars radius={260} depth={100} count={3500} factor={3.2} fade speed={0} />
      <Stars radius={140} depth={50} count={900} factor={4.5} fade speed={0} />
      <ambientLight intensity={0.18} color="#6d8da8" />
      {d.destination === "mars" ? (
        <>
          <Planet kind="sun" radius={1.4} spin={false} />
          {settings.showLabels && (
            <SceneLabel
              position={[0, 2.0, 0]}
              color="#f0c77b"
              fontSize={0.2}
            >
              SUN · ORBITAL FOCUS
            </SceneLabel>
          )}
          {settings.showOrbits && (
            <>
              <Line
                points={orbit(transfer.r1 * scale)}
                color="#4b9ab0"
                lineWidth={1.2}
                rotation={[0.032, 0, 0]}
              />
              <Line
                points={orbit(transfer.r2 * scale)}
                color="#c66d4e"
                lineWidth={1.2}
                rotation={[0.032, 0, 0]}
              />
              <OrbitDirectionArrow
                radius={transfer.r1 * scale}
                angle={1.25}
                color="#78d2e0"
                scale={0.9}
              />
              <OrbitDirectionArrow
                radius={transfer.r2 * scale}
                angle={2.25}
                color="#f09a72"
              />
            </>
          )}
          {heliocentricBodyIds
            .filter((body) => body !== "earth" && body !== "mars")
            .map((body) => {
            const positionM = heliocentricPosition(body, visualElapsed);
            const displayRadius = displayOrbitRadius[body];
            const position = {
              x: displayRadius * Math.cos(positionM.angle),
              y: displayRadius * Math.sin(positionM.angle) * 0.06,
              z: displayRadius * Math.sin(positionM.angle),
            };
            const orbit = displayRadius;
            const radius =
              body === "jupiter"
                ? 1.15
                : body === "saturn"
                  ? 0.95
                  : body === "venus"
                    ? 0.7
                    : body === "mercury"
                      ? 0.42
                      : body === "uranus"
                        ? 0.72
                        : 0.68;
            return (
            <group
              key={body}
              position={[0, 0, 0]}
            >
              {settings.showOrbits && (
                <Line
                  points={previewOrbit(orbit)}
                  color="#314b59"
                  transparent
                  opacity={0.58}
                  rotation={[0.032, 0, 0]}
                />
              )}
              <group position={[position.x, position.y, position.z]}>
                <Planet kind={body} radius={radius} />
                {settings.showLabels && (
                  <SceneLabel position={[0, radius + 0.35, 0]}>
                    {solarSystem[body].name.toUpperCase()}
                  </SceneLabel>
                )}
              </group>
            </group>
            );
          })}
        </>
      ) : null}
      {settings.showTrajectory && (
        <Line
          points={path}
          color="#8ed5df"
          lineWidth={1.8}
          dashed
          dashSize={0.12}
          gapSize={0.08}
        />
      )}
      <group ref={earth}>
        <Planet kind="earth" radius={d.destination === "mars" ? 0.82 : 2.2} />
        {settings.showLabels && (
          <SceneLabel position={[0, d.destination === "mars" ? 1.15 : 2.7, 0]}>
            EARTH · DEPARTURE
          </SceneLabel>
        )}
      </group>
      {d.destination !== "earth" && (
        <group ref={destination}>
          {d.destination === "asteroid" ? (
            <Asteroid radius={0.8} />
          ) : (
            <Planet
              kind={d.destination === "moon" ? "moon" : "mars"}
              radius={d.destination === "moon" ? 0.9 : 0.76}
            />
          )}
          {settings.showLabels && (
            <SceneLabel
              position={[0, d.destination === "moon" ? 1.35 : 1.15, 0]}
            >
              {d.destination.toUpperCase()} · ARRIVAL
            </SceneLabel>
          )}
        </group>
      )}
      <group ref={ship}>
        <Spacecraft
          design={d.design}
          scale={0.34}
          solarDeployed={d.cruiseChoice !== "save"}
          stowed={false}
        />
        {settings.showLabels && (
          <SceneLabel position={[0, 0.75, 0]}>
            VYDEX–01 · TRANSFER
          </SceneLabel>
        )}
      </group>
      {settings.flightCamera === "overview" && (
        <OrbitControls
            target={[0, 0, 0]}
          minDistance={5}
          maxDistance={30}
          maxPolarAngle={Math.PI * 0.49}
        />
      )}
    </>
  );
}
export default function Cosmos() {
  const stage = useGame((s) => s.data.stage),
    destination = useGame((s) => s.data.destination),
    { camera, scene } = useThree();
  useEffect(() => {
    if (stage !== "launch" && scene.background instanceof THREE.Color) {
      scene.background.set("#01040a");
    }
    if (stage === "briefing" || stage === "debrief") {
      camera.position.set(0, 1, 12);
      camera.lookAt(2.4, 0.2, 0);
    }
  }, [stage, destination, camera, scene]);
  return (
    <>
      <color attach="background" args={["#01050b"]} />
      {stage === "launch" ? (
        <Launch />
      ) : stage === "cruise" ? (
        <Travel />
      ) : (
        <>
          <ambientLight intensity={0.12} />
          <directionalLight
            position={[-6, 3, 8]}
            intensity={1.35}
            color="#fff5e9"
          />
          <Stars
            radius={85}
            depth={35}
            count={1200}
            factor={2}
            fade
            speed={0}
          />
          <group position={[2.4, 0.2, 0]}>
            {destination === "asteroid" ? (
              <Asteroid radius={2.7} />
            ) : (
              <Planet
                kind={destination}
                radius={
                  destination === "mercury"
                    ? 2.4
                    : destination === "venus"
                      ? 3
                      : destination === "saturn"
                        ? 2.1
                        : destination === "uranus" || destination === "neptune"
                          ? 2.7
                          : 3.4
                }
              />
            )}
          </group>
          <OrbitControls
            target={[2.4, 0.2, 0]}
            enablePan={false}
            minDistance={5}
            maxDistance={22}
          />
        </>
      )}
    </>
  );
}
