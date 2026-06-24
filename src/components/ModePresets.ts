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
    description: '快速生成可继续修改的简洁草图。路演阶段建议使用结构清楚的对象。',
    exampleCommands: [
      '画一个红色太阳和一棵绿色树',
      '在左上角画一个太阳',
      '在右下角画一个小房子',
    ],
    planFocus: '少元素、可识别、可继续调整',
    promptHint: '用户需要快速草图。优先画简单结构，元素不超过5个，风格极简手绘线条风，不要过度设计。',
  },
  story_scene: {
    id: 'story_scene',
    label: '故事场景',
    icon: '🌙',
    description: '把叙事内容降级成可读的白板式草图。复杂人物和细节不作为路演主线。',
    exampleCommands: [
      '画一个用户说话，AI生成草图的场景',
      '画一个小女孩站在月亮下面',
      '在左上角加一个太阳',
    ],
    planFocus: '把故事拆成少量元素，优先可识别性',
    promptHint: '用户想讲述一个场景故事。把复杂叙事拆成不超过5个明确元素，优先可识别性和元素关系，避免复杂人物细节。',
  },
  teaching_diagram: {
    id: 'teaching_diagram',
    label: '课堂讲解',
    icon: '📐',
    description: '绘制教学用图示，清晰标注关系。',
    exampleCommands: [
      '画太阳、地球和月亮，表示月亮绕地球转',
      '画一个AI理解语音并生成草图的示意图',
      '画用户、AI、画布三个元素的关系',
    ],
    planFocus: '教学清晰度优先，元素不超过5个，标注关系明确',
    promptHint: '用户用于课堂教学。需要清晰标注元素间关系，考虑用箭头、标签辅助说明。极简线条风，避免多余装饰。',
  },
  whiteboard_flow: {
    id: 'whiteboard_flow',
    label: '白板流程',
    icon: '🔄',
    description: '绘制流程图、架构图、步骤示意。',
    exampleCommands: [
      '画一个从语音输入到生成草图的流程图',
      '画一个从登录到支付的流程图',
      '画Say2Draw的工作流程',
    ],
    planFocus: '流程逻辑清晰，节点不重叠，文字始终可读',
    promptHint: '用户需要流程或架构图。注重步骤顺序、层级关系、箭头方向。极简手绘线条风，用框和连线表达结构。',
  },
}

/** Config pseudo-mode (not a drawing mode, used for navigation state). */
export const CONFIG_MODE = 'config' as const
export type AppPage = typeof CONFIG_MODE | DrawingMode

export function isDrawingMode(mode: AppPage): mode is DrawingMode {
  return mode !== CONFIG_MODE
}
