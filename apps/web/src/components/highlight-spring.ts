type SpringParameters = { stiffness: number; damping: number };

/** 创建高亮边缘的弹簧状态，水平和垂直底板都用同一积分步骤。 */
export function springAt(position: number, parameters: SpringParameters) {
  return { position, target: position, velocity: 0, parameters };
}

/** 将长帧限制在四个小步内，防止弹簧在页面掉帧后直接跳到终点。 */
export function stepSpring(edge: ReturnType<typeof springAt>, delta: number) {
  const step = Math.min(delta / 1000, 1 / 30) / 4;
  const { stiffness, damping } = edge.parameters;
  for (let index = 0; index < 4; index += 1) {
    const acceleration = stiffness * (edge.target - edge.position) - damping * edge.velocity;
    edge.velocity += acceleration * step;
    edge.position += edge.velocity * step;
  }
  if (Math.abs(edge.target - edge.position) > 0.1 || Math.abs(edge.velocity) > 0.5) return false;
  edge.position = edge.target;
  edge.velocity = 0;
  return true;
}
