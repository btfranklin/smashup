import type {
  CarFragment,
  DebrisParticle,
  DustPuff,
  SmokePuff,
} from "../types";

export function drawSmokePuffs(
  ctx: CanvasRenderingContext2D,
  puffs: SmokePuff[],
): void {
  if (puffs.length === 0) {
    return;
  }

  ctx.save();
  for (const puff of puffs) {
    const life = 1 - puff.age / puff.ttl;
    const radius = puff.size + (1 - life) * (12 + puff.density * 8);
    const smokeAlpha = life * (0.16 + puff.density * 0.34);
    const shellGradient = ctx.createRadialGradient(
      puff.x - radius * 0.2,
      puff.y - radius * 0.25,
      radius * 0.15,
      puff.x,
      puff.y,
      radius,
    );
    shellGradient.addColorStop(
      0,
      `rgba(${Math.round(118 - puff.density * 48)}, ${Math.round(114 - puff.density * 44)}, ${Math.round(108 - puff.density * 40)}, ${smokeAlpha * 0.8})`,
    );
    shellGradient.addColorStop(
      0.55,
      `rgba(${Math.round(72 - puff.density * 30)}, ${Math.round(68 - puff.density * 28)}, ${Math.round(64 - puff.density * 26)}, ${smokeAlpha})`,
    );
    shellGradient.addColorStop(1, `rgba(16, 14, 13, ${smokeAlpha * 0.82})`);
    ctx.fillStyle = shellGradient;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (puff.flame > 0.02) {
      const flameRadius = radius * (0.36 + puff.flame * 0.18) * life;
      const flameGradient = ctx.createRadialGradient(
        puff.x - radius * 0.24,
        puff.y - radius * 0.16,
        0,
        puff.x,
        puff.y,
        Math.max(flameRadius, 1),
      );
      flameGradient.addColorStop(
        0,
        `rgba(255, 244, 186, ${life * puff.flame * 0.95})`,
      );
      flameGradient.addColorStop(
        0.34,
        `rgba(255, 170, 64, ${life * puff.flame * 0.88})`,
      );
      flameGradient.addColorStop(
        0.68,
        `rgba(214, 78, 22, ${life * puff.flame * 0.62})`,
      );
      flameGradient.addColorStop(
        1,
        `rgba(28, 18, 16, ${life * puff.flame * 0.1})`,
      );
      ctx.fillStyle = flameGradient;
      ctx.beginPath();
      ctx.arc(
        puff.x - radius * 0.06,
        puff.y - radius * 0.1,
        flameRadius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawDebrisParticles(
  ctx: CanvasRenderingContext2D,
  particles: DebrisParticle[],
): void {
  if (particles.length === 0) {
    return;
  }

  ctx.save();
  for (const particle of particles) {
    const life = 1 - particle.age / particle.ttl;
    const alpha = life * 0.85;
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.fillStyle = `rgba(72, 64, 54, ${alpha})`;
    ctx.fillRect(
      -particle.size * 0.6,
      -particle.size * 0.35,
      particle.size * 1.2,
      particle.size * 0.7,
    );
    ctx.fillStyle = `rgba(182, 154, 112, ${alpha * particle.tone})`;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawCarFragments(
  ctx: CanvasRenderingContext2D,
  fragments: CarFragment[],
): void {
  if (fragments.length === 0) {
    return;
  }

  ctx.save();
  for (const fragment of fragments) {
    ctx.save();
    ctx.translate(fragment.x, fragment.y);
    ctx.rotate(fragment.rotation);
    ctx.fillStyle = fragment.color;
    ctx.strokeStyle = fragment.edgeColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    fragment.points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function drawDustPuffs(
  ctx: CanvasRenderingContext2D,
  puffs: DustPuff[],
): void {
  if (puffs.length === 0) {
    return;
  }
  ctx.save();
  for (const puff of puffs) {
    const life = 1 - puff.age / puff.ttl;
    const radius = puff.size + (1 - life) * 10;
    const alpha = puff.alpha * life;
    ctx.fillStyle = `rgba(${Math.round(188 * puff.tone)}, ${Math.round(144 * puff.tone)}, 88, ${alpha})`;
    ctx.beginPath();
    ctx.arc(puff.x, puff.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
