import { defineMessages } from "../../../i18n/messages";

/** Impact、创作参考模板和结尾入口的文案。 */
export const sectionsMessages = defineMessages({
  "zh-CN": {
    impact: {
      eyebrow: "同款多图",
      images: {
        hero: "焦糖棕色通勤托特包的暖白棚拍主图",
        scene: "同一只托特包放在明亮工作台上的场景图",
        hardware: "托特包金属提手连接环特写",
        leather: "托特包皮面纹理与同色缝线特写",
      },
      title: "主图、场景、细节，风格保持一致",
      description: "围绕同一款商品，制作不同用途的图片。",
      stats: {
        product: { value: "1 款", label: "同一商品" },
        images: { value: "4 张", label: "示例图片" },
        uses: { value: "3 类", label: "主图·场景·细节" },
      },
    },
    formats: {
      eyebrow: "创作参考",
      title: "选主图、场景或细节，从参考开始制作",
      description: "选择参考方向，到工作区上传自己的商品。",
      carouselLabel: "商品图创作参考",
      previous: "上一个创作参考",
      next: "下一个创作参考",
      use: "用这个创作",
      namedAction: (title: string) => `用这个创作：${title}`,
      openReplica: "打开复制爆款",
      openTextile: "打开家纺裂变",

      prompts: {
        studio:
          "保留我上传的商品外观、颜色、材质和结构，使用干净暖白或浅灰无缝背景，柔和棚拍光，商品完整居中，突出轮廓与质感，不添加文字、配件或额外道具。",
        everyday:
          "保留我上传的商品外观、颜色、材质和结构，把商品放入自然生活场景，使用柔和自然光和合理尺度，背景简洁不遮挡主体，不添加文字。",
        footwear:
          "保留我上传的鞋服商品外观、颜色、材质和版型，使用简洁浅色棚拍背景和侧面柔光，完整展示鞋头、鞋跟或服装轮廓，不添加人物、文字或装饰。",
        texture:
          "保留我上传的商品外观和结构，拍摄可见材质和细节近景，真实纹理与接缝清晰，不编造母图没有的部件，不添加文字或性能宣称。",
        food: "保留我上传的食品或包装外观、颜色和结构，使用暖米色背景和偏侧逆光表现包装层次与材质，少量真实道具远离主体，不添加文字、认证或健康宣称。",
        "image-set":
          "围绕我上传的同一款商品，规划 5 张独立电商图片：暖白背景主图、自然光生活场景、一个可见结构细节、另一个可见材质细节、竖版场景构图。每条方案只负责一张图，保留商品外形、颜色、纹理与部件，不编造参数、配件、认证或功效。图中不需要文字。先给我可确认的方案，不直接生图。",
        "style-reference": "",
        "textile-angles": "",
        backgrounds:
          "以我上传的商品图为唯一商品参考，制作三张独立背景变体：暖白棚拍、浅灰台面、自然光生活场景。只改变背景和布光，商品形状、颜色、材质、结构与数量不变，不添加文字或配件。每张独立输出。先通过套图计划分别列出三条方案，确认后再生成。",
        portrait:
          "保留我上传的商品外观、颜色和结构，制作 9:16 竖版构图，主体集中在中上部但不顶边，下方保留自然背景和标题安全区，完整展示商品，不添加文字。",
      },
      replaceTitle: "替换当前草稿？",
      replaceContent: "当前已有创作内容。继续会把模板提示词和规格带入草稿，已有商品图保留。",
      replaceConfirm: "替换并进入",
      keepCurrent: "保留当前内容",
      cards: {
        studio: { title: "干净白底", description: "突出商品轮廓与质感。" },
        everyday: { title: "日常场景", description: "把商品放进自然生活场景。" },
        footwear: { title: "鞋服陈列", description: "用简洁构图展示款式。" },
        texture: { title: "材质特写", description: "看清可见材质与结构。" },
        food: { title: "食品静物", description: "用光线呈现包装与细节。" },
        "image-set": { title: "商品套图", description: "先确认方案，再制作多张图。" },
        "style-reference": { title: "参考版式", description: "参考布局，换成自己的商品。" },
        "textile-angles": { title: "家纺视角", description: "展示床品全貌与细节。" },
        backgrounds: { title: "多种背景", description: "同一商品，尝试不同场景。" },
        portrait: { title: "竖版构图", description: "为竖版画面重新安排构图。" },
      },
    },
    cta: {
      eyebrow: "开始创作",
      title: "上传商品图，开始制作",
      description: "主图、场景图、套图，按你的需求制作。",
      button: "开始制作",
    },
  },
  en: {
    impact: {
      eyebrow: "One product, more views",
      images: {
        hero: "Caramel brown tote bag on a warm white studio set",
        scene: "The same tote bag on a bright worktable",
        hardware: "Close view of the tote bag metal handle ring",
        leather: "Close view of the tote bag leather grain and stitching",
      },
      title: "Studio, lifestyle and detail. One consistent look.",
      description: "Create images for different uses around the same product.",
      stats: {
        product: { value: "1", label: "Product" },
        images: { value: "4", label: "Images" },
        uses: { value: "3", label: "Uses" },
      },
    },
    formats: {
      eyebrow: "Starting points",
      title: "Start with a product shot, scene or detail",
      description: "Choose a direction, then add your product in the workspace.",
      carouselLabel: "Product image starting points",
      previous: "Previous starting point",
      next: "Next starting point",
      use: "Use this look",
      namedAction: (title: string) => `Use this look: ${title}`,
      openReplica: "Open Style Match",
      openTextile: "Open Textile Set",

      prompts: {
        studio:
          "Keep my product's appearance, color, material and structure. Place it on a clean warm-white or light grey seamless background with soft studio light, complete and centered, emphasizing shape and texture. Add no text, extra parts or props.",
        everyday:
          "Keep my product's appearance, color, material and structure. Place it in a natural everyday setting with soft natural light and realistic scale. Keep the background simple and unobstructed, with no text.",
        footwear:
          "Keep the appearance, color, material and silhouette of my footwear or apparel. Use a clean light studio background with soft side light, showing the toe, heel or garment outline completely. Add no people, text or decoration.",
        texture:
          "Keep my product's appearance and structure. Shoot a close-up of visible material and details with clear texture and seams. Do not invent parts that are not in the reference, and add no text or performance claims.",
        food: "Keep the appearance, color and structure of my food or packaging. Use a warm beige background and gentle side-back light to show packaging depth and material. Keep a few real props away from the subject; add no text, certifications or health claims.",
        "image-set":
          "Plan 5 independent ecommerce images around the same product I upload: a warm-white hero, a natural-light lifestyle scene, one visible structural detail, one visible material detail, and a portrait scene. Each plan creates one image and keeps the product shape, color, texture and parts. Do not invent specifications, accessories, certifications or benefits. No text in the images. Give me a plan to confirm before generating.",
        "style-reference": "",
        "textile-angles": "",
        backgrounds:
          "Use my uploaded product image as the only product reference and create three independent background variations: warm-white studio, light grey surface, and natural-light lifestyle. Change only the background and lighting. Keep the product shape, color, material, structure and quantity unchanged. Add no text or accessories. Output each image separately, and give me the three plans to confirm before generating.",
        portrait:
          "Keep my product's appearance, color and structure. Create a 9:16 portrait composition with the subject in the upper-middle, not touching the top edge, leaving natural space and a title-safe area below. Show the complete product with no text.",
      },
      replaceTitle: "Replace the current draft?",
      replaceContent:
        "This draft already has content. Continuing adds the template prompt and settings while keeping your product images.",
      replaceConfirm: "Replace and continue",
      keepCurrent: "Keep current content",
      cards: {
        studio: { title: "Clean studio", description: "Put shape and texture first." },
        everyday: { title: "Everyday setting", description: "Show your product in everyday life." },
        footwear: { title: "Footwear display", description: "Let the design stand out." },
        texture: { title: "Texture close-up", description: "Bring visible details closer." },
        food: {
          title: "Food still life",
          description: "Highlight packaging with considered light.",
        },
        "image-set": {
          title: "Product image set",
          description: "Review a plan before creating the set.",
        },
        "style-reference": {
          title: "Style reference",
          description: "Use a layout with your own product.",
        },
        "textile-angles": {
          title: "Textile angles",
          description: "Show bedding from more angles.",
        },
        backgrounds: {
          title: "Background variations",
          description: "Try different settings for one product.",
        },
        portrait: {
          title: "Portrait composition",
          description: "Compose your product for a portrait frame.",
        },
      },
    },
    cta: {
      eyebrow: "Start creating",
      title: "Start with your product photo",
      description: "Create product shots, lifestyle images and image sets.",
      button: "Start creating",
    },
  },
});
