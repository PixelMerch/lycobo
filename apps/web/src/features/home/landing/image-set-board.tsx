import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

export interface ShowcaseImage {
  src: string;
  alt: string;
}

/** 主图与完整细节组成编辑式套图，细节沿阅读顺序展开并保留独立选择器。 */
export function ImageSetBoard({
  images,
  onOpen,
  label,
}: {
  images: ShowcaseImage[];
  onOpen: () => void;
  label: string;
}) {
  const [selected, setSelected] = useState(0);
  const reducedMotion = useReducedMotion();
  const image = images[selected] ?? images[0];
  return (
    <div className="commerce-set-board">
      <Button variant="ghost" className="commerce-set-main" aria-label={label} onPress={onOpen}>
        <motion.img
          key={image?.src}
          src={image?.src}
          alt={image?.alt}
          loading="lazy"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
        <span className="commerce-set-caption">{image?.alt}</span>
      </Button>
      <div className="commerce-set-fan" aria-hidden="true">
        {images.slice(1).map((photo, index) => (
          <motion.div
            className="commerce-fan-card"
            key={photo.src}
            initial={reducedMotion ? false : { opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              duration: reducedMotion ? 0 : 0.72,
              ease: [0.23, 1, 0.32, 1],
              delay: reducedMotion ? 0 : index * 0.08,
            }}
          >
            <img src={photo.src} alt="" loading="lazy" />
            <span>{photo.alt}</span>
          </motion.div>
        ))}
      </div>
      <ToggleButtonGroup
        className="commerce-set-views"
        aria-label={label}
        isDetached
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[String(selected)]}
        onSelectionChange={(keys) => {
          const [key] = keys;
          const index = Number(key);
          if (images[index]) setSelected(index);
        }}
      >
        {images.map((photo, index) => (
          <ToggleButton key={photo.src} id={String(index)}>
            {photo.alt}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
