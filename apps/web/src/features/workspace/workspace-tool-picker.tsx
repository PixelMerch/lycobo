import {
  Button,
  ComboBox,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import {
  IconArrowUpRight,
  IconChevronDown,
  IconPhoto,
  IconSearch,
  IconVideo,
} from "@tabler/icons-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { DialogClose } from "../../components/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { ModelLogo, useModelPresentation } from "../generation/models/model-logos";
import { shareProductReference, toolForPath, workspaceTools } from "./workspace-state";

const categories = ["全部工具", "主图制作", "套图与裂变", "商品视频"];
export function WorkspaceToolPicker() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = toolForPath(pathname);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("全部工具");
  const visible = workspaceTools.filter(
    (tool) =>
      (category === "全部工具" || tool.category === category) &&
      `${tool.name}${tool.description}`.includes(search.trim()),
  );
  const showVideo =
    (category === "商品视频" || category === "全部工具") && "商品视频".includes(search.trim());
  return (
    <>
      <Button
        className="workspace-tool-trigger"
        variant="secondary"
        onPress={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <UiIcon icon={IconPhoto} />
        <span>{current.name}</span>
        <small>切换</small>
        <UiIcon icon={IconChevronDown} size="small" />
      </Button>
      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop className="workspace-tools-backdrop">
          <Modal.Container>
            <Modal.Dialog className="workspace-tools-dialog">
              <Modal.Header className="workspace-tools-header">
                <Modal.Heading>选择工具</Modal.Heading>
                <TextField
                  className="workspace-tool-search"
                  value={search}
                  onChange={setSearch}
                  aria-label="搜索电商工具"
                >
                  <UiIcon icon={IconSearch} size="small" />
                  <Input autoFocus placeholder="搜索工具" />
                </TextField>
                <DialogClose label="关闭工具选择" />
              </Modal.Header>
              <Modal.Body className="workspace-tools-content">
                <div className="workspace-tools-body">
                  <ToggleButtonGroup
                    className="workspace-tool-categories"
                    aria-label="工具分类"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={[category]}
                    onSelectionChange={(keys) => {
                      const next = Array.from(keys)[0];
                      if (next) setCategory(String(next));
                    }}
                  >
                    {categories.map((name) => (
                      <ToggleButton key={name} id={name}>
                        {name}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <Select
                    className="workspace-mobile-category"
                    aria-label="工具分类"
                    value={category}
                    onChange={(key) => {
                      if (key) setCategory(String(key));
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {categories.map((name) => (
                          <ListBox.Item key={name} id={name} textValue={name}>
                            {name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  <div className="workspace-tool-cards">
                    {visible.map((tool) => (
                      <Button
                        key={tool.id}
                        variant="secondary"
                        className="workspace-tool-card"
                        data-current={tool.id === current.id || undefined}
                        onPress={() => {
                          shareProductReference(pathname, tool.path);
                          navigate(tool.path);
                          setOpen(false);
                        }}
                      >
                        <span
                          className={`workspace-tool-art workspace-tool-art--${tool.id}`}
                          aria-hidden="true"
                        >
                          <img src={tool.image} alt="" loading="lazy" />
                          {tool.id === "textile" && (
                            <img src="/studio/textile-views/pillow.webp" alt="" loading="lazy" />
                          )}
                          {tool.id === "variation" && (
                            <span className="workspace-plan-sheets">
                              <span />
                              <span />
                              <span />
                            </span>
                          )}
                        </span>
                        <span className="workspace-tool-caption">
                          <span className="workspace-tool-title">
                            <strong>{tool.name}</strong>
                            <UiIcon icon={IconArrowUpRight} size="small" />
                          </span>
                          <small>{tool.description}</small>
                        </span>
                        {tool.id === "variation" ? (
                          <span className="workspace-tool-badge">计划预览</span>
                        ) : (
                          tool.id === current.id && (
                            <span className="workspace-tool-badge">当前使用</span>
                          )
                        )}
                      </Button>
                    ))}
                    {showVideo && (
                      <Button isDisabled variant="secondary" className="workspace-tool-card">
                        <span
                          className="workspace-tool-art workspace-tool-art--video"
                          aria-hidden="true"
                        >
                          <img src="/studio/models/image-2-5-2.webp" alt="" loading="lazy" />
                          <span className="workspace-video-symbol">
                            <UiIcon icon={IconVideo} size="action" />
                          </span>
                        </span>
                        <span className="workspace-tool-caption">
                          <span className="workspace-tool-title">
                            <strong>商品视频</strong>
                          </span>
                          <small>让商品动起来</small>
                        </span>
                        <span className="workspace-tool-badge">即将开放</span>
                      </Button>
                    )}
                    {!visible.length && !showVideo && (
                      <p className="workspace-tools-empty">没有匹配的工具</p>
                    )}
                  </div>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
export function TextileModelLabel() {
  const catalog = useModelPresentation();
  const model = catalog.data?.models.find((entry) => entry.id === "gpt-image-2.5");
  return (
    <div className="workspace-fixed-model">
      <span>模型</span>
      <span className="model-selector-name">
        <ModelLogo src={model?.logoUrl} size="compact" />
        {model?.name ?? "Image 2.5"}
      </span>
      <small>固定</small>
    </div>
  );
}

export function WorkspaceHistoryFilter({
  value,
  onChange,
}: {
  value: "all" | "create" | "textile";
  onChange: (value: "all" | "create" | "textile") => void;
}) {
  return (
    <ComboBox
      className="workspace-history-filter"
      aria-label="历史工具筛选"
      value={value}
      onChange={(key) => {
        if (key === "all" || key === "create" || key === "textile") onChange(key);
      }}
    >
      <Label className="sr-only">历史工具筛选</Label>
      <ComboBox.InputGroup>
        <Input placeholder="搜索工具" />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox aria-label="历史工具" renderEmptyState={() => "没有匹配的工具"}>
          <ListBox.Item id="all" textValue="全部工具">
            全部工具
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="create" textValue="主图制作">
            主图制作
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="textile" textValue="家纺套图">
            家纺套图
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
