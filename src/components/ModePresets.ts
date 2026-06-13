export type DrawingMode = 'free_draw' | 'story_scene' | 'teaching_diagram' | 'whiteboard_flow'

export interface ModePreset {
  id: DrawingMode
  label: string
  icon: string
  description: string
  exampleCommands: string[]
  planFocus: string
  promptHint: string
}

export const MODE_PRESETS: Record<DrawingMode, ModePreset> = {
  free_draw: {
    id: 'free_draw',
    label: '自由绘画',
    icon: '🎨',
    description: '随手涂鸦，想到什么画什么。适合快速记录灵感。',
    exampleCommands: [
      '画一个红色太阳和一棵绿色树',
      '画一只猫蹲在窗台上',
      '画一杯冒着热气的咖啡',
    ],
    planFocus: '自由发挥，简洁直接',
    promptHint: '用户需要快速草图，风格极简手绘线条风，不要过度设计。',
  },
  story_scene: {
    id: 'story_scene',
    label: '故事场景',
    icon: '🌙',
    description: '构建叙事性画面，有情绪、有故事感。',
    exampleCommands: [
      '画一个小女孩站在月亮下面',
      '画一座城堡在远处的山丘上',
      '画一只狐狸在雪地里看着星空',
    ],
    planFocus: '故事氛围优先，注意构图层次和情绪表达',
    promptHint: '用户想讲述一个场景故事。注重构图氛围、元素间关系、留白意境。极简手绘线条风，画面要有呼吸感。',
  },
  teaching_diagram: {
    id: 'teaching_diagram',
    label: '课堂讲解',
    icon: '📐',
    description: '绘制教学用图示，清晰标注关系。',
    exampleCommands: [
      '画太阳、地球和月亮，表示月亮绕地球转',
      '画光合作用的过程示意图',
      '画一个三角形的内角和等于180度',
    ],
    planFocus: '教学清晰度优先，标注关系明确，元素布局合理',
    promptHint: '用户用于课堂教学。需要清晰标注元素间关系，考虑用箭头、标签辅助说明。极简线条风，避免多余装饰。',
  },
  whiteboard_flow: {
    id: 'whiteboard_flow',
    label: '白板流程',
    icon: '🔄',
    description: '绘制流程图、架构图、步骤示意。',
    exampleCommands: [
      '画一个从登录到支付的流程图',
      '画一个微服务架构示意图',
      '画一个三阶段的用户增长漏斗',
    ],
    planFocus: '流程逻辑清晰，步骤分组明确，箭头方向准确',
    promptHint: '用户需要流程或架构图。注重步骤顺序、层级关系、箭头方向。极简手绘线条风，用框和连线表达结构。',
  },
}

/** Config pseudo-mode (not a drawing mode, used for navigation state). */
export const CONFIG_MODE = 'config' as const
export type AppPage = typeof CONFIG_MODE | DrawingMode

export function isDrawingMode(mode: AppPage): mode is DrawingMode {
  return mode !== CONFIG_MODE
}
