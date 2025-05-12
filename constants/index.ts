export const SYSTEM_PROMPT = `You are a helpful math teacher that asks user some multiple choice questions and help with solving and understanding the questions. The user will be a student. Always stay in character and avoid repetition.`;

export const INTRODUCTION = "";

export const INITIAL_CONVERSATION = [
  {
    role: "system",
    content: SYSTEM_PROMPT
  },
  {
    role: "assistant",
    content: INTRODUCTION
  }
];

export const TOOLS = [{
  type: "function",
  function: {
    name: "show_question",
    description: "Show question to the user.",
    parameters: {
      type: "object",
      properties: {
        questionDescription: {
          type: "string",
          description: "The text of the quiz question"
        },
        options: {
          type: "array",
          items: {
            type: "string"
          },
          minItems: 4,
          maxItems: 4,
          description: "An array of answer options"
        },
        speechToUser: {
          type: "string",
          description: "The introduction to the question. Only use vocal responses. Approx 30-40 words"
        }
      },
      required: ["questionDescription", "options", "speechToUser"]
    }
  }
}, {
  type: "function",
  function: {
    name: "talkToUser",
    description: "Use this tool to discuss with the user. Only use vocal responses. Approx 30-40 words",
    parameters: {
      type: "object",
      properties: {
        speechToUser: {
          type: "string",
          description: "The text of the discussion to the user. Only use vocal responses. Approx 30-40 words"
        },
      },
      required: ["speechToUser"]
    }
  }
}, {
  type: "function",
  function: {
    name: "show_image",
    description: "This function will show a image to the user and tell you the metadata about the image. You can then use this image to explain the concept to the user.",
    parameters: {
      type: "object",
      properties: {
        conceptName: {
          type: "string",
          enum: ["triangles", "rightAngleTriangle", "numbers", "circles", "pizza", "vectors"],
          description: "Name of the concept you want to show the user."
        },
        speechToUser: {
          type: "string",
          description: "The introduction to the concept. Only use vocal responses. Approx 30-40 words"
        }
      },
      required: ["conceptName", "speechToUser"]
    }
  }
}];

export const IMAGES_WITH_CONCEPTS = {
  "triangles": {
    imageUrl: 'data:image/png;base64,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',
    description: 'Image of a equilateral triangle.'
  },
  "rightAngleTriangle": {
    imageUrl: 'https://ichef.bbci.co.uk/images/ic/480xn/p0dkvtlx.png',
    description: 'Image of a right angle triangle showing theta, hypotenuse h, opposite side o and adjecent a.'
  },
  "numbers": {
    imageUrl: "https://s3.eu-central-1.amazonaws.com/studysmarter-mediafiles/media/1865576/summary_images/Untitled_Artwork_3.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA4OLDUDE42UZHAIET%2F20250502%2Feu-central-1%2Fs3%2Faws4_request&X-Amz-Date=20250502T160812Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=8928baad0cbeff8e26d193aff2051f7d9c687ce88bc1584a0a1de04686a30836",
    description: "Image of number system devision"
  },
  "circles": {
    imageUrl: "https://dictionary.cambridge.org/images/thumb/circle_noun_001_02738.jpg?version=6.0.49",
    description: "Plain circle",
  },
  "pizza": {
    imageUrl: "https://assets.surlatable.com/m/15a89c2d9c6c1345/72_dpi_webp-REC-283110_Pizza.jpg",
    description: "Pizza that is cut in 8 slices to use an example of circle",
  },
  "vectors": {
    imageUrl: "https://mathinsight.org/media/image/image/vector.png",
    description: "A vector showing magnitude, direction, head and tail of a vector"
  }
}; 