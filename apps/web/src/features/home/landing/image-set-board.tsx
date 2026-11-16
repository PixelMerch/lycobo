import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { motion } from "motion/react";
import { useState } from "react";

export interface ShowcaseImage {
  src: string;
  alt: string;
}

/** 同款主图配扇形细节卡，独立按钮避免叠放图片遮挡点击区域。 */
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
  const image = images[selected] ?? images[0];
  return (
    <div className="commerce-set-board">
      <Button variant="ghost" className="commerce-set-main" aria-label={label} onPress={onOpen}>
        <motion.img
          key={image?.src}
          src={image?.src}
          alt={image?.alt}
          loading="lazy"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        />
        <span className="commerce-set-caption">{image?.alt}</span>
      </Button>
      <div className="commerce-set-fan" aria-hidden="true">
        {images.slice(1).map((photo, index) => (
          <motion.div
            className="commerce-fan-card"
            key={photo.src}
            initial={{ opacity: 0, rotate: 0, x: 0, y: 32 }}
            whileInView={{
              opacity: 1,
              rotate: (index - 1) * 13,
              x: (index - 1) * 78,
              y: Math.abs(index - 1) * 20,
            }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: index * 0.08 }}
          >
            <img src={photo.src} alt="" loading="lazy" />
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
