import { defineMessages } from "../../i18n/messages";

/**
 * 首页四个创作模式的标语与输入提示、家纺裂变两行上传入口的名称，以及描述模板（按模板 id 查）。
 * 模板的描述会原样写进草稿、作为提示词提交，英文界面填入英文描述。
 */
export const homeModeMessages = defineMessages({
  "zh-CN": {
    modes: {
      create: {
        /** 标语分成两段，窄屏只在第一段之后换行；highlight 是第二段里用渐变突出的关键词。 */
        sloganLead: "让每件商品，",
        sloganTail: "都有一张好主图",
        highlight: "好主图",
        placeholder: "描述你想要的画面，输入 @ 引用已上传图片",
      },
      textile: {
        sloganLead: "一张家纺主图，",
        sloganTail: "裂变整套视角",
        highlight: "整套视角",
        placeholder: "",
      },
      variation: {
        sloganLead: "整套商品图，",
        sloganTail: "先规划再生成",
        highlight: "先规划",
        placeholder: "描述整套图片的用途、场景和卖点，输入 @ 引用商品图",
      },
      video: {
        sloganLead: "让商品图片，",
        sloganTail: "动起来讲卖点",
        highlight: "动起来",
        placeholder: "描述画面主体、动作和镜头运动，例如：晨光卧室，镜头推近展示面料纹理",
      },
    },
    /** 家纺裂变左侧两行上传入口；其他模式只在描述上方放一个添加参考图小格。 */
    textileUpload: { main: "家纺主图", extra: "详情图" },
    templates: {
      white: {
        name: "白底主图",
        prompt:
          "保留参考商品的外观、颜色和细节，使用纯白背景与柔和棚拍光，商品居中完整展示，生成一张干净的电商白底主图，不添加文字。",
      },
      scene: {
        name: "场景主图",
        prompt: "保留参考商品的外观和细节，为商品搭配真实自然的使用场景，光线柔和，突出商品主体。",
      },
      campaign: {
        name: "活动主图",
        prompt:
          "保留参考商品的外观和细节，营造节日促销氛围，背景简洁有层次，为活动文案预留空间，不生成文字。",
      },
      poster: {
        name: "创意海报",
        prompt: "保留参考商品的外观和细节，创作一张突出商品的商业海报。",
      },
      closeup: {
        name: "细节特写",
        prompt: "保留参考商品的材质与做工，近距离拍摄商品细节，浅景深，清晰展现纹理与工艺。",
      },
      detailSet: {
        name: "详情页套图",
        prompt:
          "为这件商品规划一套详情页图片：首图展示商品全貌，后续依次展示核心卖点、材质细节、使用场景和尺寸信息。",
      },
      sellingPoints: {
        name: "卖点套图",
        prompt:
          "围绕商品的三到五个核心卖点规划一套图片，每张突出一个卖点，整体风格统一，适合主图轮播。",
      },
      sceneSet: {
        name: "场景套图",
        prompt: "把商品放进不同的真实使用场景，每张图一个场景，保持商品外观一致，光线自然。",
      },
      angles: {
        name: "多角度展示",
        prompt: "从正面、侧面、背面和细节特写等角度展示商品，背景简洁统一，完整呈现商品外观。",
      },
      showcase: {
        name: "商品展示",
        prompt: "商品置于简洁台面，镜头缓慢环绕一周，柔和棚拍光，完整展示商品外观。",
      },
      mood: {
        name: "场景氛围",
        prompt: "晨光洒进温馨的房间，镜头缓缓推近商品，展示它在真实生活中的使用氛围。",
      },
      macro: {
        name: "细节特写",
        prompt: "微距镜头沿商品表面缓慢平移，突出材质纹理与做工细节，浅景深。",
      },
      unboxing: {
        name: "开箱展示",
        prompt: "俯拍桌面，打开包装取出商品，镜头跟随商品抬起，最后定格在商品正面。",
      },
    },
  },
  en: {
    modes: {
      create: {
        sloganLead: "Every product deserves",
        sloganTail: "a main image that sells",
        highlight: "that sells",
        placeholder: "Describe the image you want; type @ to reference an uploaded image",
      },
      textile: {
        sloganLead: "One textile photo,",
        sloganTail: "a full set of angles",
        highlight: "full set of angles",
        placeholder: "",
      },
      variation: {
        sloganLead: "A full product image set,",
        sloganTail: "planned before it's made",
        highlight: "planned",
        placeholder:
          "Describe what the set is for, its scenes and selling points; type @ to reference a product image",
      },
      video: {
        sloganLead: "Let product photos",
        sloganTail: "move and sell",
        highlight: "move",
        placeholder:
          "Describe the subject, action and camera movement, e.g. a bedroom in morning light as the camera pushes in on the fabric",
      },
    },
    textileUpload: { main: "Main image", extra: "Details" },
    templates: {
      white: {
        name: "White background",
        prompt:
          "Keep the reference product's look, colors and details. Use a pure white background with soft studio lighting, center the whole product, and create a clean e-commerce main image on white with no text.",
      },
      scene: {
        name: "Lifestyle scene",
        prompt:
          "Keep the reference product's look and details, place it in a real, natural usage scene with soft light, and keep the product as the focus.",
      },
      campaign: {
        name: "Promo campaign",
        prompt:
          "Keep the reference product's look and details, create a festive sale atmosphere with a clean, layered background, and leave space for campaign copy without generating any text.",
      },
      poster: {
        name: "Creative poster",
        prompt:
          "Keep the reference product's look and details and create a commercial poster that makes the product stand out.",
      },
      closeup: {
        name: "Detail close-up",
        prompt:
          "Keep the reference product's materials and craftsmanship, shoot its details up close with a shallow depth of field, and show the texture and workmanship clearly.",
      },
      detailSet: {
        name: "Detail page set",
        prompt:
          "Plan a set of detail page images for this product: the first shows the whole product, followed by its key selling points, material details, usage scenes and size information.",
      },
      sellingPoints: {
        name: "Selling points",
        prompt:
          "Plan a set of images around the product's three to five key selling points, one per image, in one consistent style that suits a main image carousel.",
      },
      sceneSet: {
        name: "Scene set",
        prompt:
          "Put the product into different real usage scenes, one scene per image, keeping the product's look consistent and the light natural.",
      },
      angles: {
        name: "Multiple angles",
        prompt:
          "Show the product from the front, side, back and in detail close-ups, with a simple, consistent background that presents the whole product.",
      },
      showcase: {
        name: "Product showcase",
        prompt:
          "Place the product on a simple tabletop and slowly orbit the camera around it once under soft studio light, showing the whole product.",
      },
      mood: {
        name: "Lifestyle mood",
        prompt:
          "Morning light fills a cozy room as the camera slowly pushes in on the product, showing how it feels in everyday life.",
      },
      macro: {
        name: "Detail close-up",
        prompt:
          "A macro lens slowly pans across the product's surface, highlighting its material texture and craftsmanship with a shallow depth of field.",
      },
      unboxing: {
        name: "Unboxing",
        prompt:
          "Overhead shot of a tabletop: the package opens, the product is lifted out, the camera follows it up and ends on the product's front.",
      },
    },
  },
});
