/**
 * JSON Schema for DrawingAction - used with OpenAI Structured Outputs
 */

export const DRAWING_ACTION_SCHEMA = {
  name: 'drawing_action',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['add_shape', 'clear_canvas', 'undo', 'ask_clarification'],
        description: 'The type of drawing action',
      },
      shape: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'arc', 'text'],
            description: 'The type of shape',
          },
          x: { type: 'number', description: 'X coordinate (0-800)' },
          y: { type: 'number', description: 'Y coordinate (0-500)' },
          radius: { type: 'number', description: 'Radius for circle (10-200)' },
          radiusX: { type: 'number', description: 'Horizontal radius for ellipse (10-200)' },
          radiusY: { type: 'number', description: 'Vertical radius for ellipse (10-200)' },
          width: { type: 'number', description: 'Width for rect (10-400)' },
          height: { type: 'number', description: 'Height for rect (10-400)' },
          x1: { type: 'number', description: 'Start X for line (0-800)' },
          y1: { type: 'number', description: 'Start Y for line (0-500)' },
          x2: { type: 'number', description: 'End X for line (0-800)' },
          y2: { type: 'number', description: 'End Y for line (0-500)' },
          points: {
            type: 'array',
            description: 'Points for polyline (2-10 points) or polygon (3-8 points)',
            minItems: 2,
            maxItems: 10,
            items: {
              type: 'object',
              properties: {
                x: { type: 'number', description: 'Point X coordinate (0-800)' },
                y: { type: 'number', description: 'Point Y coordinate (0-500)' },
              },
              required: ['x', 'y'],
              additionalProperties: false,
            },
          },
          startAngle: { type: 'number', description: 'Start angle for arc in degrees (-360 to 360)' },
          endAngle: { type: 'number', description: 'End angle for arc in degrees (-360 to 360)' },
          text: { type: 'string', description: 'Text content (max 50 chars)' },
          fontSize: { type: 'number', description: 'Font size for text (12-72)' },
          fill: { type: 'string', description: 'Fill color (hex)' },
          stroke: { type: 'string', description: 'Stroke color (hex)' },
          lineWidth: { type: 'number', description: 'Line width (1-20)' },
        },
        required: ['type'],
        additionalProperties: false,
      },
      clarification: {
        type: 'string',
        description: 'Clarification message when type is ask_clarification',
      },
    },
    required: ['type'],
    additionalProperties: false,
  },
} as const

export const BATCH_ACTION_SCHEMA = {
  name: 'batch_actions',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        items: DRAWING_ACTION_SCHEMA.schema,
        maxItems: 10,
        description: 'Array of drawing actions (max 10)',
      },
    },
    required: ['actions'],
    additionalProperties: false,
  },
} as const
