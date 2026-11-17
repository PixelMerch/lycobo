"""从自有 SVG 字形生成导航 Rive 动画，不依赖在线编辑器或第三方品牌素材。"""

import math
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'apps/web/public/brand/lycobo-landing.svg'
TARGET = ROOT / 'apps/web/public/brand/lycobo-navigation.riv'


def uint(value):
    """编码 Rive 公开格式使用的小端 LEB128 整数。"""
    result = bytearray()
    while value > 127:
        result.append((value & 127) | 128)
        value >>= 7
    result.append(value)
    return result


# 类型与属性编号来自 Rive 公开运行时 generated/*_base.hpp，使用 7.0 基础字段。
STRINGS = {4, 55}
FLOATS = {7, 8, 13, 14, 15, 16, 17, 18, 24, 25, 63, 64, 65, 66, 70}


class RiveWriter:
    """写入品牌所需的路径、颜色与线性关键帧，保持产物可重复构建。"""

    def __init__(self):
        self.data = bytearray(b'RIVE') + uint(7) + uint(0) + uint(0) + uint(0)
        self.next_id = 0
        self.tracks = {}

    def record(self, kind, fields):
        self.data.extend(uint(kind))
        for key, value in fields.items():
            self.data.extend(uint(key))
            if key in STRINGS:
                encoded = value.encode('utf-8')
                self.data.extend(uint(len(encoded)) + encoded)
            elif key in FLOATS:
                self.data.extend(struct.pack('<f', value))
            elif key == 37:
                self.data.extend(struct.pack('<I', value))
            else:
                self.data.extend(uint(value))
        self.data.extend(uint(0))

    def component(self, kind, fields):
        index = self.next_id
        self.next_id += 1
        self.record(kind, fields)
        return index

    def track(self, index, prop, values):
        self.tracks.setdefault(index, {})[prop] = values

    def shape(self, name, contours, x=0, y=0, parent=0):
        shape = self.component(3, {4: name, 5: parent, 13: x, 14: y})
        vertices = []
        for contour in contours:
            path = self.component(16, {5: shape, 32: 1})
            vertices.append([self.component(5, {5: path, 24: px, 25: py})
                             for px, py in contour])
        fill = self.component(20, {5: shape, 40: 1})
        self.component(18, {5: fill, 37: 0xFFFFFFFF})
        return shape, vertices

    def finish(self):
        self.record(31, {55: 'wordmark-to-focus', 56: 120, 57: 120})
        for index, props in self.tracks.items():
            self.record(25, {51: index})
            for prop, values in props.items():
                self.record(26, {53: prop})
                for frame, value in values:
                    self.record(30, {67: frame, 68: 2, 69: 2 if prop == 18 else 1, 70: value})
        TARGET.write_bytes(self.data)


def read_contours(path):
    """解析现有字形的直线与二次曲线，曲线按固定精度采样成矢量顶点。"""
    tokens = re.findall(r'[A-Za-z]|-?\d+(?:\.\d+)?', path)
    contours, contour = [], []
    cursor = (0, 0)
    index = 0
    while index < len(tokens):
        command = tokens[index]
        index += 1
        count = {'M': 2, 'L': 2, 'H': 1, 'V': 1, 'Q': 4, 'Z': 0}[command]
        values = list(map(float, tokens[index:index + count]))
        index += count
        if command == 'Z':
            contours.append(contour)
            contour = []
            continue
        if command == 'H':
            point = (values[0], cursor[1])
        elif command == 'V':
            point = (cursor[0], values[0])
        elif command == 'Q':
            control, point = values[:2], tuple(values[2:])
            for step in range(1, 9):
                t = step / 8
                contour.append(tuple((1-t)**2 * cursor[axis] + 2*(1-t)*t*control[axis]
                                     + t*t*point[axis] for axis in range(2)))
            cursor = point
            continue
        else:
            point = tuple(values)
        contour.append(point)
        cursor = point
    return contours


