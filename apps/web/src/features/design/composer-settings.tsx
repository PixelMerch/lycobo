import { Button, ListBox, Popover, Select } from "@heroui/react";
import {
  IconBanana,
  IconChartBar,
  IconChevronDown,
  IconPhoto,
  IconSettings,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useDesignStore } from "./design-data";

const models = [
  { name: "香蕉 2.1版", family: "香蕉系列 · 2.1", icon: IconBanana },
  { name: "Image-2", family: "Image 系列 · 2", icon: IconPhoto },
  { name: "Image-2.5 Subrt", family: "Image 系列 · Subrt", icon: IconPhoto },
  { name: "香蕉 2.0版", family: "香蕉系列 · 2.0", icon: IconBanana },
  { name: "香蕉Pro版", family: "香蕉系列 · Pro", icon: IconBanana },
  { name: "Image-2.5 Flare", family: "Image 系列 · Flare", icon: IconPhoto },
  { name: "Seedream 5.0 P", family: "Seedream 系列 · 5.0 P", icon: IconChartBar },
  { name: "香蕉标准版", family: "香蕉系列 · 标准", icon: IconBanana },
] as const;

const fields = [
  {
    key: "ratio",
    label: "比例",
    values: ["1:1", "2:3", "3:2", "9:16", "16:9", "3:4", "4:3", "21:9"],
  },
  { key: "resolution", label: "分辨率", values: ["1K", "2K", "4K"] },
  { key: "count", label: "生成张数", values: ["1张", "2张", "3张", "4张"] },
] as const;

export function ComposerSettings() {
  const motionId = useId();
  const reduceMotion = useReducedMotion();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useDesignStore((s) => s.settings);
  const setSettings = useDesignStore((s) => s.setSettings);
  const selectedModel = models.find((model) => model.name === settings.model) ?? models[0];
  return (
    <fieldset className="composer-settings" aria-label="生成参数">
      <Select
        aria-label="模型"
        className="composer-select setting-model"
        value={settings.model}
        onChange={(value) => {
          if (typeof value === "string") setSettings({ model: value });
        }}
      >
        <Select.Trigger className="setting-trigger">
          <UiIcon icon={selectedModel.icon} size="default" />
          <Select.Value>{settings.model}</Select.Value>
          <Select.Indicator className="setting-indicator" />
        </Select.Trigger>
        <Select.Popover placement="top start" className="model-popover">
          <ListBox aria-label="模型" className="model-list">
            {models.map((model) => (
              <ListBox.Item
                key={model.name}
                id={model.name}
                textValue={model.name}
                aria-label={model.name}
                className="model-option"
              >
                <span className="model-symbol">
                  <UiIcon icon={model.icon} size="action" />
                </span>
                <span className="model-copy">
                  <strong>{model.name}</strong>
                  <small>{model.family}</small>
                </span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <Popover isOpen={settingsOpen} onOpenChange={setSettingsOpen}>
        <Button variant="tertiary" className="parameter-trigger" aria-label="图像设置">
          <UiIcon icon={IconSettings} size="default" />
          <span>
            {settings.ratio} · {settings.resolution} · {settings.count}
          </span>
          <span className="parameter-chevron" data-open={settingsOpen}>
            <UiIcon icon={IconChevronDown} size="small" />
          </span>
        </Button>
        <Popover.Content placement="bottom end" className="parameter-popover">
          <Popover.Dialog aria-label="图像设置" className="parameter-dialog">
            {fields.map(({ key, label, values }) => (
              <fieldset key={key} className={`parameter-group parameter-${key}`}>
                <legend>{label}</legend>
                <div className="parameter-options">
                  {values.map((value) => (
                    <Button
                      key={value}
                      variant="tertiary"
                      aria-label={`${label} ${value}`}
                      aria-pressed={settings[key] === value}
                      className="parameter-option"
                      onPress={() => setSettings({ [key]: value })}
                    >
                      {settings[key] === value ? (
                        <motion.span
                          aria-hidden="true"
                          className="parameter-selection"
                          {...(reduceMotion ? {} : { layoutId: `${motionId}-${key}` })}
                          initial={false}
                          transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
                          style={{ borderRadius: 10 }}
                        />
                      ) : null}
                      {key === "ratio" ? (
                        <span className="ratio-preview">
                          <span
                            className="ratio-shape"
                            style={{
                              aspectRatio: value.replace(":", "/"),
                              width: `${20 * Math.min(1, Number(value.split(":")[0]) / Number(value.split(":")[1]))}px`,
                            }}
                          />
                        </span>
                      ) : null}
                      {value}
                    </Button>
                  ))}
                </div>
              </fieldset>
            ))}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </fieldset>
  );
}
