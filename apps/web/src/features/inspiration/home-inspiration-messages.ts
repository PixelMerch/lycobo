import { shellMessages } from "../../app/shell-messages";
import { defineMessages } from "../../i18n/messages";

/**
 * 灵感库示例的文案：分类名称、示例标题与提示词（按示例 id 查），以及列表和详情弹窗的界面文字。
 * 提示词会原样写进主图草稿，英文界面填入英文提示词。
 */
export const homeInspirationMessages = defineMessages({
  "zh-CN": {
    categories: {
      all: "全部",
      product: "商品主图",
      scene: "场景灵感",
      textile: "家纺展示",
      creative: "创意视觉",
    },
    title: "创作灵感",
    categoryList: "灵感分类",
    replaceTitle: "替换当前提示词？",
    replaceContent: "参考图和参数会保留。",
    replaceConfirm: "替换并进入",
    keepCurrent: "保留当前内容",
    view: (title: string) => `查看灵感：${title}`,
    use: "做同款",
    useNamed: (title: string) => `做同款：${title}`,
    details: (title: string) => `灵感详情：${title}`,
    closeDetails: "关闭灵感详情",
    sample: (category: string) => `${category} · 示例素材`,
    prompt: "创作提示词",
    hint: "上传你的商品图，使用这段描述开始创作。",
    libraryTitle: shellMessages["zh-CN"].inspiration,
    items: {
      "water-perfume": {
        title: "水光香氛",
        prompt:
          "保留参考商品的外观、颜色和包装，将商品放在水边石台上，用自然阳光与水面反光营造清透的商业摄影画面，不额外添加文字。",
      },
      "cream-bedroom": {
        title: "原木与晨光",
        prompt:
          "保留参考床品的颜色、花型、绗缝和套件组成，将床品置于原木卧室中，窗边自然光，画面干净，完整展示商品。",
      },
      "glass-flower": {
        title: "玻璃花的想象",
        prompt:
          "以参考商品为主体，搭配透明玻璃花和柔和的折射光，保持商品外观不变，创作清晰、有层次的商业创意画面，不添加文字。",
      },
      "white-footwear": {
        title: "纯白商品陈列",
        prompt:
          "保持参考商品的形状、材质和细节，使用简洁浅色背景，柔和棚拍光线，突出商品轮廓和质感，不增加配件或文字。",
      },
      "fashion-blue": {
        title: "蓝调时尚大片",
        prompt:
          "保留参考服装的版型、颜色和面料，在自然采光的户外场景展示，使用商业时尚摄影构图，突出衣料质感与穿着效果。",
      },
      "textile-pillow": {
        title: "枕间细节",
        prompt:
          "基于参考床品拍摄枕头特写，保持枕套的颜色、花型和绗缝一致，柔和侧光，清晰展现面料与包边细节。",
      },
      "amber-perfume": {
        title: "琥珀色的光影",
        prompt:
          "保留参考商品的外形与包装，搭配暖色光影和克制的背景，用近景商业摄影突出商品的材质、边缘与细节，不添加文字。",
      },
      "bag-editorial": {
        title: "手袋场景摄影",
        prompt:
          "保留参考手袋的轮廓、颜色、五金和纹理，在自然简洁的生活场景中展示，突出主体，背景适度虚化，不改变商品设计。",
      },
      "lavender-bedding": {
        title: "浅紫卧室配色",
        prompt:
          "保持参考床品的绗缝、花型和套件组成，为卧室搭配柔和的浅紫色调与自然光，画面简洁，商品完整展示。",
      },
      "paper-metal": {
        title: "纸与金属的构成",
        prompt:
          "围绕参考商品，用纸张和金属材质组织简洁的几何构图，保留商品外观，采用有层次的光影，不添加文字或品牌。",
      },
      "textile-fabric": {
        title: "看得见的面料",
        prompt:
          "以参考床品的面料为主体进行近距离特写，保留真实纹理、绗缝和颜色，展现自然褶皱与柔和光线，不虚构材质信息。",
      },
      "textile-front": {
        title: "一套床品的正面",
        prompt:
          "从床尾中央平视拍摄参考床品，保持商品颜色、图案、材质和套件组成不变，左右构图平衡，完整展示床头、枕套和被子。",
      },
      "folded-textile": {
        title: "套件质感陈列",
        prompt:
          "以参考床品为主体，将被子与枕套整齐折叠陈列，保留商品颜色、绗缝和材质纹理，使用干净背景与柔和自然光，不添加文字或品牌。",
      },
      "white-perfume": {
        title: "白底香水主图",
        prompt:
          "保留参考香水的瓶身、瓶盖与颜色，纯白背景居中摆放，柔和棚拍光与自然投影，符合电商平台主图要求，不添加文字。",
      },
      "white-handbag": {
        title: "白底手袋主图",
        prompt:
          "保留参考手袋的形状、颜色、五金和皮革纹理，纯白背景正面展示，光线均匀，细节清晰，不添加道具或文字。",
      },
      "white-soda": {
        title: "白底饮料主图",
        prompt:
          "保留参考饮料罐的颜色、图案和罐身细节，纯白背景居中直立，柔和反光与淡淡投影，干净的电商主图，不添加文字。",
      },
      "citrus-splash": {
        title: "西柚水花海报",
        prompt:
          "保留参考饮料的罐体、包装和标签，搭配西柚切片、冰块与清澈水花，蓝色清爽背景，夏日商业广告摄影，不编造产品功效，不添加额外文字。",
      },
      "stone-perfume": {
        title: "石台上的香水",
        prompt:
          "保留参考商品的瓶身、标签与颜色，将香水放在阳光照射的米色石台上，点缀洋甘菊，柔和自然光，真实商业产品摄影，不添加文字。",
      },
      "sunlit-handbag": {
        title: "暖光石台手袋",
        prompt:
          "保留参考包袋的形状、颜色、五金和皮革纹理，在暖色石质展台上拍摄干净的电商商品主图，柔和侧光，细节清晰，不添加文字。",
      },
      "glass-pavilion": {
        title: "林间玻璃建筑",
        prompt:
          "以参考商品为主角，置于林间瀑布旁的流线型玻璃建筑场景中，保留商品外观不变，清透自然光，构图有纵深，不添加文字。",
      },
      "alpine-sunrise": {
        title: "云海日出",
        prompt:
          "为参考商品搭配雪山云海与粉橙色日出天光，保持商品外观、颜色和比例不变，商品清晰突出，画面辽阔，不添加文字。",
      },
      "textile-draped": {
        title: "垂到地面的被子",
        prompt:
          "从床尾斜侧拍摄参考床品，让被子自然垂到地面，保持颜色、绗缝和套件组成不变，晨光卧室，完整展示垂坠感。",
      },
      "textile-overhead": {
        title: "俯拍整床",
        prompt:
          "从正上方俯拍参考床品铺好的整张床，保持颜色、花型、绗缝和枕头数量不变，对称构图，光线均匀柔和。",
      },
    },
  },
  en: {
    categories: {
      all: "All",
      product: "Main images",
      scene: "Scenes",
      textile: "Home textiles",
      creative: "Creative",
    },
    title: "Inspiration",
    categoryList: "Inspiration categories",
    replaceTitle: "Replace the current prompt?",
    replaceContent: "Your reference images and settings stay.",
    replaceConfirm: "Replace and open",
    keepCurrent: "Keep current",
    view: (title) => `View inspiration: ${title}`,
    use: "Use this style",
    useNamed: (title) => `Use this style: ${title}`,
    details: (title) => `Inspiration details: ${title}`,
    closeDetails: "Close inspiration details",
    sample: (category) => `${category} · Sample`,
    prompt: "Prompt",
    hint: "Upload your product photo and start creating with this description.",
    libraryTitle: shellMessages.en.inspiration,
    items: {
      "water-perfume": {
        title: "Perfume by the water",
        prompt:
          "Keep the reference product's look, colors and packaging. Place it on a stone ledge by the water and use natural sunlight and reflections off the water for a clear, fresh commercial shot. Don't add any text.",
      },
      "cream-bedroom": {
        title: "Wood and morning light",
        prompt:
          "Keep the reference bedding's colors, pattern, quilting and set pieces. Place it in a natural wood bedroom with daylight from the window, a clean frame and the whole product in view.",
      },
      "glass-flower": {
        title: "Glass flower fantasy",
        prompt:
          "Feature the reference product with clear glass flowers and soft refracted light, keeping its look unchanged, for a crisp, layered commercial creative image with no text.",
      },
      "white-footwear": {
        title: "All-white display",
        prompt:
          "Keep the reference product's shape, materials and details. Use a simple light background and soft studio lighting to bring out its outline and texture, without adding accessories or text.",
      },
      "fashion-blue": {
        title: "Blue fashion editorial",
        prompt:
          "Keep the reference garment's cut, color and fabric. Show it in a naturally lit outdoor scene with commercial fashion composition that brings out the fabric texture and how it wears.",
      },
      "textile-pillow": {
        title: "Pillow details",
        prompt:
          "Shoot a pillow close-up based on the reference bedding, keeping the pillowcase's color, pattern and quilting consistent, with soft side light that shows the fabric and piping clearly.",
      },
      "amber-perfume": {
        title: "Amber light and shadow",
        prompt:
          "Keep the reference product's shape and packaging. Pair warm light and shadow with a restrained background, and use close-up commercial photography to bring out its materials, edges and details. Don't add text.",
      },
      "bag-editorial": {
        title: "Handbag lifestyle shot",
        prompt:
          "Keep the reference handbag's silhouette, color, hardware and texture. Show it in a simple, natural lifestyle scene with the bag in focus and the background softly blurred, without changing the design.",
      },
      "lavender-bedding": {
        title: "Lavender bedroom",
        prompt:
          "Keep the reference bedding's quilting, pattern and set pieces. Give the bedroom soft lavender tones and natural light, with a clean frame and the whole product in view.",
      },
      "paper-metal": {
        title: "Paper and metal composition",
        prompt:
          "Build a simple geometric composition of paper and metal around the reference product, keeping its look, with layered light and shadow and no text or brands.",
      },
      "textile-fabric": {
        title: "Fabric up close",
        prompt:
          "Make a close-up of the reference bedding's fabric, keeping its real texture, quilting and color, with natural folds and soft light. Don't invent material details.",
      },
      "textile-front": {
        title: "Bedding set, front view",
        prompt:
          "Shoot the reference bedding at eye level from the center of the foot of the bed, keeping its colors, pattern, materials and set pieces unchanged, in a balanced composition that shows the headboard, pillowcases and duvet in full.",
      },
      "folded-textile": {
        title: "Folded set display",
        prompt:
          "Feature the reference bedding with the duvet and pillowcases neatly folded, keeping the product's colors, quilting and material texture, on a clean background with soft natural light. Don't add text or brands.",
      },
      "white-perfume": {
        title: "Perfume on white",
        prompt:
          "Keep the reference perfume's bottle, cap and colors. Center it on a pure white background with soft studio light and a natural shadow, ready for a marketplace main image. Don't add text.",
      },
      "white-handbag": {
        title: "Handbag on white",
        prompt:
          "Keep the reference handbag's shape, colors, hardware and leather grain. Show it from the front on a pure white background with even light and clear detail, with no props or text.",
      },
      "white-soda": {
        title: "Drink can on white",
        prompt:
          "Keep the reference can's colors, artwork and details. Stand it upright in the center of a pure white background with soft highlights and a light shadow for a clean main image. Don't add text.",
      },
      "citrus-splash": {
        title: "Grapefruit splash poster",
        prompt:
          "Keep the reference drink's can, packaging and label. Add grapefruit slices, ice and clear splashes on a fresh blue background for a summer commercial ad. Don't invent product benefits or add extra text.",
      },
      "stone-perfume": {
        title: "Perfume on sunlit stone",
        prompt:
          "Keep the reference product's bottle, label and colors. Place the perfume on a sunlit beige stone ledge with chamomile flowers in soft natural light, as a realistic commercial product photo. Don't add text.",
      },
      "sunlit-handbag": {
        title: "Handbag on warm stone",
        prompt:
          "Keep the reference bag's shape, colors, hardware and leather grain. Shoot a clean marketplace main image on a warm stone plinth with soft side light and sharp detail. Don't add text.",
      },
      "glass-pavilion": {
        title: "Glass pavilion in the woods",
        prompt:
          "Make the reference product the hero of a scene with a flowing glass building beside a forest waterfall, keeping its look unchanged, with clear natural light and a deep composition. Don't add text.",
      },
      "alpine-sunrise": {
        title: "Sunrise above the clouds",
        prompt:
          "Pair the reference product with snowy peaks, a sea of clouds and a pink-orange sunrise, keeping its look, colors and proportions unchanged so it stands out in a wide view. Don't add text.",
      },
      "textile-draped": {
        title: "Duvet draped to the floor",
        prompt:
          "Shoot the reference bedding from an angle at the foot of the bed with the duvet falling naturally to the floor, keeping its colors, quilting and set pieces unchanged in a morning-lit bedroom.",
      },
      "textile-overhead": {
        title: "Whole bed from above",
        prompt:
          "Shoot the made bed with the reference bedding straight from above, keeping its colors, pattern, quilting and number of pillows unchanged, in a symmetrical frame with soft, even light.",
      },
    },
  },
});