def resample(points, count):
    """按轮廓弧长重采样，使字母与图形拥有可连续插值的同一组顶点。"""
    points = [point for index, point in enumerate(points)
              if index == 0 or point != points[index-1]]
    closed = points + [points[0]]
    lengths = [0]
    for a, b in zip(closed, closed[1:]):
        lengths.append(lengths[-1] + math.dist(a, b))
    output, segment = [], 0
    for index in range(count):
        distance = lengths[-1] * index / count
        while lengths[segment + 1] < distance:
            segment += 1
        t = (distance-lengths[segment]) / (lengths[segment+1]-lengths[segment])
        output.append(tuple(closed[segment][axis]*(1-t)+closed[segment+1][axis]*t
                            for axis in range(2)))
    return output


def focus_contour():
    """沿字母 C 的同一绕行方向创建最终开口圆环。"""
    points = []
    for radius, start, end in [(52.8, -30, -30), (30.8, -30, -330),
                               (52.8, -330, -30)]:
        steps = max(1, round(abs(end-start)/3))
        for step in range(steps+1):
            angle = math.radians(start + (end-start)*step/steps)
            points.append((radius*math.cos(angle), radius*math.sin(angle)))
    return points


def build():
    """生成小写字标收拢、C 连续变形与圆点入场的单条滚动时间线。"""
    writer = RiveWriter()
    writer.record(23, {})
    writer.component(1, {4: 'Lycobo navigation', 7: 602, 8: 176})
    # 使用 animate 技能指定的形变曲线，插值仍由滚动位置决定。
    writer.component(28, {63: .77, 64: 0, 65: .175, 66: 1})
    writer.component(28, {63: .23, 64: 1, 65: .32, 66: 1})
    paths = ET.parse(SOURCE).getroot().findall('.//{http://www.w3.org/2000/svg}path')[1:]
    for letter, path in enumerate(paths):
        contours = read_contours(path.attrib['d'])
        offset = 138 if letter == 0 else 176
        contours = [[(x-offset, y-11) for x, y in contour] for contour in contours]
        if letter == 2:
            start = resample([(x-168, y-92) for x, y in contours[0]], 100)
            end = resample(focus_contour(), 100)
            shape, vertices = writer.shape('c-to-focus', [start], 168, 92)
            writer.track(shape, 13, [(0, 168), (18, 168), (90, 70.4), (120, 70.4)])
            writer.track(shape, 14, [(0, 92), (18, 92), (90, 83.4), (120, 83.4)])
            writer.track(shape, 15, [(0, 0), (42, 0), (108, -math.pi/4), (120, -math.pi/4)])
            for vertex, a, b in zip(vertices[0], start, end):
                for axis, prop in enumerate([24, 25]):
                    writer.track(vertex, prop, [(0, a[axis]), (24, a[axis]),
                                               (90, b[axis]), (120, b[axis])])
            continue
        shape, _ = writer.shape('lycobo-' + str(letter), contours)
        # 从右向左收拢；左侧字母提前让位，保留 C 作为全过程的视觉锚点。
        delay = {0: 0, 1: 5, 3: 12, 4: 6, 5: 0}[letter]
        writer.track(shape, 18, [(0, 1), (delay+8, 1), (delay+42, 0), (120, 0)])
        shift = 22 if letter < 2 else -40 - 8*letter
        writer.track(shape, 13, [(0, 0), (delay, 0), (delay+48, shift), (120, shift)])
    # 圆点与环共享旋转中心，最后出现于右上方。
    rotation = writer.component(2, {4: 'focus-dot-orbit', 5: 0, 13: 70.4, 14: 83.4})
    points = [(41.8+11*math.cos(i*math.tau/48), 11*math.sin(i*math.tau/48))
              for i in range(48)]
    dot, _ = writer.shape('focus-dot', [points], parent=rotation)
    writer.track(rotation, 15, [(0, 0), (42, 0), (108, -math.pi/4), (120, -math.pi/4)])
    writer.track(dot, 18, [(0, 0), (68, 0), (108, 1), (120, 1)])
    writer.finish()
    print(f'{TARGET.relative_to(ROOT)}: {TARGET.stat().st_size} bytes')


if __name__ == '__main__':
    build()
